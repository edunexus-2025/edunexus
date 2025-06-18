
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
      console.error("[PayU Initiate ERROR] Missing required payment details from client. Body received:", body);
      return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
    }

    const txnid = `EDUNEXUS_TEACHER_${teacherId.substring(0,5)}_${Date.now()}`;
    const productinfo = `EduNexus Teacher Plan - ${planId}`;
    const firstname = teacherName.split(' ')[0] || 'Teacher'; // PayU requires firstname
    const email = teacherEmail;
    const phone = teacherPhone.replace(/\D/g, ''); // Ensure phone is digits only
    const surl = `${APP_BASE_URL}/api/payu/handle-teacher-plan-response`;
    const furl = `${APP_BASE_URL}/api/payu/handle-teacher-plan-response`;

    // UDFs (User Defined Fields)
    const udf1 = planId;     // Storing planId
    const udf2 = teacherId;  // Storing teacherId
    const udf3 = "";
    const udf4 = "";
    const udf5 = "";
    // udf6 to udf10 will also be empty strings in the hash below

    // Construct the hash string. The order is CRITICAL and must match PayU's documentation.
    // Standard order: key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|SALT
    const hashStringParams = [
      PAYU_MERCHANT_KEY,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1, // planId
      udf2, // teacherId
      udf3, // ""
      udf4, // ""
      udf5, // ""
      "",   // udf6
      "",   // udf7
      "",   // udf8
      "",   // udf9
      "",   // udf10
      PAYU_SALT
    ];
    const hashString = hashStringParams.join('|');
    
    // --- DEBUGGING LOGS ---
    console.log("--------------------------------------------------------------------");
    console.log("[PayU Initiate DEBUG] Preparing to hash for PayU request.");
    console.log("[PayU Initiate DEBUG] Merchant Key (from env):", PAYU_MERCHANT_KEY ? `${PAYU_MERCHANT_KEY.substring(0,3)}...` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] SALT (from env):", PAYU_SALT ? `${PAYU_SALT.substring(0,3)}...` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] Transaction ID (txnid):", txnid);
    console.log("[PayU Initiate DEBUG] Amount:", amount);
    console.log("[PayU Initiate DEBUG] Product Info:", productinfo);
    console.log("[PayU Initiate DEBUG] First Name:", firstname);
    console.log("[PayU Initiate DEBUG] Email:", email);
    console.log("[PayU Initiate DEBUG] Phone:", phone);
    console.log("[PayU Initiate DEBUG] UDF1 (planId):", udf1);
    console.log("[PayU Initiate DEBUG] UDF2 (teacherId):", udf2);
    console.log("[PayU Initiate DEBUG] UDF3:", udf3);
    console.log("[PayU Initiate DEBUG] UDF4:", udf4);
    console.log("[PayU Initiate DEBUG] UDF5:", udf5);
    console.log("[PayU Initiate DEBUG] UDF6-10 are empty strings.");
    console.log("[PayU Initiate DEBUG] Full hashStringParams array:", JSON.stringify(hashStringParams));
    console.log("[PayU Initiate DEBUG] Raw String to be Hashed (hashString):\n", hashString);
    console.log("--------------------------------------------------------------------");
    // --- END DEBUGGING LOGS ---
    
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
      udf1: planId, 
      udf2: teacherId, 
      udf3: udf3,
      udf4: udf4,
      udf5: udf5,
      // Note: Only explicitly send UDFs if they have values or PayU requires them as form params.
      // Empty UDFs (udf6-10) are part of the hash, but not necessarily sent as form fields if empty.
      // Check PayU documentation for which params are optional/mandatory in the form submission.
      // service_provider: 'payu_paisa', // Often required for PayU Test environment. For live, it might not be needed or might be different.
    };

    return NextResponse.json(payuFormInputs, { status: 200 });

  } catch (error: any) {
    console.error('[PayU Initiate CRITICAL ERROR] Error creating PayU payment initiation data:', error);
    return NextResponse.json({ error: error.message || 'Failed to initiate payment.' }, { status: 500 });
  }
}
