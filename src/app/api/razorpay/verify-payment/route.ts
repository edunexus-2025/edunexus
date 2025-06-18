
import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import PocketBase from 'pocketbase';
import { AppConfig, Routes, teacherPlatformPlansData, slugify } from '@/lib/constants';
import type { UserSubscriptionTierStudent, UserSubscriptionTierTeacher } from '@/lib/types';

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const POCKETBASE_URL_SERVER = process.env.NEXT_PUBLIC_POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL_SERVER = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD_SERVER = process.env.POCKETBASE_ADMIN_PASSWORD;
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:9002';

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
    pbAdmin = await getAdminPbInstance();

    const body = await request.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      planId: clientPlanId, 
      userId: clientUserId, 
      userType: clientUserType,
      productDescription: clientProductDescription,
      teacherIdForPlan: clientTeacherIdForPlan,
      referralCodeUsed: clientReferralCodeUsed,
    } = body;

    console.log("[Razorpay Verify Payment INFO] Received verification request. Body (excluding sensitive details):", { razorpay_order_id, clientPlanId, clientUserId, clientUserType });

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !clientPlanId || !clientUserId || !clientUserType) {
      return NextResponse.json({ error: "Missing required payment verification details." }, { status: 400 });
    }
    if (clientUserType === 'student_teacher_plan' && !clientTeacherIdForPlan) {
      return NextResponse.json({ error: 'Missing teacherIdForPlan for student subscribing to a teacher plan.' }, { status: 400 });
    }

    const textToHash = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(textToHash).digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.warn(`[Razorpay Verify Payment WARN] Signature mismatch. Order ID: ${razorpay_order_id}. Redirecting to failure status.`);
      const failureRedirectUrl = new URL(`${APP_BASE_URL}${Routes.paymentStatusPage(razorpay_order_id, 'failure', clientPlanId, "Payment verification failed (security check).")}`);
      return NextResponse.redirect(failureRedirectUrl.toString(), 302);
    }

    console.log(`[Razorpay Verify Payment INFO] Signature verified for order ${razorpay_order_id}. Fetching order details from Razorpay...`);
    const orderDetailsFromRazorpay = await instance.orders.fetch(razorpay_order_id);
    console.log("[Razorpay Verify Payment INFO] Order details from Razorpay:", orderDetailsFromRazorpay);

    if (String(orderDetailsFromRazorpay.notes.userId) !== String(clientUserId) ||
        String(orderDetailsFromRazorpay.notes.planId) !== String(clientPlanId) ||
        String(orderDetailsFromRazorpay.notes.userType) !== String(clientUserType) ||
        (clientUserType === 'student_teacher_plan' && String(orderDetailsFromRazorpay.notes.teacherIdForPlan) !== String(clientTeacherIdForPlan))
    ) {
      console.error("[Razorpay Verify Payment ERROR] Mismatch between client-sent notes and Razorpay order notes.", { clientNotes: { clientUserId, clientPlanId, clientUserType, clientTeacherIdForPlan }, razorpayNotes: orderDetailsFromRazorpay.notes });
      const errorRedirectUrl = new URL(`${APP_BASE_URL}${Routes.paymentStatusPage(razorpay_order_id, 'error', clientPlanId, "Order details mismatch during verification. Please contact support.")}`);
      return NextResponse.redirect(errorRedirectUrl.toString(), 302);
    }

    if (orderDetailsFromRazorpay.status !== 'paid') {
      console.warn(`[Razorpay Verify Payment WARN] Razorpay order status is not 'paid'. Status: ${orderDetailsFromRazorpay.status}. Order ID: ${razorpay_order_id}`);
      const failureRedirectUrl = new URL(`${APP_BASE_URL}${Routes.paymentStatusPage(razorpay_order_id, 'failure', clientPlanId, `Payment not completed successfully. Status: ${orderDetailsFromRazorpay.status}`)}`);
      return NextResponse.redirect(failureRedirectUrl.toString(), 302);
    }
    
    console.log(`[Razorpay Verify Payment INFO] Payment for order ${razorpay_order_id} is authentic and paid.`);

    if (!pbAdmin) {
        console.error("[Razorpay Verify Payment ERROR] Database admin client not initialized. Cannot create activation token. This is a server configuration issue (PB_ADMIN_INIT_FAIL).");
        const errorRedirectUrl = new URL(`${APP_BASE_URL}${Routes.paymentStatusPage(razorpay_order_id, 'error', clientPlanId, "Server configuration error (PB_ADMIN_TOKEN_FAIL). Plan update pending. Contact support.")}`);
        return NextResponse.redirect(errorRedirectUrl.toString(), 302);
    }

    const activationToken = crypto.randomBytes(32).toString('hex');
    const expiryDateToken = new Date();
    expiryDateToken.setHours(expiryDateToken.getHours() + 1); // Token valid for 1 hour

    try {
      const tokenDataToCreate: Record<string, any> = {
        token: activationToken,
        user_id: clientUserId,
        plan_id_to_activate: clientPlanId,
        order_id: razorpay_order_id,
        used: false,
        expires_at: expiryDateToken.toISOString(),
      };
      // Add context specific to userType for the activation API
      if (clientUserType === 'student_teacher_plan' && clientTeacherIdForPlan) {
        tokenDataToCreate.context_teacher_id = clientTeacherIdForPlan;
      }
      if (clientReferralCodeUsed) {
        tokenDataToCreate.context_referral_code = clientReferralCodeUsed;
      }
      // Add userType to the token context for the activation API
      tokenDataToCreate.context_user_type = clientUserType;


      await pbAdmin.collection('plan_activation_tokens').create(tokenDataToCreate);
      console.log(`[Razorpay Verify Payment INFO] Activation token created for order ${razorpay_order_id}, user ${clientUserId}, plan ${clientPlanId}.`);

      const planSlug = slugify(clientPlanId); 
      const activationUrlPath = Routes.activatePlan(activationToken, planSlug);
      const fullActivationUrl = new URL(`${APP_BASE_URL}${activationUrlPath}`);
      
      console.log(`[Razorpay Verify Payment INFO] Redirecting to activation URL: ${fullActivationUrl.toString()}`);
      return NextResponse.redirect(fullActivationUrl.toString(), 302);

    } catch (tokenError: any) {
      console.error("[Razorpay Verify Payment ERROR] Failed to create activation token in DB:", tokenError.data || tokenError.message, "Full Error:", tokenError);
      const errorRedirectUrl = new URL(`${APP_BASE_URL}${Routes.paymentStatusPage(razorpay_order_id, 'error', clientPlanId, "Failed to generate activation link. Please contact support. (TOKEN_DB_FAIL)")}`);
      return NextResponse.redirect(errorRedirectUrl.toString(), 302);
    }

  } catch (error: any) {
    console.error("[Razorpay Verify Payment CRITICAL ERROR] (Outer Try-Catch):", error.response ? error.response.data : error.message, "Full Error:", error);
    let errorMessage = "Payment verification failed due to a server error.";
    if (error.response?.data?.error?.description) errorMessage = error.response.data.error.description;
    else if (error.data?.message) errorMessage = error.data.message;
    else if (error.message) errorMessage = error.message;
    const orderIdFromError = error.response?.data?.metadata?.order_id || 'N/A_VERIFY_ERROR';
    const clientPlanIdFromError = error.response?.data?.metadata?.notes?.planId || 'UnknownPlan';
    const errorRedirectUrl = new URL(`${APP_BASE_URL}${Routes.paymentStatusPage(orderIdFromError, 'error', clientPlanIdFromError, errorMessage)}`);
    return NextResponse.redirect(errorRedirectUrl.toString(), 302);
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
