
import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import pb from '@/lib/pocketbase'; 
import { Routes, teacherPlatformPlansData } from '@/lib/constants';
import type { UserSubscriptionTierTeacher } from '@/lib/types';

// These are read from .env.local (or your deployment environment variables)
const SERVER_SIDE_PAYU_CLIENT_SECRET = process.env.PAYU_CLIENT_SECRET; 
const SERVER_SIDE_PAYU_CLIENT_ID = process.env.PAYU_CLIENT_ID_SERVER; 
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL;

export async function POST(request: NextRequest) {
  if (!SERVER_SIDE_PAYU_CLIENT_SECRET || !SERVER_SIDE_PAYU_CLIENT_ID) {
    console.error("[PayU Handle Response ERROR] CRITICAL: PayU Client ID (Server-Side) or Client Secret is NOT configured on the server. Check .env.local and deployment variables.");
    const errorRedirectUrl = new URL(`${APP_BASE_URL || 'http://localhost:9002'}${Routes.teacherPaymentStatus}`);
    errorRedirectUrl.searchParams.set('status', 'error');
    errorRedirectUrl.searchParams.set('message', 'Payment gateway server configuration error (Client ID/Secret missing for verification).');
    return NextResponse.redirect(errorRedirectUrl.toString(), 302);
  }
   if (!APP_BASE_URL) {
    console.error("[PayU Handle Response ERROR] CRITICAL: NEXT_PUBLIC_APP_BASE_URL is not configured. Cannot construct redirect URLs properly.");
    // Fallback redirect, though this state is highly problematic.
    const errorRedirectUrl = new URL(`http://localhost:9002${Routes.teacherPaymentStatus}`);
    errorRedirectUrl.searchParams.set('status', 'error');
    errorRedirectUrl.searchParams.set('message', 'Application base URL configuration error.');
    return NextResponse.redirect(errorRedirectUrl.toString(), 302);
  }


  try {
    const formData = await request.formData();
    const payuResponse: Record<string, string> = {};
    formData.forEach((value, key) => {
      payuResponse[key] = value as string;
    });

    console.log("[PayU Handle Response INFO] Received PayU Response Data (POST):", JSON.stringify(payuResponse, null, 2));

    const status = payuResponse.status;
    const mihpayid = payuResponse.mihpayid; 
    const txnid = payuResponse.txnid; 
    const receivedHash = payuResponse.hash;
    const amount = payuResponse.amount;
    const productinfo = payuResponse.productinfo;
    const firstname = payuResponse.firstname;
    const email = payuResponse.email;
    const planId = payuResponse.udf1 as UserSubscriptionTierTeacher | undefined; 
    const teacherId = payuResponse.udf2;
    const errorMessageFromPayu = payuResponse.error_Message || payuResponse.error;

    // For response hash verification, the order is:
    // SALT|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|KEY
    // Note: The empty strings are for UDF10 down to UDF6, then UDF5 down to UDF1.
    // Then email, firstname, productinfo, amount, txnid, KEY.
    const hashParamsArray = [
      status || '',
      ...(Array(5).fill('')), // Placeholder for udf10 to udf6 if they were used
      payuResponse.udf5 || '',
      payuResponse.udf4 || '',
      payuResponse.udf3 || '',
      teacherId || '', // udf2       
      planId || '',   // udf1        
      email || '',
      firstname || '',
      productinfo || '',
      amount || '',
      txnid || '',
    ];

    // The hash string for response verification starts with SALT and ends with KEY.
    const reverseHashString = `${SERVER_SIDE_PAYU_CLIENT_SECRET}|${hashParamsArray.join('|')}|${SERVER_SIDE_PAYU_CLIENT_ID}`;
    const calculatedHash = crypto.createHash('sha512').update(reverseHashString).digest('hex');

    console.log("[PayU Handle Response DEBUG] String for Reverse Hash Calculation:", reverseHashString.replace(SERVER_SIDE_PAYU_CLIENT_SECRET!, "******").replace(SERVER_SIDE_PAYU_CLIENT_ID!, `${SERVER_SIDE_PAYU_CLIENT_ID!.substring(0,3)}...`)); // Mask sensitive
    console.log("[PayU Handle Response DEBUG] Calculated Reverse Hash:", calculatedHash);
    console.log("[PayU Handle Response DEBUG] Received Hash from PayU:", receivedHash);

    if (calculatedHash !== receivedHash) {
      console.error("[PayU Handle Response ERROR] Hash Mismatch. Security check failed.", { calculatedHash, receivedHash });
      const redirectUrl = new URL(`${APP_BASE_URL}${Routes.teacherPaymentStatus}`);
      redirectUrl.searchParams.set('status', 'failure');
      redirectUrl.searchParams.set('message', 'Payment verification failed due to security check error.');
      redirectUrl.searchParams.set('txnid', txnid || 'unknown_txnid');
      return NextResponse.redirect(redirectUrl.toString(), 302);
    }

    const finalRedirectUrl = new URL(`${APP_BASE_URL}${Routes.teacherPaymentStatus}`);
    finalRedirectUrl.searchParams.set('txnid', txnid || 'N/A');
    finalRedirectUrl.searchParams.set('payuId', mihpayid || 'N/A');
    finalRedirectUrl.searchParams.set('amount', amount || '0');
    finalRedirectUrl.searchParams.set('productInfo', productinfo || 'N/A');


    if (status === 'success') {
      console.log(`[PayU Handle Response INFO] PayU payment success for txnid: ${txnid}, PayU ID: ${mihpayid}`);
      
      if (!teacherId || !planId) {
          console.error("[PayU Handle Response ERROR] Missing teacherId or planId from UDFs after successful payment verification.");
          finalRedirectUrl.searchParams.set('status', 'error');
          finalRedirectUrl.searchParams.set('message', 'Critical error: Teacher or Plan ID missing post-payment. Contact support.');
          return NextResponse.redirect(finalRedirectUrl.toString(), 302);
      }

      try {
        const targetPlanDetails = teacherPlatformPlansData.find(p => p.id === planId);
        if (!targetPlanDetails) {
            console.error(`[PayU Handle Response ERROR] Plan details for ID ${planId} not found in application constants.`);
            throw new Error(`Invalid plan ID ${planId} received from payment gateway.`);
        }

        // Update teacher's record in PocketBase
        await pb.collection('teacher_data').update(teacherId, {
          teacherSubscriptionTier: planId,
          max_content_plans_allowed: targetPlanDetails.maxContentPlans,
        });
        console.log(`[PayU Handle Response INFO] Teacher ${teacherId} successfully upgraded to plan ${planId}. Max plans: ${targetPlanDetails.maxContentPlans}`);
        
        finalRedirectUrl.searchParams.set('status', 'success');
        finalRedirectUrl.searchParams.set('planName', planId);
        finalRedirectUrl.searchParams.set('message', `Successfully upgraded to ${planId} plan!`);
        return NextResponse.redirect(finalRedirectUrl.toString(), 302);

      } catch (dbError: any) {
        console.error("[PayU Handle Response ERROR] Failed to update teacher's plan in DB after successful payment.", dbError);
        finalRedirectUrl.searchParams.set('status', 'error');
        finalRedirectUrl.searchParams.set('message', `Payment successful but failed to update plan: ${dbError.message || 'DB Update Error'}. Please contact support with Transaction ID: ${txnid}.`);
        return NextResponse.redirect(finalRedirectUrl.toString(), 302);
      }

    } else {
      console.warn(`[PayU Handle Response WARN] PayU payment status: ${status} for txnid: ${txnid}. PayU Error: ${errorMessageFromPayu || 'Unknown PayU error or user cancellation.'}`);
      finalRedirectUrl.searchParams.set('status', 'failure');
      finalRedirectUrl.searchParams.set('message', errorMessageFromPayu || `Payment ${status}.`);
      return NextResponse.redirect(finalRedirectUrl.toString(), 302);
    }

  } catch (error: any) {
    console.error("[PayU Handle Response CRITICAL ERROR] (Outer Try-Catch):", error);
    const errorRedirectUrl = new URL(`${APP_BASE_URL}${Routes.teacherPaymentStatus}`);
    errorRedirectUrl.searchParams.set('status', 'error');
    errorRedirectUrl.searchParams.set('message', `Server error processing payment response: ${error.message || 'Unknown internal server error'}`);
    return NextResponse.redirect(errorRedirectUrl.toString(), 302);
  }
}

export async function GET(request: NextRequest) {
  console.warn("[PayU Handle Response WARN] Received GET request. This is usually for user-cancelled or simple failure redirects not involving hash verification. Params:", request.nextUrl.searchParams.toString());
  
  const status = request.nextUrl.searchParams.get('status') || 'info';
  const message = request.nextUrl.searchParams.get('mihpayid') 
                ? `Payment process with PayU ID ${request.nextUrl.searchParams.get('mihpayid')} was not completed.`
                : (request.nextUrl.searchParams.get('error_Message') || request.nextUrl.searchParams.get('message') || 'Payment process was interrupted or information received via GET.');
  const txnid = request.nextUrl.searchParams.get('txnid') || 'N/A_GET';

  const infoRedirectUrl = new URL(`${APP_BASE_URL || 'http://localhost:9002'}${Routes.teacherPaymentStatus}`);
  // Treat GET 'success' as 'failure' unless explicitly verified by POST with hash
  infoRedirectUrl.searchParams.set('status', status === 'success' ? 'failure' : status); 
  infoRedirectUrl.searchParams.set('message', message);
  infoRedirectUrl.searchParams.set('txnid', txnid);
  return NextResponse.redirect(infoRedirectUrl.toString(), 302);
}
