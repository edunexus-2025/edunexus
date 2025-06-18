
import { NextResponse } from 'next/server';
import crypto from 'crypto'; // Node.js crypto module for SHA512

// These are read from .env.local (or your deployment environment variables)
const CLIENT_FACING_PAYU_CLIENT_ID = process.env.NEXT_PUBLIC_PAYU_CLIENT_ID; // For the form data, 'key'
const SERVER_SIDE_PAYU_CLIENT_ID = process.env.PAYU_CLIENT_ID_SERVER;     // For hash calculation
const SERVER_SIDE_PAYU_CLIENT_SECRET = process.env.PAYU_CLIENT_SECRET;   // For hash calculation
const PAYU_ACTION_URL = process.env.PAYU_PAYMENT_URL || 'https://secure.payu.in/_payment'; // Default to live if not set
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL;

export async function POST(request: Request) {
  if (!CLIENT_FACING_PAYU_CLIENT_ID || !SERVER_SIDE_PAYU_CLIENT_ID || !SERVER_SIDE_PAYU_CLIENT_SECRET) {
    console.error("[PayU Initiate ERROR] CRITICAL: PayU Client ID (Client or Server) or Client Secret is NOT configured on the server. Check .env.local and deployment variables.");
    return NextResponse.json({ error: 'Payment gateway server configuration error (Client ID/Secret missing). Please contact support.' }, { status: 500 });
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
      SERVER_SIDE_PAYU_CLIENT_ID, // Use the server-side Client ID for hashing
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      udf1, udf2, udf3, udf4, udf5, 
      "", "", "", "", "", // udf6-udf10
      SERVER_SIDE_PAYU_CLIENT_SECRET // Use the server-side Client Secret (Salt equivalent)
    ];
    const hashString = hashStringParams.join('|');
    
    // --- Debugging Logs ---
    console.log("--------------------------------------------------------------------");
    console.log("[PayU Initiate DEBUG] Preparing to hash for PayU request.");
    console.log("[PayU Initiate DEBUG] Client Facing Client ID (for form 'key'):", CLIENT_FACING_PAYU_CLIENT_ID ? `${CLIENT_FACING_PAYU_CLIENT_ID.substring(0,3)}...` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] Server Client ID (for HASH):", SERVER_SIDE_PAYU_CLIENT_ID ? `${SERVER_SIDE_PAYU_CLIENT_ID.substring(0,3)}...` : "NOT SET!");
    console.log("[PayU Initiate DEBUG] Server Client Secret (for HASH):", SERVER_SIDE_PAYU_CLIENT_SECRET ? `******` : "NOT SET!"); // Mask secret
    console.log("[PayU Initiate DEBUG] Transaction ID (txnid):", txnid);
    console.log("[PayU Initiate DEBUG] Amount:", amount);
    console.log("[PayU Initiate DEBUG] Product Info:", productinfo);
    console.log("[PayU Initiate DEBUG] First Name:", firstname);
    console.log("[PayU Initiate DEBUG] Email:", email);
    console.log("[PayU Initiate DEBUG] Phone (sent to PayU in form data, NOT in this hash):", phone);
    console.log("[PayU Initiate DEBUG] UDF1 (planId):", udf1);
    console.log("[PayU Initiate DEBUG] UDF2 (teacherId):", udf2);
    console.log("[PayU Initiate DEBUG] UDF3-5:", udf3, udf4, udf5);
    console.log("[PayU Initiate DEBUG] Full hashStringParams array (for HASH calculation):", JSON.stringify(hashStringParams.map((p,i) => i === hashStringParams.length -1 ? '******' : p))); // Mask secret in log
    console.log("[PayU Initiate DEBUG] Raw String to be Hashed (hashString):\n", hashString.replace(SERVER_SIDE_PAYU_CLIENT_SECRET!, "******")); // Mask secret
    // --- End Debugging Logs ---
    
    const hash = crypto.createHash('sha512').update(hashString).digest('hex');
    console.log("[PayU Initiate DEBUG] Calculated SHA512 Hash:", hash);
    console.log("--------------------------------------------------------------------");

    const payuFormInputs = {
      key: CLIENT_FACING_PAYU_CLIENT_ID, // This is the 'key' param for the PayU form, use public client ID
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
