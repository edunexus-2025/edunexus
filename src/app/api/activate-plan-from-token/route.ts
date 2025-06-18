
import { NextResponse, NextRequest } from 'next/server';
import PocketBase from 'pocketbase';
import type { UserSubscriptionTierStudent, UserSubscriptionTierTeacher } from '@/lib/types';
import { teacherPlatformPlansData } from '@/lib/constants'; // For teacher plan details

const POCKETBASE_URL_SERVER = process.env.NEXT_PUBLIC_POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL_SERVER = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD_SERVER = process.env.POCKETBASE_ADMIN_PASSWORD;

async function getAdminPbInstance(): Promise<PocketBase | null> {
  console.log(`[Activate Plan From Token API INFO] Attempting to connect to PB URL for admin: ${POCKETBASE_URL_SERVER || 'NOT SET'}`);
  if (POCKETBASE_URL_SERVER && POCKETBASE_ADMIN_EMAIL_SERVER && POCKETBASE_ADMIN_PASSWORD_SERVER) {
    const adminPb = new PocketBase(POCKETBASE_URL_SERVER);
    try {
      await adminPb.admins.authWithPassword(POCKETBASE_ADMIN_EMAIL_SERVER, POCKETBASE_ADMIN_PASSWORD_SERVER);
      console.log("[Activate Plan From Token API INFO] Successfully authenticated PocketBase admin client.");
      return adminPb;
    } catch (authError: any) {
      console.error("[Activate Plan From Token API ERROR] CRITICAL: Failed to authenticate PB admin client. Details:", authError.data || authError.message);
      return null;
    }
  }
  console.warn("[Activate Plan From Token API WARN] PB admin credentials not fully configured.");
  return null;
}

export async function POST(request: NextRequest) {
  let pbAdmin: PocketBase | null = null;
  try {
    const { token } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ success: false, message: 'Activation token is missing or invalid.' }, { status: 400 });
    }

    pbAdmin = await getAdminPbInstance();
    if (!pbAdmin) {
      console.error("[Activate Plan From Token API ERROR] Critical server error: Database admin client could not be initialized. Plan activation cannot proceed. (PB_ADMIN_INIT_FAIL)");
      return NextResponse.json({ success: false, message: 'Critical server error: Database admin client could not be initialized. Plan activation cannot proceed. (PB_ADMIN_INIT_FAIL)' }, { status: 500 });
    }

    console.log(`[Activate Plan From Token API INFO] Searching for activation token: ${token.substring(0,10)}...`);
    const tokenRecord = await pbAdmin.collection('plan_activation_tokens').getFirstListItem(`token = "${token}"`);
    console.log(`[Activate Plan From Token API INFO] Token record found:`, tokenRecord);

    if (tokenRecord.used) {
      return NextResponse.json({ success: false, message: 'This activation link has already been used.' }, { status: 400 });
    }
    if (new Date(tokenRecord.expires_at) < new Date()) {
      return NextResponse.json({ success: false, message: 'This activation link has expired.' }, { status: 400 });
    }

    const userIdToUpdate = tokenRecord.user_id;
    const planIdToActivate = tokenRecord.plan_id_to_activate;

    let collectionToUpdate: 'users' | 'teacher_data' | null = null;
    let updatePayload: Record<string, any> = {};
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1); 

    const studentPlanIds: UserSubscriptionTierStudent[] = ['Free', 'Chapterwise', 'Full_length', 'Dpp', 'Combo'];
    const teacherPlanIds: UserSubscriptionTierTeacher[] = ['Free', 'Starter', 'Pro'];

    if (studentPlanIds.includes(planIdToActivate as UserSubscriptionTierStudent)) {
      collectionToUpdate = 'users';
      updatePayload = {
        model: planIdToActivate as UserSubscriptionTierStudent,
        expiry_date: expiryDate.toISOString(),
      };
      console.log(`[Activate Plan From Token API INFO] Activating student plan: User ID ${userIdToUpdate}, Plan ${planIdToActivate}`);
    } else if (teacherPlanIds.includes(planIdToActivate as UserSubscriptionTierTeacher)) {
      collectionToUpdate = 'teacher_data';
      const planDetails = teacherPlatformPlansData.find(p => p.id === planIdToActivate);
      updatePayload = {
        teacherSubscriptionTier: planIdToActivate as UserSubscriptionTierTeacher,
        max_content_plans_allowed: planDetails?.maxContentPlans,
      };
       console.log(`[Activate Plan From Token API INFO] Activating teacher plan: Teacher ID ${userIdToUpdate}, Plan ${planIdToActivate}`);
    } else {
        console.warn(`[Activate Plan From Token API WARN] Unrecognized planIdToActivate: ${planIdToActivate}. Cannot determine collection for update.`);
         return NextResponse.json({ success: false, message: `Activation for plan type "${planIdToActivate}" is not configured.` }, { status: 400 });
    }

    if (collectionToUpdate) {
        console.log(`[Activate Plan From Token API INFO] Attempting to update collection '${collectionToUpdate}' for user/teacher ID '${userIdToUpdate}' with payload:`, updatePayload);
        try {
            await pbAdmin.collection(collectionToUpdate).update(userIdToUpdate, updatePayload);
            console.log(`[Activate Plan From Token API INFO] Successfully updated user/teacher record ${userIdToUpdate} in collection ${collectionToUpdate}.`);
        } catch (dbUpdateError: any) {
            console.error(`[Activate Plan From Token API ERROR] Failed to update user/teacher record ${userIdToUpdate} in DB. Collection: ${collectionToUpdate}. Payload: ${JSON.stringify(updatePayload)}. Error details:`, dbUpdateError.data || dbUpdateError.message, "Full Error:", dbUpdateError);
            return NextResponse.json({ success: false, message: `Plan activation failed: Could not update user/teacher profile (${dbUpdateError.data?.message || dbUpdateError.message}). Please contact support with Order ID: ${tokenRecord.order_id}. (DB_UPDATE_FAIL)` }, { status: 500 });
        }
    }

    await pbAdmin.collection('plan_activation_tokens').update(tokenRecord.id, { used: true });
    console.log(`[Activate Plan From Token API INFO] Token ${tokenRecord.id} marked as used.`);

    return NextResponse.json({ success: true, message: `Plan "${planIdToActivate}" activated successfully!` }, { status: 200 });

  } catch (error: any) {
    console.error("[Activate Plan From Token API ERROR] General error processing activation token:", error.data || error.message, "Full Error:", error);
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
