
import { NextResponse } from 'next/server';
import crypto from 'crypto'; // Node.js crypto module for SHA512

// These are read from .env (which should source from .env.local)
const PAYU_FORM_KEY = process.env.NEXT_PUBLIC_PAYU_CLIENT_ID; // Public Client ID for form's 'key'
const PAYU_HASH_KEY_SERVER = process.env.NEXT_PUBLIC_PAYU_CLIENT_ID; // Client ID for server-side HASH (often same as public)
const PAYU_CLIENT_SECRET_SERVER = process.env.PAYU_CLIENT_SECRET;   // Client Secret (SALT) for server-side HASH
const PAYU_ACTION_URL = process.env.PAYU_PAYMENT_URL || 'https://secure.payu.in/_payment';
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL;

export async function POST(request: Request) {
  if (!PAYU_FORM_KEY || !PAYU_HASH_KEY_SERVER || !PAYU_CLIENT_SECRET_SERVER) {
    console.error("[PayU Initiate ERROR] CRITICAL: PayU Client ID or Client Secret is NOT configured on the server. Check .env variables (NEXT_PUBLIC_PAYU_CLIENT_ID, PAYU_CLIENT_SECRET).");
    return NextResponse.json({ error: 'Payment gateway server configuration error. Contact support.' }, { status: 500 });
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
      teacherPhone, // This is the one sent from frontend, make sure it's clean
    } = body;

    if (!amount || !planId || !teacherId || !teacherEmail || !teacherName || !teacherPhone) {
      console.error("[PayU Initiate ERROR] Missing required payment details from client. Body received:", body);
      return NextResponse.json({ error: 'Missing required payment details.' }, { status: 400 });
    }

    const txnid = `EDUNEXUS_TEACHER_${teacherId.substring(0,5)}_${Date.now()}`;
    const productinfo = `EduNexus Teacher Plan - ${planId}`;
    const firstname = teacherName.split(' ')[0] || 'Teacher'; // Ensure teacherName is not empty
    const email = teacherEmail;
    const phone = String(teacherPhone).replace(/\D/g, ''); // Clean phone number
    const surl = `${APP_BASE_URL}/api/payu/handle-teacher-plan-response`;
    const furl = `${APP_BASE_URL}/api/payu/handle-teacher-plan-response`;

    const udf1 = planId;
    const udf2 = teacherId;
    const udf3 = ""; // teacherEmail for reference, if needed, or keep empty
    const udf4 = ""; // teacherName for reference, if needed, or keep empty
    const udf5 = ""; // teacherPhone for reference, if needed, or keep empty

    // Standard PayU request hash string: KEY|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5|udf6|udf7|udf8|udf9|udf10|SALT
    const hashStringParams = [
      PAYU_HASH_KEY_SERVER, // Use server-side Client ID (Key) for hashing
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1, udf2, udf3, udf4, udf5,
      "", "", "", "", "", // udf6-udf10
      PAYU_CLIENT_SECRET_SERVER // Use server-side Client Secret (Salt) for hashing
    ];
    const hashString = hashStringParams.join('|');
    
    console.log("--------------------------------------------------------------------");
    console.log("[PayU Initiate DEBUG] Preparing to hash for PayU request.");
    console.log("[PayU Initiate DEBUG] PAYU_FORM_KEY (for form 'key' - public Client ID):", PAYU_FORM_KEY ? `${PAYU_FORM_KEY.substring(0,3)}...` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] PAYU_HASH_KEY_SERVER (for HASH - server Client ID):", PAYU_HASH_KEY_SERVER ? `${PAYU_HASH_KEY_SERVER.substring(0,3)}...` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] PAYU_CLIENT_SECRET_SERVER (for HASH - server Client Secret/Salt):", PAYU_CLIENT_SECRET_SERVER ? `******` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] Transaction ID (txnid):", txnid);
    console.log("[PayU Initiate DEBUG] Amount:", amount);
    console.log("[PayU Initiate DEBUG] Product Info:", productinfo);
    console.log("[PayU Initiate DEBUG] First Name:", firstname);
    console.log("[PayU Initiate DEBUG] Email:", email);
    console.log("[PayU Initiate DEBUG] Phone (sent to PayU in form data):", phone);
    console.log("[PayU Initiate DEBUG] UDF1 (planId):", udf1);
    console.log("[PayU Initiate DEBUG] UDF2 (teacherId):", udf2);
    console.log("[PayU Initiate DEBUG] UDF3 (sent as empty):", udf3);
    console.log("[PayU Initiate DEBUG] UDF4 (sent as empty):", udf4);
    console.log("[PayU Initiate DEBUG] UDF5 (sent as empty):", udf5);
    console.log("[PayU Initiate DEBUG] Full hashStringParams array (for HASH calculation - credentials masked):", JSON.stringify(hashStringParams.map((p,i) => (i === 0 || i === hashStringParams.length -1) ? (p ? '******' : 'EMPTY_OR_NOT_SET') : p)));
    console.log("[PayU Initiate DEBUG] Raw String to be Hashed (hashString - credentials masked):\n", hashString.replace(PAYU_HASH_KEY_SERVER!, "******KEY_FOR_HASH******").replace(PAYU_CLIENT_SECRET_SERVER!, "******SECRET_FOR_HASH******"));
    
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');
    console.log("[PayU Initiate DEBUG] Calculated SHA512 Hash:", hash);
    console.log("--------------------------------------------------------------------");

    const payuFormInputs = {
      key: PAYU_FORM_KEY, // This is the 'key' param for the PayU form (public Client ID)
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone, // Cleaned phone number
      surl,
      furl,
      hash, 
      udf1: udf1,
      udf2: udf2,
      udf3: udf3,
      udf4: udf4,
      udf5: udf5,
    };

    return NextResponse.json(payuFormInputs, { status: 200 });

  } catch (error: any) {
    console.error('[PayU Initiate CRITICAL ERROR] Error creating PayU payment initiation data:', error);
    return NextResponse.json({ error: error.message || 'Failed to initiate payment.' }, { status: 500 });
  }
}

    