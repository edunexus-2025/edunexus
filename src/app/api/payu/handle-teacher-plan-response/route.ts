
import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import PocketBase from 'pocketbase'; // Import PocketBase constructor
import { Routes, teacherPlatformPlansData, AppConfig } from '@/lib/constants';
import type { UserSubscriptionTierTeacher } from '@/lib/types';

// Environment variables for PayU and PocketBase Admin access
const PAYU_SERVER_KEY_VERIFICATION = process.env.NEXT_PUBLIC_PAYU_CLIENT_ID; // Your Client ID / Merchant Key used for hash verification
const PAYU_SERVER_SECRET_VERIFICATION = process.env.PAYU_CLIENT_SECRET;   // Your Client Secret / Salt used for hash verification
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL;

// PocketBase Admin Credentials for server-side updates
const POCKETBASE_URL_SERVER = process.env.NEXT_PUBLIC_POCKETBASE_URL;
const POCKETBASE_ADMIN_EMAIL_SERVER = process.env.POCKETBASE_ADMIN_EMAIL;
const POCKETBASE_ADMIN_PASSWORD_SERVER = process.env.POCKETBASE_ADMIN_PASSWORD;

async function getAdminPbInstance(): Promise<PocketBase | null> {
  if (POCKETBASE_URL_SERVER && POCKETBASE_ADMIN_EMAIL_SERVER && POCKETBASE_ADMIN_PASSWORD_SERVER) {
    const adminPb = new PocketBase(POCKETBASE_URL_SERVER);
    try {
      await adminPb.admins.authWithPassword(POCKETBASE_ADMIN_EMAIL_SERVER, POCKETBASE_ADMIN_PASSWORD_SERVER);
      console.log("[PayU Handle Response INFO] Successfully authenticated PocketBase admin client.");
      return adminPb;
    } catch (authError) {
      console.error("[PayU Handle Response ERROR] CRITICAL: Failed to authenticate PocketBase admin client:", authError);
      return null;
    }
  }
  console.warn("[PayU Handle Response WARN] PocketBase admin credentials not fully configured. Database updates may fail if collection rules are restrictive.");
  return null; // Fallback to global pb instance if admin credentials not set (not recommended for production updates)
}


export async function POST(request: NextRequest) {
  if (!PAYU_SERVER_KEY_VERIFICATION || !PAYU_SERVER_SECRET_VERIFICATION) {
    console.error("[PayU Handle Response ERROR] CRITICAL: PayU Client ID or Client Secret is NOT configured on the server for verification. Check .env variables (NEXT_PUBLIC_PAYU_CLIENT_ID, PAYU_CLIENT_SECRET).");
    const errorRedirectUrl = new URL(`${APP_BASE_URL || 'http://localhost:9002'}${Routes.teacherPaymentStatus}`);
    errorRedirectUrl.searchParams.set('status', 'error');
    errorRedirectUrl.searchParams.set('message', 'Payment gateway server configuration error.');
    return NextResponse.redirect(errorRedirectUrl.toString(), 302);
  }
   if (!APP_BASE_URL) {
    console.error("[PayU Handle Response ERROR] CRITICAL: NEXT_PUBLIC_APP_BASE_URL is not configured. Cannot construct redirect URLs properly.");
    const errorRedirectUrl = new URL(`http://localhost:9002${Routes.teacherPaymentStatus}`);
    errorRedirectUrl.searchParams.set('status', 'error');
    errorRedirectUrl.searchParams.set('message', 'Application base URL configuration error.');
    return NextResponse.redirect(errorRedirectUrl.toString(), 302);
  }

  try {
    const formData = await request.formData();
    const payuResponse: Record<string, string> = {};
    formData.forEach((value, key) => { payuResponse[key] = value as string; });

    console.log("[PayU Handle Response INFO] Received PayU Response Data (POST):", JSON.stringify(payuResponse, null, 2));

    const status = payuResponse.status;
    const mihpayid = payuResponse.mihpayid;
    const txnid = payuResponse.txnid;
    const receivedHash = payuResponse.hash;
    const amount = payuResponse.amount;
    const productinfo = payuResponse.productinfo;
    const firstname = payuResponse.firstname;
    const email = payuResponse.email;
    const udf1 = payuResponse.udf1; // Expected: planId
    const udf2 = payuResponse.udf2; // Expected: teacherId
    const udf3 = payuResponse.udf3 || "";
    const udf4 = payuResponse.udf4 || "";
    const udf5 = payuResponse.udf5 || "";
    const errorMessageFromPayu = payuResponse.error_Message || payuResponse.Error || payuResponse.error; // Check multiple error fields

    // PayU response hash verification: SALT|status|||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|KEY
    // Note the 6 empty placeholders after status: |||||| (udf10 to udf6)
    const hashParamsArray = [
      status || '', // status
      "", // udf10 (often empty from PayU if not sent in request)
      "", // udf9
      "", // udf8
      "", // udf7
      "", // udf6
      udf5 || '', // udf5
      udf4 || '', // udf4
      udf3 || '', // udf3
      udf2 || '', // udf2 (teacherId)
      udf1 || '', // udf1 (planId)
      email || '',
      firstname || '',
      productinfo || '',
      amount || '',
      txnid || '',
    ];
    const reverseHashString = `${PAYU_SERVER_SECRET_VERIFICATION}|${hashParamsArray.join('|')}|${PAYU_SERVER_KEY_VERIFICATION}`;
    const calculatedHash = crypto.createHash('sha512').update(reverseHashString).digest('hex');

    console.log("[PayU Handle Response DEBUG] String for Reverse Hash Calculation (credentials masked):", reverseHashString.replace(PAYU_SERVER_SECRET_VERIFICATION!, "******CLIENT_SECRET******").replace(PAYU_SERVER_KEY_VERIFICATION!, `${PAYU_SERVER_KEY_VERIFICATION!.substring(0,3)}...CLIENT_ID`));
    console.log("[PayU Handle Response DEBUG] Calculated Reverse Hash:", calculatedHash);
    console.log("[PayU Handle Response DEBUG] Received Hash from PayU:", receivedHash);

    if (calculatedHash !== receivedHash) {
      console.error("[PayU Handle Response ERROR] Hash Mismatch. Security check failed.", { calculatedHash, receivedHash });
      const redirectUrl = new URL(`${APP_BASE_URL}${Routes.teacherPaymentStatus}`);
      redirectUrl.searchParams.set('status', 'failure');
      redirectUrl.searchParams.set('message', 'Payment verification failed (security check error).');
      redirectUrl.searchParams.set('txnid', txnid || 'unknown_txnid');
      return NextResponse.redirect(redirectUrl.toString(), 302);
    }

    const finalRedirectUrl = new URL(`${APP_BASE_URL}${Routes.teacherPaymentStatus}`);
    finalRedirectUrl.searchParams.set('txnid', txnid || 'N/A');
    finalRedirectUrl.searchParams.set('payuId', mihpayid || 'N/A');
    finalRedirectUrl.searchParams.set('amount', amount || '0');
    finalRedirectUrl.searchParams.set('productInfo', productinfo || 'N/A');

    if (status === 'success') {
      console.log(`[PayU Handle Response INFO] PayU payment SUCCESS for txnid: ${txnid}, PayU ID: ${mihpayid}`);
      
      const planIdFromUdf = udf1 as UserSubscriptionTierTeacher | undefined;
      const teacherIdFromUdf = udf2;

      if (!teacherIdFromUdf || !planIdFromUdf) {
          console.error("[PayU Handle Response ERROR] Missing teacherId or planId from UDFs after successful payment verification.");
          finalRedirectUrl.searchParams.set('status', 'error');
          finalRedirectUrl.searchParams.set('message', 'Critical error: Teacher or Plan ID missing post-payment. Contact support.');
          return NextResponse.redirect(finalRedirectUrl.toString(), 302);
      }

      const targetPlanDetails = teacherPlatformPlansData.find(p => p.id === planIdFromUdf);
      if (!targetPlanDetails) {
          console.error(`[PayU Handle Response ERROR] Plan details for ID ${planIdFromUdf} not found in application constants.`);
          finalRedirectUrl.searchParams.set('status', 'error');
          finalRedirectUrl.searchParams.set('message', `Invalid plan ID ${planIdFromUdf} received. Contact support.`);
          return NextResponse.redirect(finalRedirectUrl.toString(), 302);
      }

      // Use Admin PB instance for updating teacher record
      const adminPbInstance = await getAdminPbInstance();
      const pbClientToUse = adminPbInstance || (await import('@/lib/pocketbase')).default; // Fallback to default if admin client fails

      try {
        await pbClientToUse.collection('teacher_data').update(teacherIdFromUdf, {
          teacherSubscriptionTier: planIdFromUdf,
          max_content_plans_allowed: targetPlanDetails.maxContentPlans,
        });
        console.log(`[PayU Handle Response INFO] Teacher ${teacherIdFromUdf} successfully upgraded to plan ${planIdFromUdf}. Max plans: ${targetPlanDetails.maxContentPlans}. Updated by: ${adminPbInstance ? 'Admin Client' : 'Default Client'}`);
        
        finalRedirectUrl.searchParams.set('status', 'success');
        finalRedirectUrl.searchParams.set('planName', planIdFromUdf);
        finalRedirectUrl.searchParams.set('message', `Successfully upgraded to ${planIdFromUdf} plan!`);
      } catch (dbError: any) {
        console.error("[PayU Handle Response ERROR] Failed to update teacher's plan in DB after successful payment.", dbError.data || dbError);
        finalRedirectUrl.searchParams.set('status', 'error');
        finalRedirectUrl.searchParams.set('message', `Payment successful but failed to update plan: ${dbError.data?.message || dbError.message || 'DB Update Error'}. Contact support with Transaction ID: ${txnid}.`);
      }
      return NextResponse.redirect(finalRedirectUrl.toString(), 302);

    } else { // failure, pending, etc.
      console.warn(`[PayU Handle Response WARN] PayU payment status: ${status} for txnid: ${txnid}. PayU Error: ${errorMessageFromPayu || 'Unknown PayU error or user cancellation.'}`);
      finalRedirectUrl.searchParams.set('status', 'failure');
      finalRedirectUrl.searchParams.set('message', errorMessageFromPayu || `Payment ${status}.`);
      return NextResponse.redirect(finalRedirectUrl.toString(), 302);
    }

  } catch (error: any) {
    console.error("[PayU Handle Response CRITICAL ERROR] (Outer Try-Catch):", error);
    const errorRedirectUrl = new URL(`${APP_BASE_URL || 'http://localhost:9002'}${Routes.teacherPaymentStatus}`);
    errorRedirectUrl.searchParams.set('status', 'error');
    errorRedirectUrl.searchParams.set('message', `Server error processing payment response: ${error.message || 'Unknown internal server error'}`);
    return NextResponse.redirect(errorRedirectUrl.toString(), 302);
  }
}

// GET handler for cases where PayU might redirect with GET (e.g., user cancellation before payment)
export async function GET(request: NextRequest) {
  console.warn("[PayU Handle Response WARN] Received GET request. This is usually for user-cancelled or simple failure redirects not involving hash verification. Params:", request.nextUrl.searchParams.toString());
  
  const statusFromPayU = request.nextUrl.searchParams.get('status') || 'info';
  const message = request.nextUrl.searchParams.get('mihpayid') 
                ? `Payment process with PayU ID ${request.nextUrl.searchParams.get('mihpayid')} was not completed.`
                : (request.nextUrl.searchParams.get('error_Message') || request.nextUrl.searchParams.get('Error') || request.nextUrl.searchParams.get('message') || 'Payment process was interrupted or information received via GET.');
  const txnid = request.nextUrl.searchParams.get('txnid') || 'N/A_GET';

  const infoRedirectUrl = new URL(`${APP_BASE_URL || 'http://localhost:9002'}${Routes.teacherPaymentStatus}`);
  infoRedirectUrl.searchParams.set('status', statusFromPayU === 'success' ? 'failure' : statusFromPayU); 
  infoRedirectUrl.searchParams.set('message', message);
  infoRedirectUrl.searchParams.set('txnid', txnid);
  return NextResponse.redirect(infoRedirectUrl.toString(), 302);
}

    