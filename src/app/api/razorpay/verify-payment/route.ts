
import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing Razorpay payment details for verification.' }, { status: 400 });
    }

    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!razorpayKeySecret) {
      console.error('Razorpay Key Secret is not configured on the server for verification.');
      return NextResponse.json({ error: 'Payment verification gateway not configured.' }, { status: 500 });
    }

    const body = razorpay_order_id + "|" + razorpay_payment_id;

    const expectedSignature = crypto
      .createHmac('sha256', razorpayKeySecret)
      .update(body.toString())
      .digest('hex');

    const isAuthentic = expectedSignature === razorpay_signature;

    if (isAuthentic) {
      // Payment is authentic.
      // In a production system, you would now update the database record for the order,
      // mark it as paid, and fulfill the order (e.g., grant access to the plan).
      // For this prototype, we just return success. The client will handle DB update.
      return NextResponse.json({ verified: true, message: "Payment verified successfully." }, { status: 200 });
    } else {
      return NextResponse.json({ verified: false, error: "Payment verification failed. Signature mismatch." }, { status: 400 });
    }

  } catch (error: any) {
    console.error('Error verifying Razorpay payment:', error);
    return NextResponse.json({ verified: false, error: error.message || 'Internal Server Error during verification' }, { status: 500 });
  }
}
