
import { NextResponse } from 'next/server';
import crypto from 'crypto'; // Node.js crypto module for SHA512

const PAYU_MERCHANT_KEY = process.env.NEXT_PUBLIC_PAYU_KEY;
const PAYU_SALT = process.env.PAYU_SALT;
// PAYU_PAYMENT_URL is used on the frontend form's action, not directly here.
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:9002'; // Default if not set

export async function POST(request: Request) {
  if (!PAYU_MERCHANT_KEY || !PAYU_SALT) {
    console.error("PayU Initiate Payment Error: Merchant Key or Salt is not configured on the server.");
    return NextResponse.json({ error: 'Payment gateway server configuration error.' }, { status: 500 });
  }
  if (!APP_BASE_URL) {
    console.error("PayU Initiate Payment Error: NEXT_PUBLIC_APP_BASE_URL is not configured.");
    return NextResponse.json({ error: 'Application base URL is not configured.' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const {
      amount, // Expected as string, e.g., "10.00"
      planId, 
      teacherId,
      teacherEmail,
      teacherName,
      teacherPhone,
    } = body;

    if (!amount || !planId || !teacherId || !teacherEmail || !teacherName || !teacherPhone) {
      return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
    }

    const txnid = `EDUNEXUS_TEACHER_${teacherId.substring(0,5)}_${Date.now()}`;
    const productinfo = `EduNexus Teacher Plan - ${planId}`;
    const firstname = teacherName.split(' ')[0] || 'Teacher'; // PayU requires firstname
    const email = teacherEmail;
    const phone = teacherPhone.replace(/\D/g, ''); // Ensure phone is digits only
    const surl = `${APP_BASE_URL}/api/payu/handle-teacher-plan-response`;
    const furl = `${APP_BASE_URL}/api/payu/handle-teacher-plan-response`;

    // Construct the hash string. The order is CRITICAL and must match PayU's documentation.
    // Example format: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||SALT
    // We are using udf1 for planId and udf2 for teacherId.
    const udf1 = planId;
    const udf2 = teacherId;
    const udf3 = "";
    const udf4 = "";
    const udf5 = "";
    // The "||||||" part represents empty optional parameters (check PayU docs for which ones these are for your integration)
    const hashStringParams = [
      PAYU_MERCHANT_KEY, txnid, amount, productinfo, firstname, email,
      udf1, udf2, udf3, udf4, udf5, 
      "", "", "", "", "", // These are for other optional params that might be part of hash sequence
      PAYU_SALT
    ];
    const hashString = hashStringParams.join('|');
    
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');

    const payuFormInputs = {
      key: PAYU_MERCHANT_KEY,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl,
      furl,
      hash,
      udf1: planId, // Send planId as udf1
      udf2: teacherId, // Send teacherId as udf2
      // service_provider: 'payu_paisa', // Often required for PayU Test/Prod environment
    };

    return NextResponse.json(payuFormInputs, { status: 200 });

  } catch (error: any) {
    console.error('Error creating PayU payment initiation data:', error);
    return NextResponse.json({ error: error.message || 'Failed to initiate payment.' }, { status: 500 });
  }
}
