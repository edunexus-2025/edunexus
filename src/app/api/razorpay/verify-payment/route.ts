
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
      userType, // 'student_platform_plan', 'teacher_platform_plan', 'student_teacher_plan'
      teacherIdForPlan, // Only for 'student_teacher_plan'
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
      await pbAdmin.collection('users').update(userId, { model: planId as UserSubscriptionTierStudent, expiry_date: expiryDateISO });
      console.log(`[Razorpay Verify Payment INFO] Student ${userId} platform plan updated to ${planId}.`);
    } else if (userType === 'teacher_platform_plan') {
      const planDetails = teacherPlatformPlansData.find(p => p.id === planId);
      await pbAdmin.collection('teacher_data').update(userId, { 
        teacherSubscriptionTier: planId as UserSubscriptionTierTeacher,
        max_content_plans_allowed: planDetails?.maxContentPlans ?? 0,
      });
      console.log(`[Razorpay Verify Payment INFO] Teacher ${userId} platform plan updated to ${planId}.`);
    } else if (userType === 'student_teacher_plan') {
      if (!teacherIdForPlan) {
        return NextResponse.json({ verified: false, error: "teacherIdForPlan missing for student_teacher_plan type." }, { status: 400 });
      }
      const teacherRecord = await pbAdmin.collection('teacher_data').getOne(teacherIdForPlan);
      const teacherPlatformTier = teacherRecord.teacherSubscriptionTier as UserSubscriptionTierTeacher || 'Free';
      const platformPlanDetails = teacherPlatformPlansData.find(p => p.id === teacherPlatformTier);
      const commissionRate = platformPlanDetails?.commissionRate !== undefined ? platformPlanDetails.commissionRate / 100 : 0.10; // Default 10% if not found

      const totalAmountPaidByStudent = orderDetailsFromRazorpay.amount / 100; // Amount in rupees
      const edunexusCommissionAmount = totalAmountPaidByStudent * commissionRate;
      const teacherNetShare = totalAmountPaidByStudent - edunexusCommissionAmount;

      const teacherContentPlanRecord = await pbAdmin.collection('teachers_upgrade_plan').getOne(planId);

      await pbAdmin.collection('students_teachers_upgrade_plan').create({
        student: userId,
        teacher: teacherIdForPlan,
        teachers_plan_id: planId,
        teachers_plan_name_cache: teacherContentPlanRecord.Plan_name,
        payment_id_razorpay: razorpay_payment_id,
        order_id_razorpay: razorpay_order_id, // Storing Razorpay order_id
        payment_status: 'successful',
        starting_date: new Date().toISOString(),
        expiry_date: expiryDateISO,
        amount_paid_to_edunexus: totalAmountPaidByStudent, // Total amount paid by student
        amount_recieved_to_teacher: teacherNetShare, // Net amount for teacher
        referral_code_used: referralCodeUsed || null,
      });
      console.log(`[Razorpay Verify Payment INFO] Student ${userId} subscribed to teacher ${teacherIdForPlan}'s plan ${planId}.`);

      await pbAdmin.collection('users').update(userId, { "subscription_by_teacher+": teacherIdForPlan });
      await pbAdmin.collection('teachers_upgrade_plan').update(planId, { "enrolled_students+": userId });

      await pbAdmin.collection('teacher_wallet').create({
        teacher: teacherIdForPlan,
        total_amount_recieved: teacherNetShare, // This is the net amount after commission
        by_which_plan_recieved: planId, // Corrected field name
        transaction_date: new Date().toISOString(),
        transaction_details: `Payment from student ${userId.substring(0,7)}... for plan "${teacherContentPlanRecord.Plan_name}". Razorpay Order: ${razorpay_order_id.substring(0,10)}...`,
        // student_histroy field links to the students_teachers_upgrade_plan record,
        // Assuming the 'teacher_wallet' table has a relation field named 'student_histroy'
        // If not, this part needs adjustment or the field needs to be created.
        // Let's assume it exists for now. We'd need the ID of the created students_teachers_upgrade_plan record.
        // For simplicity, we'll omit linking it directly here unless it's critical and the ID is available.
      });
      console.log(`[Razorpay Verify Payment INFO] Teacher wallet updated for teacher ${teacherIdForPlan}. Net share: ${teacherNetShare}`);
    } else {
      return NextResponse.json({ verified: false, error: "Invalid userType for payment." }, { status: 400 });
    }

    return NextResponse.json({ verified: true, message: "Payment successfully verified and processed." }, { status: 200 });

  } catch (error: any) {
    console.error("[Razorpay Verify Payment CRITICAL ERROR] (Outer Try-Catch):", error);
    let errorMessage = "Payment verification failed due to a server error.";
    if (error.error && error.error.description) {
      errorMessage = error.error.description;
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
    