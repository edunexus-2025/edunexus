
import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import PocketBase from 'pocketbase';
import { AppConfig, teacherPlatformPlansData } from '@/lib/constants';
import type { UserSubscriptionTierStudent, UserSubscriptionTierTeacher } from '@/lib/types';

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const POCKETBASE_URL_SERVER = process.env.NEXT_PUBLIC_POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL_SERVER = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD_SERVER = process.env.POCKETBASE_ADMIN_PASSWORD;

if (!RAZORPAY_KEY_SECRET) {
  console.error("CRITICAL: RAZORPAY_KEY_SECRET is not configured on the server.");
}
if (!POCKETBASE_URL_SERVER || !POCKETBASE_ADMIN_EMAIL_SERVER || !POCKETBASE_ADMIN_PASSWORD_SERVER) {
  console.error("CRITICAL: PocketBase Admin credentials or URL not fully configured for server-side updates.");
}

const instance = new Razorpay({
  key_id: RAZORPAY_KEY_ID!,
  key_secret: RAZORPAY_KEY_SECRET!,
});

async function getAdminPbInstance(): Promise<PocketBase | null> {
  if (POCKETBASE_URL_SERVER && POCKETBASE_ADMIN_EMAIL_SERVER && POCKETBASE_ADMIN_PASSWORD_SERVER) {
    const adminPb = new PocketBase(POCKETBASE_URL_SERVER);
    try {
      await adminPb.admins.authWithPassword(POCKETBASE_ADMIN_EMAIL_SERVER, POCKETBASE_ADMIN_PASSWORD_SERVER);
      console.log("[Razorpay Verify Payment INFO] Successfully authenticated PocketBase admin client.");
      return adminPb;
    } catch (authError) {
      console.error("[Razorpay Verify Payment ERROR] CRITICAL: Failed to authenticate PocketBase admin client:", authError);
      return null;
    }
  }
  console.warn("[Razorpay Verify Payment WARN] PocketBase admin credentials not fully configured. DB updates might fail due to restrictive rules.");
  return null;
}

export async function POST(request: NextRequest) {
  if (!RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ verified: false, error: "Payment gateway server secret not configured." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      planId, 
      userId, 
      userType, 
      teacherIdForPlan, 
      referralCodeUsed,
      productDescription,
    } = body;

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature || !planId || !userId || !userType) {
      return NextResponse.json({ verified: false, error: "Missing required payment verification details." }, { status: 400 });
    }

    const textToHash = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto
      .createHmac('sha256', RAZORPAY_KEY_SECRET)
      .update(textToHash)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.warn(`[Razorpay Verify Payment WARN] Signature mismatch. Generated: ${generated_signature}, Received: ${razorpay_signature}`);
      return NextResponse.json({ verified: false, error: "Invalid payment signature. Payment verification failed." }, { status: 400 });
    }

    console.log(`[Razorpay Verify Payment INFO] Signature verified. Fetching order details for order_id: ${razorpay_order_id}`);
    const orderDetailsFromRazorpay = await instance.orders.fetch(razorpay_order_id);
    console.log("[Razorpay Verify Payment INFO] Order details from Razorpay:", orderDetailsFromRazorpay);

    if (String(orderDetailsFromRazorpay.notes.userId) !== String(userId) ||
        String(orderDetailsFromRazorpay.notes.planId) !== String(planId) ||
        String(orderDetailsFromRazorpay.notes.userType) !== String(userType) ||
        (userType === 'student_teacher_plan' && String(orderDetailsFromRazorpay.notes.teacherIdForPlan) !== String(teacherIdForPlan))) {
      console.error("[Razorpay Verify Payment ERROR] Mismatch between client notes and Razorpay order notes.", { clientNotes: body, razorpayNotes: orderDetailsFromRazorpay.notes });
      return NextResponse.json({ verified: false, error: "Order details mismatch. Verification failed." }, { status: 400 });
    }
    if (orderDetailsFromRazorpay.status !== 'paid') {
      console.warn(`[Razorpay Verify Payment WARN] Order status is not 'paid'. Status: ${orderDetailsFromRazorpay.status}`);
      return NextResponse.json({ verified: false, error: `Payment not completed successfully. Status: ${orderDetailsFromRazorpay.status}` }, { status: 400 });
    }

    const pbAdmin = await getAdminPbInstance();
    if (!pbAdmin) {
      return NextResponse.json({ verified: false, error: "Database admin client could not be initialized. Cannot update records." }, { status: 500 });
    }

    const today = new Date();
    const expiryDateISO = new Date(today.setFullYear(today.getFullYear() + 1)).toISOString(); 

    if (userType === 'student_platform_plan') {
      console.log(`[Razorpay Verify Payment INFO] Attempting to update student ${userId} platform plan to ${planId}.`);
      await pbAdmin.collection('users').update(userId, { model: planId as UserSubscriptionTierStudent, expiry_date: expiryDateISO });
      console.log(`[Razorpay Verify Payment SUCCESS] Student ${userId} platform plan updated to ${planId}.`);
    } else if (userType === 'teacher_platform_plan') {
      const planDetails = teacherPlatformPlansData.find(p => p.id === planId);
      console.log(`[Razorpay Verify Payment INFO] Attempting to update teacher ${userId} platform plan to ${planId}. Details:`, planDetails);
      await pbAdmin.collection('teacher_data').update(userId, { 
        teacherSubscriptionTier: planId as UserSubscriptionTierTeacher,
        max_content_plans_allowed: planDetails?.maxContentPlans ?? 0,
      });
      console.log(`[Razorpay Verify Payment SUCCESS] Teacher ${userId} platform plan updated to ${planId}.`);
    } else if (userType === 'student_teacher_plan') {
      if (!teacherIdForPlan) { 
        return NextResponse.json({ verified: false, error: "teacherIdForPlan missing for student_teacher_plan type." }, { status: 400 });
      }
      console.log(`[Razorpay Verify Payment INFO] Processing 'student_teacher_plan' for student ${userId}, teacher ${teacherIdForPlan}, plan ${planId}.`);
      
      const teacherRecord = await pbAdmin.collection('teacher_data').getOne(teacherIdForPlan);
      const teacherPlatformTier = teacherRecord.teacherSubscriptionTier as UserSubscriptionTierTeacher || 'Free';
      const platformPlanDetails = teacherPlatformPlansData.find(p => p.id === teacherPlatformTier);
      const commissionRate = platformPlanDetails?.commissionRate !== undefined ? platformPlanDetails.commissionRate / 100 : 0.10; 

      const totalAmountPaidByStudent = orderDetailsFromRazorpay.amount / 100; 
      const edunexusCommissionAmount = totalAmountPaidByStudent * commissionRate;
      const teacherNetShare = totalAmountPaidByStudent - edunexusCommissionAmount;

      const teacherContentPlanRecord = await pbAdmin.collection('teachers_upgrade_plan').getOne(planId); 

      console.log(`[Razorpay Verify Payment INFO] Creating record in 'students_teachers_upgrade_plan'...`);
      await pbAdmin.collection('students_teachers_upgrade_plan').create({
        student: userId, 
        teacher: teacherIdForPlan, 
        teachers_plan_id: planId, 
        teachers_plan_name_cache: teacherContentPlanRecord.Plan_name,
        payment_id_razorpay: razorpay_payment_id,
        order_id_razorpay: razorpay_order_id,
        payment_status: 'successful',
        starting_date: new Date().toISOString(),
        expiry_date: expiryDateISO,
        amount_paid_to_edunexus: edunexusCommissionAmount, 
        amount_recieved_to_teacher: teacherNetShare, 
        referral_code_used: referralCodeUsed || null,
      });
      console.log(`[Razorpay Verify Payment SUCCESS] Record created in 'students_teachers_upgrade_plan'.`);

      console.log(`[Razorpay Verify Payment INFO] Updating student ${userId}'s 'subscription_by_teacher' field...`);
      await pbAdmin.collection('users').update(userId, { "subscription_by_teacher+": teacherIdForPlan });
      console.log(`[Razorpay Verify Payment SUCCESS] Student ${userId}'s 'subscription_by_teacher' updated.`);

      console.log(`[Razorpay Verify Payment INFO] Updating teacher plan ${planId}'s 'enrolled_students' field...`);
      await pbAdmin.collection('teachers_upgrade_plan').update(planId, { "enrolled_students+": userId });
      console.log(`[Razorpay Verify Payment SUCCESS] Teacher plan ${planId}'s 'enrolled_students' updated.`);

      console.log(`[Razorpay Verify Payment INFO] Updating teacher ${teacherIdForPlan}'s 'wallet_money'...`);
      const currentTeacherData = await pbAdmin.collection('teacher_data').getOne(teacherIdForPlan);
      const currentWalletMoney = Number(currentTeacherData.wallet_money) || 0;
      const newWalletMoney = currentWalletMoney + teacherNetShare;
      await pbAdmin.collection('teacher_data').update(teacherIdForPlan, { wallet_money: newWalletMoney });
      console.log(`[Razorpay Verify Payment SUCCESS] Teacher ${teacherIdForPlan}'s wallet_money updated to ${newWalletMoney}. Net share: ${teacherNetShare}`);

    } else {
      return NextResponse.json({ verified: false, error: "Invalid userType for payment." }, { status: 400 });
    }

    return NextResponse.json({ verified: true, message: "Payment successfully verified and processed." }, { status: 200 });

  } catch (error: any) {
    console.error("[Razorpay Verify Payment CRITICAL ERROR] (Outer Try-Catch):", error.response ? error.response.data : error.message, "Full Error:", error);
    let errorMessage = "Payment verification failed due to a server error.";
    if (error.response && error.response.data && error.response.data.error && error.response.data.error.description) { // Razorpay specific error structure
      errorMessage = error.response.data.error.description;
    } else if (error.data && error.data.message) { // PocketBase specific error structure
       errorMessage = error.data.message;
       if(error.data.data && typeof error.data.data === 'object') {
           const fieldErrors = Object.entries(error.data.data).map(([key, val]: [string, any]) => `${key}: ${val.message}`).join('; ');
           if (fieldErrors) errorMessage += ` Details: ${fieldErrors}`;
       }
    } else if (error.message) {
      errorMessage = error.message;
    }
    return NextResponse.json({ verified: false, error: errorMessage }, { status: 500 });
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
