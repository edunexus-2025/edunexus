
import { NextResponse, NextRequest } from 'next/server';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { AppConfig, Routes } from '@/lib/constants'; // Ensure Routes is imported

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;
const APP_BASE_URL = process.env.NEXT_PUBLIC_APP_BASE_URL || 'http://localhost:9002';


if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error("[Razorpay Verify Payment API ERROR] CRITICAL: Razorpay Key ID or Key Secret is not configured on the server. Check .env variables.");
}

const instance = new Razorpay({
  key_id: RAZORPAY_KEY_ID!,
  key_secret: RAZORPAY_KEY_SECRET!,
});

export async function POST(request: NextRequest) {
  if (!RAZORPAY_KEY_SECRET) {
    console.error("[Razorpay Verify Payment API ERROR] CRITICAL: RAZORPAY_KEY_SECRET is not configured.");
    return NextResponse.json({ error: "Payment gateway server secret not configured." }, { status: 500 });
  }

  let orderIdFromRequest: string | null = null;
  let planIdFromRequest: string | null = null;

  try {
    const body = await request.json();
    const {
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      // These are passed from client for context and will be cross-verified with Razorpay's order notes
      planId: clientPlanId, 
      userId: clientUserId, 
      userType: clientUserType,
      teacherIdForPlan: clientTeacherIdForPlan, // Optional: For student buying teacher's plan
      referralCodeUsed: clientReferralCodeUsed, // Optional
    } = body;

    orderIdFromRequest = razorpay_order_id; // For error reporting
    planIdFromRequest = clientPlanId;    // For error reporting

    console.log("[Razorpay Verify Payment API INFO] Received verification request. Client-provided context:", { clientPlanId, clientUserId, clientUserType, clientTeacherIdForPlan, clientReferralCodeUsed, razorpay_order_id });

    if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
      return NextResponse.json({ error: "Missing required Razorpay payment verification details (payment_id, order_id, or signature)." }, { status: 400 });
    }
    if (!clientPlanId || !clientUserId || !clientUserType) {
      return NextResponse.json({ error: "Missing required client context (planId, userId, or userType)." }, { status: 400 });
    }
    if (clientUserType === 'student_teacher_plan' && !clientTeacherIdForPlan) {
      return NextResponse.json({ error: "Missing teacherIdForPlan for 'student_teacher_plan' user type." }, { status: 400 });
    }


    // --- 1. Verify Razorpay Signature ---
    const textToHash = `${razorpay_order_id}|${razorpay_payment_id}`;
    const generated_signature = crypto.createHmac('sha256', RAZORPAY_KEY_SECRET).update(textToHash).digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.warn(`[Razorpay Verify Payment API WARN] Signature mismatch for order ${razorpay_order_id}. Calculated: ${generated_signature}, Received: ${razorpay_signature}`);
      return NextResponse.json({ verified: false, error: "Payment verification failed (security check).", status: 'failure' }, { status: 400 });
    }
    console.log(`[Razorpay Verify Payment API INFO] Signature verified successfully for order ${razorpay_order_id}.`);

    // --- 2. Fetch Order Details from Razorpay Server-Side for Cross-Validation ---
    let orderDetailsFromRazorpay;
    try {
      orderDetailsFromRazorpay = await instance.orders.fetch(razorpay_order_id);
      console.log("[Razorpay Verify Payment API INFO] Fetched order details from Razorpay:", orderDetailsFromRazorpay);
    } catch (fetchError: any) {
      console.error(`[Razorpay Verify Payment API ERROR] Failed to fetch order ${razorpay_order_id} from Razorpay:`, fetchError);
      return NextResponse.json({ verified: false, error: `Failed to fetch order details from Razorpay: ${fetchError.error?.description || fetchError.message || 'Unknown Razorpay API error'}.`, status: 'error' }, { status: 500 });
    }

    // --- 3. Validate Order Details (Critical: compare notes with client-sent data) ---
    const notes = orderDetailsFromRazorpay.notes;
    if (!notes || typeof notes !== 'object') {
      console.error(`[Razorpay Verify Payment API ERROR] Razorpay order ${razorpay_order_id} is missing 'notes' object or it's not an object.`);
      return NextResponse.json({ verified: false, error: "Order details incomplete (missing notes). Cannot verify context.", status: 'error' }, { status: 400 });
    }

    const serverPlanId = String(notes.planId);
    const serverUserId = String(notes.userId);
    const serverUserType = String(notes.userType);
    const serverTeacherIdForPlan = notes.teacherIdForPlan ? String(notes.teacherIdForPlan) : undefined;
    // const serverReferralCodeUsed = notes.referralCodeUsed ? String(notes.referralCodeUsed) : undefined; // This was what was applied, if any

    if (serverUserId !== String(clientUserId) ||
        serverPlanId !== String(clientPlanId) ||
        serverUserType !== String(clientUserType) ||
        (clientUserType === 'student_teacher_plan' && serverTeacherIdForPlan !== String(clientTeacherIdForPlan))
        // Referral code comparison might be tricky if the 'applied details' string format changes. For now, primary validation is on other fields.
    ) {
      console.error("[Razorpay Verify Payment API ERROR] Mismatch between client-sent context and Razorpay order notes.", 
        { client: { clientUserId, clientPlanId, clientUserType, clientTeacherIdForPlan }, serverNotes: { serverUserId, serverPlanId, serverUserType, serverTeacherIdForPlan } });
      return NextResponse.json({ verified: false, error: "Order context mismatch during verification. Transaction details do not align.", status: 'error' }, { status: 400 });
    }
    console.log("[Razorpay Verify Payment API INFO] Client context matches Razorpay order notes.");

    // --- 4. Check Payment Status on Razorpay's Side ---
    if (orderDetailsFromRazorpay.status !== 'paid') {
      console.warn(`[Razorpay Verify Payment API WARN] Razorpay order ${razorpay_order_id} status is '${orderDetailsFromRazorpay.status}', not 'paid'.`);
      return NextResponse.json({ verified: false, error: `Payment not completed successfully. Status: ${orderDetailsFromRazorpay.status}`, status: 'failure' }, { status: 400 });
    }
    console.log(`[Razorpay Verify Payment API INFO] Payment for order ${razorpay_order_id} is authentic and status is 'paid'.`);

    // --- 5. Return Success with Verified Details to Client ---
    // The client will now handle the database update.
    return NextResponse.json({
      verified: true,
      message: "Payment verified successfully. Client will now update plan.",
      status: 'success', // For client-side status page
      order_id: razorpay_order_id,
      payment_id: razorpay_payment_id, // For record keeping if needed client-side before redirect
      // Pass back the verified notes details for the client to use for DB update
      planId: serverPlanId,
      userId: serverUserId,
      userType: serverUserType,
      teacherIdForPlan: serverTeacherIdForPlan, // Will be undefined if not student_teacher_plan
      referralCodeUsed: clientReferralCodeUsed, // Pass back the original code client sent, if it was sent
      productDescription: notes.productDescription || `Payment for ${serverPlanId}`,
      amount: orderDetailsFromRazorpay.amount / 100, // Convert back to base currency units
      currency: orderDetailsFromRazorpay.currency,
    }, { status: 200 });

  } catch (error: any) {
    console.error("[Razorpay Verify Payment API CRITICAL ERROR] (Outer Try-Catch):", error);
    let errorMessage = "Payment verification failed due to a server error.";
    if (error.statusCode && error.error && error.error.description) { // Razorpay SDK error structure
      errorMessage = error.error.description;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return NextResponse.json({ 
      verified: false, 
      error: errorMessage,
      status: 'error',
      order_id: orderIdFromRequest || 'N/A_VERIFY_ERROR_OUTER',
      planName: planIdFromRequest || 'UnknownPlan',
    }, { status: 500 });
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
