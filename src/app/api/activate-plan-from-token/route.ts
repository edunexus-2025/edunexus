
import { NextResponse, NextRequest } from 'next/server';
import PocketBase from 'pocketbase';
import type { UserSubscriptionTierStudent, UserSubscriptionTierTeacher, TeacherPlan as AppTeacherPlanType } from '@/lib/types';
import { teacherPlatformPlansData, AppConfig } from '@/lib/constants';
import { addYears, formatISO } from 'date-fns';


const POCKETBASE_URL_SERVER = process.env.NEXT_PUBLIC_POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL_SERVER = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD_SERVER = process.env.POCKETBASE_ADMIN_PASSWORD;

let pbAdminInstance: PocketBase | null = null;

async function getAdminPbInstance(): Promise<PocketBase | null> {
  if (pbAdminInstance && pbAdminInstance.authStore.isValid && pbAdminInstance.authStore.isAdmin) {
    return pbAdminInstance;
  }
  console.log(`[Activate Plan API INFO] getAdminPbInstance: Attempting to connect to PB for admin. URL: ${POCKETBASE_URL_SERVER || 'NOT SET'}`);
  if (POCKETBASE_URL_SERVER && POCKETBASE_ADMIN_EMAIL_SERVER && POCKETBASE_ADMIN_PASSWORD_SERVER) {
    const adminPb = new PocketBase(POCKETBASE_URL_SERVER);
    try {
      await adminPb.admins.authWithPassword(POCKETBASE_ADMIN_EMAIL_SERVER, POCKETBASE_ADMIN_PASSWORD_SERVER, { '$autoCancel': false });
      console.log("[Activate Plan API INFO] getAdminPbInstance: Successfully authenticated PocketBase admin client.");
      pbAdminInstance = adminPb;
      return adminPb;
    } catch (authError: any) {
      console.error("[Activate Plan API ERROR] getAdminPbInstance: CRITICAL - Failed to authenticate PB admin client. Details:", authError.data || authError.message, "Full Error:", authError);
      pbAdminInstance = null;
      return null;
    }
  }
  console.warn("[Activate Plan API WARN] getAdminPbInstance: PB admin credentials not fully configured.");
  pbAdminInstance = null;
  return null;
}

export async function POST(request: NextRequest) {
  const pbAdmin = await getAdminPbInstance();
  if (!pbAdmin) {
    console.error("[Activate Plan API ERROR] Critical server error: Database admin client could not be initialized. Plan activation cannot proceed. (PB_ADMIN_INIT_FAIL)");
    return NextResponse.json({ success: false, message: 'Critical server error: Database admin client could not be initialized. (PB_ADMIN_INIT_FAIL)' }, { status: 500 });
  }

  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, message: 'Activation token is missing or invalid.' }, { status: 400 });
    }

    console.log(`[Activate Plan API INFO] Searching for activation token: ${token.substring(0,10)}...`);
    const tokenRecord = await pbAdmin.collection('plan_activation_tokens').getFirstListItem(`token = "${token}"`, { '$autoCancel': false });
    console.log(`[Activate Plan API INFO] Token record found:`, JSON.parse(JSON.stringify(tokenRecord)));

    if (tokenRecord.used) {
      return NextResponse.json({ success: false, message: 'This activation link has already been used.' }, { status: 400 });
    }
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json({ success: false, message: 'This activation link has expired.' }, { status: 400 });
    }

    const userIdToUpdate = tokenRecord.user_id;
    const planIdToActivate = tokenRecord.plan_id_to_activate;
    const userTypeToUpdate = tokenRecord.user_type;
    const teacherIdForPlanContext = tokenRecord.teacher_id_for_plan; // if student_teacher_plan
    
    const now = new Date();
    const oneYearFromNowISO = formatISO(addYears(now, 1));


    if (userTypeToUpdate === 'student_platform_plan') {
      console.log(`[Activate Plan API INFO] Activating student platform plan: User ID ${userIdToUpdate}, Plan ${planIdToActivate}`);
      await pbAdmin.collection('users').update(userIdToUpdate, {
        model: planIdToActivate as UserSubscriptionTierStudent,
        expiry_date: oneYearFromNowISO,
      }, { '$autoCancel': false });
      console.log(`[Activate Plan API INFO] Student ${userIdToUpdate} platform plan updated to ${planIdToActivate}.`);
    } else if (userTypeToUpdate === 'teacher_platform_plan') {
      const planDetails = teacherPlatformPlansData.find(p => p.id === planIdToActivate);
      console.log(`[Activate Plan API INFO] Activating teacher platform plan: Teacher ID ${userIdToUpdate}, Plan ${planIdToActivate}`);
      await pbAdmin.collection('teacher_data').update(userIdToUpdate, {
        teacherSubscriptionTier: planIdToActivate as UserSubscriptionTierTeacher,
        max_content_plans_allowed: planDetails?.maxContentPlans,
        // expiry_date for teacher platform plan might be handled differently or not at all
      }, { '$autoCancel': false });
       console.log(`[Activate Plan API INFO] Teacher ${userIdToUpdate} platform plan updated to ${planIdToActivate}.`);
    } else if (userTypeToUpdate === 'student_teacher_plan') {
      if (!teacherIdForPlanContext) {
        console.error(`[Activate Plan API ERROR] teacher_id_for_plan is missing for student_teacher_plan activation. Token ID: ${tokenRecord.id}`);
        return NextResponse.json({ success: false, message: 'Configuration error: Teacher ID missing for this plan type.' }, { status: 500 });
      }
      console.log(`[Activate Plan API INFO] Activating student subscription to teacher's plan: Student ID ${userIdToUpdate}, Teacher ID ${teacherIdForPlanContext}, Teacher's Plan ID ${planIdToActivate}`);
      
      // 1. Create record in students_teachers_upgrade_plan
      const studentTeacherPlanData = {
        student: userIdToUpdate,
        teacher: teacherIdForPlanContext,
        teachers_plan_id: planIdToActivate, // This is the ID of the plan from 'teachers_upgrade_plan'
        payment_status: 'successful',
        starting_date: now.toISOString(),
        expiry_date: oneYearFromNowISO,
        amount_paid_to_edunexus: 0, // Placeholder, actual financials should be from Razorpay order notes if needed
        amount_recieved_to_teacher: tokenRecord.original_amount || 0, // Placeholder
        referral_code_used: tokenRecord.referral_code_used || null,
        payment_id_razorpay: tokenRecord.order_id, // Using order_id as a reference here
        order_id_razorpay: tokenRecord.order_id,
      };
      const createdSubRecord = await pbAdmin.collection('students_teachers_upgrade_plan').create(studentTeacherPlanData, { '$autoCancel': false });
      console.log(`[Activate Plan API INFO] Created students_teachers_upgrade_plan record ID: ${createdSubRecord.id}`);

      // 2. Update student's record to link to the teacher
      await pbAdmin.collection('users').update(userIdToUpdate, { "subscription_by_teacher+": teacherIdForPlanContext }, { '$autoCancel': false });
      console.log(`[Activate Plan API INFO] Added teacher ${teacherIdForPlanContext} to student ${userIdToUpdate}'s subscriptions.`);

      // 3. Update teacher's plan record to add the student
      await pbAdmin.collection('teachers_upgrade_plan').update(planIdToActivate, { "enrolled_students+": userIdToUpdate }, { '$autoCancel': false });
      console.log(`[Activate Plan API INFO] Added student ${userIdToUpdate} to teacher's plan ${planIdToActivate}.`);
      
      // 4. Update teacher's wallet (Simplified - assumes no commission split for now)
      const teacherWalletUpdate = await pbAdmin.collection('teacher_data').getOne(teacherIdForPlanContext, { fields: 'wallet_money', '$autoCancel': false });
      const currentTeacherWallet = Number(teacherWalletUpdate.wallet_money) || 0;
      const amountToAdd = Number(tokenRecord.original_amount) || 0;
      await pbAdmin.collection('teacher_data').update(teacherIdForPlanContext, { wallet_money: currentTeacherWallet + amountToAdd }, { '$autoCancel': false });
      console.log(`[Activate Plan API INFO] Updated teacher ${teacherIdForPlanContext} wallet. Old: ${currentTeacherWallet}, Added: ${amountToAdd}, New: ${currentTeacherWallet + amountToAdd}`);

    } else {
      console.warn(`[Activate Plan API WARN] Unrecognized user_type: ${userTypeToUpdate} in token ID: ${tokenRecord.id}. Cannot update plan.`);
      return NextResponse.json({ success: false, message: `Activation for user type "${userTypeToUpdate}" is not configured.` }, { status: 400 });
    }

    await pbAdmin.collection('plan_activation_tokens').update(tokenRecord.id, { used: true }, { '$autoCancel': false });
    console.log(`[Activate Plan API INFO] Token ${tokenRecord.id} marked as used.`);

    return NextResponse.json({ success: true, message: `Plan "${planIdToActivate}" activated successfully!` }, { status: 200 });

  } catch (error: any) {
    console.error("[Activate Plan API ERROR] General error processing activation token:", error.data || error.message, "Full Error:", error);
    if (error.status === 404) {
      return NextResponse.json({ success: false, message: 'Activation link invalid, expired, or not found.' }, { status: 404 });
    }
    const errorMessage = error.data?.message || error.message || 'Server error during plan activation.';
    return NextResponse.json({ success: false, message: `Plan activation failed: ${errorMessage}` }, { status: 500 });
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
    