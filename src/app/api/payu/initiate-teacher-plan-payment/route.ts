
import { NextResponse } from 'next/server';
import crypto from 'crypto'; // Node.js crypto module for SHA512

// These are read from .env.local (or your deployment environment variables)
const CLIENT_FACING_PAYU_KEY = process.env.NEXT_PUBLIC_PAYU_KEY; // For the form data, 'key'
const SERVER_SIDE_PAYU_MERCHANT_KEY = process.env.PAYU_MERCHANT_KEY_SERVER; // For hash calculation
const SERVER_SIDE_PAYU_SALT = process.env.PAYU_SALT; // For hash calculation
const PAYU_ACTION_URL = process.env.PAYU_PAYMENT_URL || 'https://secure.payu.in/_payment'; // Default to live if not set
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL;

export async function POST(request: Request) {
  if (!CLIENT_FACING_PAYU_KEY || !SERVER_SIDE_PAYU_MERCHANT_KEY || !SERVER_SIDE_PAYU_SALT) {
    console.error("[PayU Initiate ERROR] CRITICAL: PayU Merchant Key (Client or Server) or Salt is NOT configured on the server. Check .env.local and deployment variables.");
    return NextResponse.json({ error: 'Payment gateway server configuration error (Key/Salt missing). Please contact support.' }, { status: 500 });
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
    
    const hashStringParams = [
      SERVER_SIDE_PAYU_MERCHANT_KEY, // Use the server-side specific key for hashing
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1, udf2, udf3, udf4, udf5, 
      "", "", "", "", "", // udf6-udf10
      SERVER_SIDE_PAYU_SALT // Use the server-side specific salt
    ];
    const hashString = hashStringParams.join('|');
    
    // --- Debugging Logs ---
    console.log("--------------------------------------------------------------------");
    console.log("[PayU Initiate DEBUG] Preparing to hash for PayU request.");
    console.log("[PayU Initiate DEBUG] Client Facing Key (for form):", CLIENT_FACING_PAYU_KEY ? `${CLIENT_FACING_PAYU_KEY.substring(0,3)}...` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] Server Merchant Key (for HASH):", SERVER_SIDE_PAYU_MERCHANT_KEY ? `${SERVER_SIDE_PAYU_MERCHANT_KEY.substring(0,3)}...` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] Server SALT (for HASH):", SERVER_SIDE_PAYU_SALT ? `${SERVER_SIDE_PAYU_SALT.substring(0,3)}...` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] Transaction ID (txnid):", txnid);
    console.log("[PayU Initiate DEBUG] Amount:", amount);
    console.log("[PayU Initiate DEBUG] Product Info:", productinfo);
    console.log("[PayU Initiate DEBUG] First Name:", firstname);
    console.log("[PayU Initiate DEBUG] Email:", email);
    console.log("[PayU Initiate DEBUG] Phone (sent to PayU in form data, NOT in this hash):", phone);
    console.log("[PayU Initiate DEBUG] UDF1 (planId):", udf1);
    console.log("[PayU Initiate DEBUG] UDF2 (teacherId):", udf2);
    console.log("[PayU Initiate DEBUG] UDF3-5:", udf3, udf4, udf5);
    console.log("[PayU Initiate DEBUG] Full hashStringParams array (for HASH calculation):", JSON.stringify(hashStringParams));
    console.log("[PayU Initiate DEBUG] Raw String to be Hashed (hashString):\n", hashString);
    // --- End Debugging Logs ---
    
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');
    console.log("[PayU Initiate DEBUG] Calculated SHA512 Hash:", hash);
    console.log("--------------------------------------------------------------------");

    const payuFormInputs = {
      key: CLIENT_FACING_PAYU_KEY, // This is the 'key' param for the PayU form
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone, 
      surl,
      furl,
      hash,
      udf1: udf1, 
      udf2: udf2, 
      udf3: udf3,
      udf4: udf4,
      udf5: udf5,
      // service_provider: 'payu_paisa', // Often required for PayU Test environment. Check if needed for LIVE.
    };

    return NextResponse.json(payuFormInputs, { status: 200 });

  } catch (error: any) {
    console.error('[PayU Initiate CRITICAL ERROR] Error creating PayU payment initiation data:', error);
    return NextResponse.json({ error: error.message || 'Failed to initiate payment.' }, { status: 500 });
  }
}
