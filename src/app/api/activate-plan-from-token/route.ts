
import { NextResponse, NextRequest } from 'next/server';
import PocketBase from 'pocketbase';
import type { UserSubscriptionTierStudent, UserSubscriptionTierTeacher } from '@/lib/types';
import { teacherPlatformPlansData } from '@/lib/constants'; // For teacher plan details

const POCKETBASE_URL_SERVER = process.env.NEXT_PUBLIC_POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL_SERVER = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD_SERVER = process.env.POCKETBASE_ADMIN_PASSWORD;

async function getAdminPbInstance(): Promise<PocketBase | null> {
  console.log(`[Activate Plan API INFO] Attempting to connect to PB URL for admin: ${POCKETBASE_URL_SERVER || 'NOT SET'}`);
  if (POCKETBASE_URL_SERVER && POCKETBASE_ADMIN_EMAIL_SERVER && POCKETBASE_ADMIN_PASSWORD_SERVER) {
    const adminPb = new PocketBase(POCKETBASE_URL_SERVER);
    try {
      await adminPb.admins.authWithPassword(POCKETBASE_ADMIN_EMAIL_SERVER, POCKETBASE_ADMIN_PASSWORD_SERVER);
      console.log("[Activate Plan API INFO] Successfully authenticated PocketBase admin client.");
      return adminPb;
    } catch (authError: any) {
      console.error("[Activate Plan API ERROR] CRITICAL: Failed to authenticate PB admin client. Details:", authError.data || authError.message);
      return null;
    }
  }
  console.warn("[Activate Plan API WARN] PB admin credentials not fully configured.");
  return null;
}

export async function POST(request: NextRequest) {
  const { token } = await request.json();

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ success: false, message: 'Activation token is missing or invalid.' }, { status: 400 });
  }

  const pbAdmin = await getAdminPbInstance();
  if (!pbAdmin) {
    console.error("[Activate Plan API ERROR] Database admin client not initialized. Cannot process activation.");
    return NextResponse.json({ success: false, message: 'Server configuration error (DB_ADMIN_ACTIVATE_FAIL). Plan update cannot proceed.' }, { status: 500 });
  }

  try {
    console.log(`[Activate Plan API INFO] Searching for activation token: ${token.substring(0,10)}...`);
    const tokenRecord = await pbAdmin.collection('plan_activation_tokens').getFirstListItem(`token = "${token}"`);
    console.log(`[Activate Plan API INFO] Token record found:`, tokenRecord);

    if (tokenRecord.used) {
      return NextResponse.json({ success: false, message: 'This activation link has already been used.' }, { status: 400 });
    }
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json({ success: false, message: 'This activation link has expired.' }, { status: 400 });
    }

    const userIdToUpdate = tokenRecord.user_id;
    const planIdToActivate = tokenRecord.plan_id_to_activate;

    // Determine which collection and fields to update based on plan type
    // For simplicity, this example assumes plans like "Combo", "Chapterwise" are for 'users' collection
    // and "Starter", "Pro" for 'teacher_data'. This logic might need refinement based on your actual plan IDs.

    let collectionToUpdate: 'users' | 'teacher_data' | null = null;
    let updatePayload: Record<string, any> = {};
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); // Example: 1 year expiry

    const studentPlanIds: UserSubscriptionTierStudent[] = ['Free', 'Chapterwise', 'Full_length', 'Dpp', 'Combo'];
    const teacherPlanIds: UserSubscriptionTierTeacher[] = ['Free', 'Starter', 'Pro']; // Teacher platform plans

    if (studentPlanIds.includes(planIdToActivate as UserSubscriptionTierStudent)) {
      collectionToUpdate = 'users';
      updatePayload = {
        model: planIdToActivate as UserSubscriptionTierStudent,
        expiry_date: expiryDate.toISOString(),
      };
      console.log(`[Activate Plan API INFO] Activating student plan: User ID ${userIdToUpdate}, Plan ${planIdToActivate}`);
    } else if (teacherPlanIds.includes(planIdToActivate as UserSubscriptionTierTeacher)) {
      collectionToUpdate = 'teacher_data';
      const planDetails = teacherPlatformPlansData.find(p => p.id === planIdToActivate);
      updatePayload = {
        teacherSubscriptionTier: planIdToActivate as UserSubscriptionTierTeacher,
        max_content_plans_allowed: planDetails?.maxContentPlans,
        // Teachers might not have an 'expiry_date' field for platform plans, or it's handled differently.
        // Add expiry_date if your teacher_data schema has it for platform plans.
      };
       console.log(`[Activate Plan API INFO] Activating teacher plan: Teacher ID ${userIdToUpdate}, Plan ${planIdToActivate}`);
    } else {
        // This case is for when a student subscribes to a specific teacher's content plan.
        // The 'plan_id_to_activate' would be the ID of a record in 'teachers_upgrade_plan'.
        // The main user's 'model' or 'teacherSubscriptionTier' does not change here.
        // The creation of the 'students_teachers_upgrade_plan' record is the activation.
        // This API route currently focuses on platform plan upgrades.
        // For student_teacher_plan subscriptions, this activation token flow might need adjustment,
        // or the record in 'students_teachers_upgrade_plan' could be created here instead of directly
        // in verify-payment if that's desired.
        // For now, we assume this token flow is for platform-level plan changes for 'users' or 'teacher_data'.
        console.warn(`[Activate Plan API WARN] Unrecognized planIdToActivate: ${planIdToActivate}. Cannot determine collection for update. This may indicate a 'student_teacher_plan' flow not fully handled here yet.`);
         return NextResponse.json({ success: false, message: `Activation for plan type "${planIdToActivate}" is not fully configured with this token method.` }, { status: 400 });
    }


    if (collectionToUpdate) {
        await pbAdmin.collection(collectionToUpdate).update(userIdToUpdate, updatePayload);
        console.log(`[Activate Plan API INFO] User/Teacher record ${userIdToUpdate} updated in collection ${collectionToUpdate}.`);
    }


    // Mark token as used
    await pbAdmin.collection('plan_activation_tokens').update(tokenRecord.id, { used: true });
    console.log(`[Activate Plan API INFO] Token ${tokenRecord.id} marked as used.`);

    return NextResponse.json({ success: true, message: `Plan "${planIdToActivate}" activated successfully!` }, { status: 200 });

  } catch (error: any) {
    console.error("[Activate Plan API ERROR] Failed to process activation token:", error.data || error.message, "Full Error:", error);
    if (error.status === 404) {
      return NextResponse.json({ success: false, message: 'Activation link invalid or expired.' }, { status: 404 });
    }
    return NextResponse.json({ success: false, message: `Activation failed: ${error.data?.message || error.message || 'Server error'}` }, { status: 500 });
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
    