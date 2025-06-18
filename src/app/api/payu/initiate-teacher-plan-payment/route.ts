
import { NextResponse } from 'next/server';
import crypto from 'crypto'; // Node.js crypto module for SHA512

// These are read from .env.local (or your deployment environment variables)
const PAYU_FORM_SUBMIT_KEY = process.env.NEXT_PUBLIC_PAYU_KEY; // Key for the PayU form's 'key' parameter
const PAYU_HASH_CALC_KEY = process.env.NEXT_PUBLIC_PAYU_CLIENT_ID; // Key used in server-side HASH calculation (often same as above)
const PAYU_HASH_CALC_SALT = process.env.PAYU_CLIENT_SECRET;   // Salt used in server-side HASH calculation
const PAYU_ACTION_URL = process.env.PAYU_PAYMENT_URL || 'https://secure.payu.in/_payment';
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL;

export async function POST(request: Request) {
  if (!PAYU_FORM_SUBMIT_KEY || !PAYU_HASH_CALC_KEY || !PAYU_HASH_CALC_SALT) {
    console.error("[PayU Initiate ERROR] CRITICAL: PayU Key/Client ID or Salt/Client Secret is NOT configured on the server. Check .env.local and deployment variables (NEXT_PUBLIC_PAYU_KEY, NEXT_PUBLIC_PAYU_CLIENT_ID, PAYU_CLIENT_SECRET).");
    return NextResponse.json({ error: 'Payment gateway server configuration error (Key/Client ID or Salt/Client Secret missing). Please contact support.' }, { status: 500 });
  }
  if (!APP_BASE_URL) {
    console.error("[PayU Initiate ERROR] CRITICAL: NEXT_PUBLIC_APP_BASE_URL is not configured. Payment callbacks will fail.");
    return NextResponse.json({ error: 'Application base URL is not configured. Payment cannot proceed.' }, { status: 500 });
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
      console.error("[PayU Initiate ERROR] Missing required payment details from client. Body received:", body);
      return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
    }

    const txnid = `EDUNEXUS_TEACHER_${teacherId.substring(0,5)}_${Date.now()}`;
    const productinfo = `EduNexus Teacher Plan - ${planId}`;
    const firstname = teacherName.split(' ')[0] || 'Teacher';
    const email = teacherEmail;
    const phone = teacherPhone.replace(/\D/g, '');
    const surl = `${APP_BASE_URL}/api/payu/handle-teacher-plan-response`;
    const furl = `${APP_BASE_URL}/api/payu/handle-teacher-plan-response`;

    const udf1 = planId;
    const udf2 = teacherId;
    const udf3 = "";
    const udf4 = "";
    const udf5 = "";

    // Standard PayU request hash string: KEY|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|SALT
    // Here, PAYU_HASH_CALC_KEY is your Merchant Key / Client ID used for hashing
    // PAYU_HASH_CALC_SALT is your Salt / Client Secret
    const hashStringParams = [
      PAYU_HASH_CALC_KEY,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1, udf2, udf3, udf4, udf5,
      "", "", "", "", "", // udf6-udf10
      PAYU_HASH_CALC_SALT
    ];
    const hashString = hashStringParams.join('|');

    console.log("--------------------------------------------------------------------");
    console.log("[PayU Initiate DEBUG] Preparing to hash for PayU request.");
    console.log("[PayU Initiate DEBUG] PAYU_FORM_SUBMIT_KEY (for form 'key'):", PAYU_FORM_SUBMIT_KEY ? `${PAYU_FORM_SUBMIT_KEY.substring(0,3)}...` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] PAYU_HASH_CALC_KEY (Client ID for HASH):", PAYU_HASH_CALC_KEY ? `${PAYU_HASH_CALC_KEY.substring(0,3)}...` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] PAYU_HASH_CALC_SALT (Client Secret for HASH):", PAYU_HASH_CALC_SALT ? `******` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] Transaction ID (txnid):", txnid);
    console.log("[PayU Initiate DEBUG] Amount:", amount);
    console.log("[PayU Initiate DEBUG] Product Info:", productinfo);
    console.log("[PayU Initiate DEBUG] First Name:", firstname);
    console.log("[PayU Initiate DEBUG] Email:", email);
    console.log("[PayU Initiate DEBUG] Phone (sent to PayU in form data, NOT usually in this hash):", phone);
    console.log("[PayU Initiate DEBUG] UDF1 (planId):", udf1);
    console.log("[PayU Initiate DEBUG] UDF2 (teacherId):", udf2);
    console.log("[PayU Initiate DEBUG] Full hashStringParams array (for HASH calculation - credentials masked):", JSON.stringify(hashStringParams.map((p,i) => (i === 0 || i === hashStringParams.length -1) ? (p ? '******' : 'EMPTY_OR_NOT_SET') : p)));
    console.log("[PayU Initiate DEBUG] Raw String to be Hashed (hashString - credentials masked):\n", hashString.replace(PAYU_HASH_CALC_KEY!, "******KEY_FOR_HASH******").replace(PAYU_HASH_CALC_SALT!, "******SALT_FOR_HASH******"));
    
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');
    console.log("[PayU Initiate DEBUG] Calculated SHA512 Hash:", hash);
    console.log("--------------------------------------------------------------------");

    const payuFormInputs = {
      key: PAYU_FORM_SUBMIT_KEY, // This is the 'key' param for the PayU form, typically your public Client ID/Merchant Key
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl,
      furl,
      hash, // The calculated hash
      udf1: udf1,
      udf2: udf2,
      udf3: udf3,
      udf4: udf4,
      udf5: udf5,
      // Other fields like 'service_provider' (payu_paisa) can be added if needed, but often not required for basic integration.
    };

    return NextResponse.json(payuFormInputs, { status: 200 });

  } catch (error: any) {
    console.error('[PayU Initiate CRITICAL ERROR] Error creating PayU payment initiation data:', error);
    return NextResponse.json({ error: error.message || 'Failed to initiate payment.' }, { status: 500 });
  }
}
