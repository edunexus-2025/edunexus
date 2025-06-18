
import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import PocketBase from 'pocketbase';
import { AppConfig, Routes, teacherPlatformPlansData, slugify } from '@/lib/constants'; // Added slugify
import type { UserSubscriptionTierStudent, UserSubscriptionTierTeacher } from '@/lib/types';

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const POCKETBASE_URL_SERVER = process.env.NEXT_PUBLIC_POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL_SERVER = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD_SERVER = process.env.POCKETBASE_ADMIN_PASSWORD;
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:9002'; // Fallback for APP_BASE_URL

if (!RAZORPAY_KEY_SECRET) {
  console.error("[Razorpay Verify Payment CRITICAL ENV ERROR] RAZORPAY_KEY_SECRET is not configured.");
}
if (!POCKETBASE_URL_SERVER || !POCKETBASE_ADMIN_EMAIL_SERVER || !POCKETBASE_ADMIN_PASSWORD_SERVER) {
  console.error("[Razorpay Verify Payment CRITICAL ENV ERROR] PocketBase Admin credentials or URL not fully configured.");
}

const instance = new Razorpay({
  key_id: RAZORPAY_KEY_ID!,
  key_secret: RAZORPAY_KEY_SECRET!,
});

async function getAdminPbInstance(): Promise<PocketBase | null> {
  console.log(`[Razorpay Verify Payment INFO] Attempting to connect to PocketBase URL for admin actions: ${POCKETBASE_URL_SERVER || 'NOT SET'}`);
  if (POCKETBASE_URL_SERVER && POCKETBASE_ADMIN_EMAIL_SERVER && POCKETBASE_ADMIN_PASSWORD_SERVER) {
    const adminPb = new PocketBase(POCKETBASE_URL_SERVER);
    try {
      await adminPb.admins.authWithPassword(POCKETBASE_ADMIN_EMAIL_SERVER, POCKETBASE_ADMIN_PASSWORD_SERVER);
      console.log("[Razorpay Verify Payment INFO] Successfully authenticated PocketBase admin client.");
      return adminPb;
    } catch (authError: any) {
      console.error("[Razorpay Verify Payment ERROR] CRITICAL: Failed to authenticate PocketBase admin client. Error details:", authError.data || authError.message, "Full Error:", authError);
      return null;
    }
  }
  console.warn("[Razorpay Verify Payment WARN] PocketBase admin credentials not fully configured. Operations requiring admin rights will fail.");
  return null;
}

export async function POST(request: NextRequest) {
  if (!RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: "Payment gateway server secret not configured." }, { status: 500 });
  }

  let pbAdmin: PocketBase | null = null; 
  try {
    pbAdmin = await getAdminPbInstance(); // Attempt to get admin client early

    const body = await request.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      planId, // The plan ID the user intended to purchase
      userId, // The user ID
      userType, // 'student_platform_plan', 'teacher_platform_plan', 'student_teacher_plan'
      // other notes like teacherIdForPlan, referralCodeUsed, productDescription might be here
    } = body;

    console.log("[Razorpay Verify Payment INFO] Received verification request. Body (excluding sensitive details):", { razorpay_order_id, planId, userId, userType });

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !planId || !userId || !userType) {
      return NextResponse.json({ error: "Missing required payment verification details." }, { status: 400 });
    }

    const textToHash = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(textToHash).digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.warn(`[Razorpay Verify Payment WARN] Signature mismatch. Redirecting to failure status.`);
      return NextResponse.redirect(Routes.paymentStatusPage(razorpay_order_id, 'failure', planId, "Payment verification failed (signature mismatch)."), 302);
    }

    console.log(`[Razorpay Verify Payment INFO] Signature verified. Fetching order details from Razorpay for order_id: ${razorpay_order_id}`);
    const orderDetailsFromRazorpay = await instance.orders.fetch(razorpay_order_id);
    console.log("[Razorpay Verify Payment INFO] Order details from Razorpay:", orderDetailsFromRazorpay);

    if (String(orderDetailsFromRazorpay.notes.userId) !== String(userId) ||
        String(orderDetailsFromRazorpay.notes.planId) !== String(planId) ||
        String(orderDetailsFromRazorpay.notes.userType) !== String(userType)) {
      console.error("[Razorpay Verify Payment ERROR] Mismatch between client notes and Razorpay order notes.");
       return NextResponse.redirect(Routes.paymentStatusPage(razorpay_order_id, 'error', planId, "Order details mismatch. Verification failed."), 302);
    }
    if (orderDetailsFromRazorpay.status !== 'paid') {
      console.warn(`[Razorpay Verify Payment WARN] Razorpay order status is not 'paid'. Status: ${orderDetailsFromRazorpay.status}`);
      return NextResponse.redirect(Routes.paymentStatusPage(razorpay_order_id, 'failure', planId, `Payment not completed successfully. Status: ${orderDetailsFromRazorpay.status}`), 302);
    }

    // Payment is authentic and paid
    console.log(`[Razorpay Verify Payment INFO] Payment for order ${razorpay_order_id} is authentic and paid.`);

    if (!pbAdmin) {
        console.error("[Razorpay Verify Payment ERROR] Database admin client not initialized. Cannot create activation token.");
        return NextResponse.redirect(Routes.paymentStatusPage(razorpay_order_id, 'error', planId, "Server configuration error (DB_ADMIN_TOKEN_FAIL). Plan update pending. Contact support."), 302);
    }

    // Generate activation token
    const activationToken = crypto.randomBytes(32).toString('hex');
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1); // Token valid for 1 hour

    try {
      await pbAdmin.collection('plan_activation_tokens').create({
        token: activationToken,
        user_id: userId,
        plan_id_to_activate: planId,
        order_id: razorpay_order_id,
        used: false,
        expires_at: expiryDate.toISOString(),
      });
      console.log(`[Razorpay Verify Payment INFO] Activation token created for order ${razorpay_order_id}, user ${userId}, plan ${planId}.`);

      // Redirect to the new activation page with the token and planSlug
      const planSlug = slugify(planId); // Assuming planId is like "Full_length" or "Combo"
      const activationUrl = Routes.activatePlan(activationToken, planSlug);
      
      console.log(`[Razorpay Verify Payment INFO] Redirecting to activation URL: ${APP_BASE_URL}${activationUrl}`);
      return NextResponse.redirect(`${APP_BASE_URL}${activationUrl}`, 302);

    } catch (tokenError: any) {
      console.error("[Razorpay Verify Payment ERROR] Failed to create activation token in DB:", tokenError.data || tokenError.message, "Full Error:", tokenError);
      return NextResponse.redirect(Routes.paymentStatusPage(razorpay_order_id, 'error', planId, "Failed to generate activation link. Please contact support. (TOKEN_DB_FAIL)"), 302);
    }

  } catch (error: any) {
    console.error("[Razorpay Verify Payment CRITICAL ERROR] (Outer Try-Catch):", error.response ? error.response.data : error.message, "Full Error:", error);
    let errorMessage = "Payment verification failed due to a server error.";
    if (error.response?.data?.error?.description) errorMessage = error.response.data.error.description;
    else if (error.data?.message) errorMessage = error.data.message;
    else if (error.message) errorMessage = error.message;
    // Use a generic order_id if not available in error context
    const orderIdFromError = error.response?.data?.metadata?.order_id || 'N/A_VERIFY_ERROR';
    return NextResponse.redirect(Routes.paymentStatusPage(orderIdFromError, 'error', 'UnknownPlan', errorMessage), 302);
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
}
    