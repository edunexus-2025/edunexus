
import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import PocketBase from 'pocketbase';
import { AppConfig, Routes, slugify, escapeForPbFilter } from '@/lib/constants';
import type { UserSubscriptionTierStudent, UserSubscriptionTierTeacher, TeacherPlan, User } from '@/lib/types'; // Added TeacherPlan and User
import { addMinutes, formatISO } from 'date-fns';


const POCKETBASE_URL_SERVER = process.env.NEXT_PUBLIC_POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL_SERVER = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD_SERVER = process.env.POCKETBASE_ADMIN_PASSWORD;

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:9002';

let pbAdminInstance: PocketBase | null = null;

async function getAdminPbInstance(): Promise<PocketBase | null> {
  if (pbAdminInstance && pbAdminInstance.authStore.isValid && pbAdminInstance.authStore.isAdmin) {
    return pbAdminInstance;
  }
  console.log(`[Razorpay Verify API INFO] getAdminPbInstance: Attempting to connect to PB for admin. URL: ${POCKETBASE_URL_SERVER || 'NOT SET'}`);
  if (POCKETBASE_URL_SERVER && POCKETBASE_ADMIN_EMAIL_SERVER && POCKETBASE_ADMIN_PASSWORD_SERVER) {
    const adminPb = new PocketBase(POCKETBASE_URL_SERVER);
    try {
      await adminPb.admins.authWithPassword(POCKETBASE_ADMIN_EMAIL_SERVER, POCKETBASE_ADMIN_PASSWORD_SERVER, { '$autoCancel': false });
      console.log("[Razorpay Verify API INFO] getAdminPbInstance: Successfully authenticated PocketBase admin client.");
      pbAdminInstance = adminPb;
      return adminPb;
    } catch (authError: any) {
      console.error("[Razorpay Verify API ERROR] getAdminPbInstance: CRITICAL - Failed to authenticate PB admin client. Details:", authError.data || authError.message, "Full Error:", authError);
      pbAdminInstance = null; // Ensure instance is null on failure
      return null;
    }
  }
  console.warn("[Razorpay Verify API WARN] getAdminPbInstance: PB admin credentials not fully configured.");
  pbAdminInstance = null; // Ensure instance is null
  return null;
}

const razorpayInstance = RAZORPAY_KEY_SECRET ? new Razorpay({
  key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID!,
  key_secret: RAZORPAY_KEY_SECRET,
}) : null;


export async function POST(request: NextRequest) {
  let orderIdFromRequest: string | null = null;
  let clientPlanIdForLog: string | null = null;

  if (!RAZORPAY_KEY_SECRET || !razorpayInstance) {
    console.error("[Razorpay Verify API ERROR] CRITICAL: Razorpay Key Secret not configured or Razorpay instance failed to initialize.");
    return NextResponse.json({ verified: false, error: 'Payment gateway server misconfiguration.', status: 'error' }, { status: 500 });
  }
  
  const pbAdmin = await getAdminPbInstance();
  if (!pbAdmin) {
    console.error("[Razorpay Verify API ERROR] CRITICAL: Failed to initialize PocketBase Admin Client. Cannot proceed with creating activation token.");
    return NextResponse.json({ 
        verified: false, 
        error: 'Server error: Could not initialize database admin access for plan activation token. (PB_ADMIN_INIT_FAIL)', 
        status: 'error' 
    }, { status: 500 });
  }


  try {
    const body = await request.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      planId: clientPlanId,
      userId: clientUserId,
      userType: clientUserType,
      teacherIdForPlan: clientTeacherIdForPlan,
      referralCodeUsed: clientReferralCodeUsed,
      productDescription: clientProductDescription
    } = body;

    orderIdFromRequest = razorpay_order_id;
    clientPlanIdForLog = clientPlanId;

    console.log("[Razorpay Verify API INFO] Received verification request. Client-provided context:", { clientPlanId, clientUserId, clientUserType, clientTeacherIdForPlan, clientReferralCodeUsed, razorpay_order_id });

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json({ verified: false, error: 'Missing Razorpay payment verification details.', status: 'failure' }, { status: 400 });
    }
    if (!clientPlanId || !clientUserId || !clientUserType) {
      return NextResponse.json({ verified: false, error: "Missing client context (planId, userId, or userType).", status: 'failure' }, { status: 400 });
    }
    if (clientUserType === 'student_teacher_plan' && !clientTeacherIdForPlan) {
      return NextResponse.json({ verified: false, error: "Missing teacherIdForPlan for 'student_teacher_plan' type.", status: 'failure' }, { status: 400 });
    }

    const textToHash = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(textToHash).digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.warn(`[Razorpay Verify API WARN] Signature mismatch for order ${razorpay_order_id}.`);
      return NextResponse.json({ verified: false, error: "Payment verification failed (security check).", status: 'failure' }, { status: 400 });
    }
    console.log(`[Razorpay Verify API INFO] Signature verified successfully for order ${razorpay_order_id}.`);

    let orderDetailsFromRazorpay;
    try {
      orderDetailsFromRazorpay = await razorpayInstance.orders.fetch(razorpay_order_id);
      console.log("[Razorpay Verify API INFO] Fetched order details from Razorpay:", orderDetailsFromRazorpay);
    } catch (fetchError: any) {
      console.error(`[Razorpay Verify API ERROR] Failed to fetch order ${razorpay_order_id} from Razorpay:`, fetchError);
      return NextResponse.json({ verified: false, error: `Failed to fetch order details: ${fetchError.error?.description || fetchError.message}.`, status: 'error' }, { status: 500 });
    }

    const notes = orderDetailsFromRazorpay.notes;
    if (!notes || typeof notes !== 'object') {
      console.error(`[Razorpay Verify API ERROR] Razorpay order ${razorpay_order_id} missing 'notes'.`);
      return NextResponse.json({ verified: false, error: "Order details incomplete (missing notes).", status: 'error' }, { status: 400 });
    }

    const serverPlanId = String(notes.planId);
    const serverUserId = String(notes.userId);
    const serverUserType = String(notes.userType);
    const serverTeacherIdForPlan = notes.teacherIdForPlan ? String(notes.teacherIdForPlan) : undefined;
    
    if (serverUserId !== String(clientUserId) || serverPlanId !== String(clientPlanId) || serverUserType !== String(clientUserType) || (clientUserType === 'student_teacher_plan' && serverTeacherIdForPlan !== String(clientTeacherIdForPlan))) {
      console.error("[Razorpay Verify API ERROR] Mismatch between client context and Razorpay order notes.", { client: { clientUserId, clientPlanId, clientUserType, clientTeacherIdForPlan }, serverNotes: { serverUserId, serverPlanId, serverUserType, serverTeacherIdForPlan } });
      return NextResponse.json({ verified: false, error: "Order context mismatch.", status: 'error' }, { status: 400 });
    }
    console.log("[Razorpay Verify API INFO] Client context matches Razorpay order notes.");

    if (orderDetailsFromRazorpay.status !== 'paid') {
      console.warn(`[Razorpay Verify API WARN] Razorpay order ${razorpay_order_id} status is '${orderDetailsFromRazorpay.status}', not 'paid'.`);
      return NextResponse.json({ verified: false, error: `Payment not completed successfully. Status: ${orderDetailsFromRazorpay.status}`, status: 'failure' }, { status: 400 });
    }
    console.log(`[Razorpay Verify API INFO] Payment for order ${razorpay_order_id} is authentic and status is 'paid'.`);

    // Create Activation Token
    const activationToken = crypto.randomBytes(32).toString('hex');
    const expiryTime = addMinutes(new Date(), 60); // Token valid for 60 minutes

    const tokenData = {
      token: activationToken,
      user_id: serverUserId,
      plan_id_to_activate: serverPlanId,
      order_id: razorpay_order_id,
      user_type: serverUserType, // Store user type for activation logic
      teacher_id_for_plan: serverUserType === 'student_teacher_plan' ? serverTeacherIdForPlan : null,
      referral_code_used: clientReferralCodeUsed || null,
      original_amount: orderDetailsFromRazorpay.amount / 100, // Store original amount in base currency
      currency: orderDetailsFromRazorpay.currency,
      product_description: notes.productDescription || `Payment for plan ${serverPlanId}`,
      expires_at: formatISO(expiryTime),
      used: false,
    };

    console.log("[Razorpay Verify API INFO] Creating plan_activation_tokens record with data:", JSON.stringify(tokenData));
    await pbAdmin.collection('plan_activation_tokens').create(tokenData, { '$autoCancel': false });
    console.log(`[Razorpay Verify API INFO] Activation token ${activationToken.substring(0,10)}... created for order ${razorpay_order_id}.`);

    // Get plan name for slug
    let planSlugForRedirect = slugify(serverPlanId);
    if (serverUserType === 'student_platform_plan') {
      const planDetails = AppConfig.studentPlansData.find(p => p.id === serverPlanId);
      if (planDetails?.name) planSlugForRedirect = slugify(planDetails.name);
    } else if (serverUserType === 'teacher_platform_plan') {
      const planDetails = AppConfig.teacherPlatformPlansData.find(p => p.id === serverPlanId);
      if (planDetails?.name) planSlugForRedirect = slugify(planDetails.name);
    } else if (serverUserType === 'student_teacher_plan') {
      // For student_teacher_plan, planId is the ID of teachers_upgrade_plan record
      try {
        const teacherPlanRecord = await pbAdmin.collection('teachers_upgrade_plan').getOne(serverPlanId, { fields: 'Plan_name' });
        if (teacherPlanRecord.Plan_name) planSlugForRedirect = slugify(teacherPlanRecord.Plan_name);
      } catch (planFetchError) {
        console.warn(`[Razorpay Verify API WARN] Could not fetch teacher's plan name for slug, using ID. Plan ID: ${serverPlanId}`, planFetchError);
      }
    }
    
    const successRedirectUrl = new URL(`${APP_BASE_URL}${Routes.activatePlan(activationToken, planSlugForRedirect)}`);
    // No query params needed as the activation page gets info from token
    console.log(`[Razorpay Verify API INFO] Redirecting to activation URL: ${successRedirectUrl.toString()}`);
    return NextResponse.redirect(successRedirectUrl.toString(), 302);

  } catch (error: any) {
    console.error("[Razorpay Verify API CRITICAL ERROR] (Outer Try-Catch):", error);
    let errorMessage = "Payment verification process failed due to a server error.";
    if (error.statusCode && error.error && error.error.description) { errorMessage = error.error.description; }
    else if (error.message) { errorMessage = error.message; }
    
    const failureRedirectUrl = new URL(`${APP_BASE_URL}${Routes.paymentStatusPage(orderIdFromRequest || 'UNKNOWN_ORDER', 'error', clientPlanIdForLog || 'unknown_plan', errorMessage)}`);
    return NextResponse.redirect(failureRedirectUrl.toString(), 302);
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

    