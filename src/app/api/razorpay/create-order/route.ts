import { NextResponse, NextRequest } from 'next/server';
import Razorpay from 'razorpay';
import { AppConfig } from '@/lib/constants';

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error("CRITICAL: Razorpay Key ID or Key Secret is not configured on the server.");
  // This error should ideally prevent the server from starting or be caught at build time.
  // For a running server, this would be a 500 for any request to this route.
}

const instance = new Razorpay({
  key_id: RAZORPAY_KEY_ID!, // Non-null assertion because we check above
  key_secret: RAZORPAY_KEY_SECRET!,
});

export async function POST(request: NextRequest) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: "Payment gateway server configuration error. Contact support." }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { 
      amount, // Expected in paisa (e.g., 50000 for ₹500.00)
      currency = 'INR', 
      planId, 
      userId, 
      userType, // 'student' or 'teacher'
      teacherIdForPlan, // Only if a student is buying a teacher's specific content plan
      referralCodeUsed, // Optional
      productDescription // e.g., "Upgrade to Pro Plan" or "Subscription to Teacher X's Physics Course"
    } = body;

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: 'Invalid amount provided.' }, { status: 400 });
    }
    if (!planId || !userId || !userType) {
      return NextResponse.json({ error: 'Missing required order details (planId, userId, userType).' }, { status: 400 });
    }
    if (userType === 'student_teacher_plan' && !teacherIdForPlan) {
      return NextResponse.json({ error: 'Missing teacherIdForPlan for student subscribing to a teacher plan.' }, { status: 400 });
    }

    const receiptId = `${AppConfig.appName.replace(/\s+/g, '')}_${userType}_${planId}_${userId}_${Date.now()}`;

    const options = {
      amount: Math.round(Number(amount) * 100), // Amount in paisa
      currency: currency,
      receipt: receiptId,
      notes: {
        planId: String(planId),
        userId: String(userId),
        userType: String(userType),
        ...(teacherIdForPlan && { teacherIdForPlan: String(teacherIdForPlan) }), // Conditionally add teacherIdForPlan
        ...(referralCodeUsed && { referralCodeUsed: String(referralCodeUsed) }),
        productDescription: String(productDescription || `Payment for ${planId}`),
      },
    };

    console.log("[Razorpay Create Order] INFO: Creating order with options:", options);
    const order = await instance.orders.create(options);
    console.log("[Razorpay Create Order] INFO: Order created successfully:", order);

    return NextResponse.json(order, { status: 200 });

  } catch (error: any) {
    console.error('[Razorpay Create Order] CRITICAL ERROR:', error);
    let errorMessage = "Failed to create Razorpay order.";
    if (error.error && error.error.description) { // Razorpay specific error structure
      errorMessage = error.error.description;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}