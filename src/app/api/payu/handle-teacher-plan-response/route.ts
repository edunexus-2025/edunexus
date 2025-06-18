
import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import pb from '@/lib/pocketbase'; 
import { Routes, teacherPlatformPlansData } from '@/lib/constants';
import type { UserSubscriptionTierTeacher } from '@/lib/types';

const PAYU_SALT = process.env.PAYU_SALT; 
const PAYU_MERCHANT_KEY = process.env.NEXT_PUBLIC_PAYU_KEY; 
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:9002';

export async function POST(request: NextRequest) {
  if (!PAYU_SALT || !PAYU_MERCHANT_KEY) {
    console.error("PayU Handle Response Error: Merchant Key or Salt is not configured.");
    const errorRedirectUrl = new URL(`${APP_BASE_URL}${Routes.teacherPaymentStatus}`);
    errorRedirectUrl.searchParams.set('status', 'error');
    errorRedirectUrl.searchParams.set('message', 'Payment gateway server configuration error.');
    return NextResponse.redirect(errorRedirectUrl.toString(), 302);
  }

  try {
    const formData = await request.formData();
    const payuResponse: Record<string, string> = {};
    formData.forEach((value, key) => {
      payuResponse[key] = value as string;
    });

    console.log("Received PayU Response (POST):", JSON.stringify(payuResponse, null, 2));

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


    // Verify the hash
    // IMPORTANT: The order of parameters in reverseHashString MUST be exactly as per PayU documentation for your specific salt version.
    // This is a common order: SALT|status|||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key
    // Ensure empty strings for any params not sent TO PayU but included in their hash calculation for response.
    const hashParamsArray = [
      status || '',
      ...(Array(5).fill('')), // Placeholder for 5 potentially empty additional_charges / discount fields
      payuResponse.udf5 || '',
      payuResponse.udf4 || '',
      payuResponse.udf3 || '',
      teacherId || '',        // udf2
      planId || '',          // udf1
      email || '',
      firstname || '',
      productinfo || '',
      amount || '',
      txnid || '',
    ];

    const reverseHashString = `${PAYU_SALT}|${hashParamsArray.join('|')}|${PAYU_MERCHANT_KEY}`;
    const calculatedHash = crypto.createHash('sha512').update(reverseHashString).digest('hex');

    if (calculatedHash !== receivedHash) {
      console.error("PayU Handle Response Error: Hash Mismatch.", { calculatedHash, receivedHash, reverseHashString });
      const redirectUrl = new URL(`${APP_BASE_URL}${Routes.teacherPaymentStatus}`);
      redirectUrl.searchParams.set('status', 'failure');
      redirectUrl.searchParams.set('message', 'Payment verification failed. Security check error.');
      redirectUrl.searchParams.set('txnid', txnid || 'unknown');
      return NextResponse.redirect(redirectUrl.toString(), 302);
    }

    // Construct the final redirect URL based on payment status
    const finalRedirectUrl = new URL(`${APP_BASE_URL}${Routes.teacherPaymentStatus}`);
    finalRedirectUrl.searchParams.set('txnid', txnid || 'N/A');
    finalRedirectUrl.searchParams.set('payuId', mihpayid || 'N/A');
    finalRedirectUrl.searchParams.set('amount', amount || '0');
    finalRedirectUrl.searchParams.set('productInfo', productinfo || 'N/A');


    if (status === 'success') {
      console.log(`PayU payment success for txnid: ${txnid}, PayU ID: ${mihpayid}`);
      
      if (!teacherId || !planId) {
          console.error("PayU Handle Response Error: Missing teacherId or planId from UDFs after successful payment.");
          finalRedirectUrl.searchParams.set('status', 'error');
          finalRedirectUrl.searchParams.set('message', 'Critical error: Teacher or Plan ID missing post-payment.');
          return NextResponse.redirect(finalRedirectUrl.toString(), 302);
      }

      try {
        const targetPlanDetails = teacherPlatformPlansData.find(p => p.id === planId);
        if (!targetPlanDetails) {
            throw new Error(`Plan details for ID ${planId} not found in application constants.`);
        }

        await pb.collection('teacher_data').update(teacherId, {
          teacherSubscriptionTier: planId,
          max_content_plans_allowed: targetPlanDetails.maxContentPlans,
          // Remove can_create_ads and ads_subscription logic if PayU is only for platform plans
        });
        console.log(`Teacher ${teacherId} successfully upgraded to plan ${planId}. Max plans: ${targetPlanDetails.maxContentPlans}`);
        
        finalRedirectUrl.searchParams.set('status', 'success');
        finalRedirectUrl.searchParams.set('planName', planId);
        finalRedirectUrl.searchParams.set('message', `Successfully upgraded to ${planId} plan!`);
        return NextResponse.redirect(finalRedirectUrl.toString(), 302);

      } catch (dbError: any) {
        console.error("PayU Handle Response Error: Failed to update teacher's plan in DB.", dbError);
        finalRedirectUrl.searchParams.set('status', 'error');
        finalRedirectUrl.searchParams.set('message', `Payment successful but failed to update plan: ${dbError.message || 'DB Error'}`);
        return NextResponse.redirect(finalRedirectUrl.toString(), 302);
      }

    } else {
      // Payment failed or was cancelled by user
      console.log(`PayU payment status: ${status} for txnid: ${txnid}. PayU Error: ${errorMessageFromPayu || 'Unknown PayU error'}`);
      finalRedirectUrl.searchParams.set('status', 'failure');
      finalRedirectUrl.searchParams.set('message', errorMessageFromPayu || `Payment ${status}.`);
      return NextResponse.redirect(finalRedirectUrl.toString(), 302);
    }

  } catch (error: any) {
    console.error("PayU Handle Response Critical Error (Outer Try-Catch):", error);
    const errorRedirectUrl = new URL(`${APP_BASE_URL}${Routes.teacherPaymentStatus}`);
    errorRedirectUrl.searchParams.set('status', 'error');
    errorRedirectUrl.searchParams.set('message', `Server error processing payment response: ${error.message || 'Unknown error'}`);
    return NextResponse.redirect(errorRedirectUrl.toString(), 302);
  }
}

// PayU might also use GET for some failure/cancel scenarios.
export async function GET(request: NextRequest) {
  console.warn("PayU Handle Response: Received GET request. This is usually for user-cancelled or simple failure redirects. Params:", request.nextUrl.searchParams.toString());
  
  const status = request.nextUrl.searchParams.get('status') || 'info';
  const message = request.nextUrl.searchParams.get('mihpayid') // mihpayid is usually present on cancel/failure too
                ? `Payment process with PayU ID ${request.nextUrl.searchParams.get('mihpayid')} was not completed.`
                : (request.nextUrl.searchParams.get('error_Message') || request.nextUrl.searchParams.get('message') || 'Payment process was interrupted or information received via GET.');
  const txnid = request.nextUrl.searchParams.get('txnid') || 'N/A';

  const infoRedirectUrl = new URL(`${APP_BASE_URL}${Routes.teacherPaymentStatus}`);
  infoRedirectUrl.searchParams.set('status', status === 'success' ? 'failure' : status); // Treat GET success as failure unless verified
  infoRedirectUrl.searchParams.set('message', message);
  infoRedirectUrl.searchParams.set('txnid', txnid);
  return NextResponse.redirect(infoRedirectUrl.toString(), 302);
}
