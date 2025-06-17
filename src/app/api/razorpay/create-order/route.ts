
import { NextResponse } from 'next/server';
import Razorpay from 'razorpay';
import crypto from 'crypto';

export async function POST(request: Request) {
  console.log('[/api/razorpay/create-order] INFO: Function invoked.');

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!razorpayKeyId || !razorpayKeySecret) {
    console.error('[/api/razorpay/create-order] CRITICAL ERROR: Razorpay API keys (RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET) are NOT configured on the server. This function will fail.');
    return NextResponse.json({ error: 'Payment gateway server configuration error. API keys missing.' }, { status: 500 });
  }
  console.log('[/api/razorpay/create-order] INFO: Razorpay API keys seem to be present.');

  try {
    const { amount, currency = 'INR', planId, userId } = await request.json();
    console.log('[/api/razorpay/create-order] INFO: Request body parsed:', { amount, currency, planId, userId });

    if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
      console.error('[/api/razorpay/create-order] ERROR: Invalid amount received from client.', { amount });
      return NextResponse.json({ error: 'Invalid amount. Amount must be a positive number.' }, { status: 400 });
    }
    if (!planId || !userId) {
      console.error('[/api/razorpay/create-order] ERROR: Missing planId or userId.', { planId, userId });
      return NextResponse.json({ error: 'Missing required fields: planId, userId' }, { status: 400 });
    }

    let instance;
    try {
        instance = new Razorpay({
            key_id: razorpayKeyId,
            key_secret: razorpayKeySecret,
        });
        console.log('[/api/razorpay/create-order] INFO: Razorpay instance created successfully.');
    } catch (initError: any) {
        console.error('[/api/razorpay/create-order] CRITICAL ERROR: Failed to initialize Razorpay instance. Check API key format or library issue.', initError);
        return NextResponse.json({ error: 'Failed to initialize payment gateway.', success: false }, { status: 500 });
    }


    // Shortened receipt ID format
    const shortPlanId = String(planId).substring(0, 5);
    const shortUserId = String(userId).substring(0, 8);
    const timestampSuffix = Date.now().toString().slice(-5);
    const randomSuffix = crypto.randomBytes(2).toString('hex');
    const receiptId = `RCPT_${shortPlanId}_${shortUserId}_${timestampSuffix}_${randomSuffix}`;

    if (receiptId.length > 40) {
        console.warn('[/api/razorpay/create-order] WARN: Generated Razorpay receipt ID is potentially too long:', receiptId);
    }
    console.log('[/api/razorpay/create-order] INFO: Generated receiptId:', receiptId);


    const options = {
      amount: Math.round(amount * 100), 
      currency,
      receipt: receiptId,
      notes: {
        plan_id: String(planId), // Ensure notes are strings
        user_id: String(userId),
        integration_type: 'NextJS_API_Route_EduNexus_V2'
      }
    };
    console.log('[/api/razorpay/create-order] INFO: Razorpay order options prepared:', options);

    const order = await instance.orders.create(options);
    console.log('[/api/razorpay/create-order] INFO: Razorpay order successfully created with ID:', order.id);

    return NextResponse.json(order, { status: 200 });

  } catch (error: any) {
    console.error('[/api/razorpay/create-order] CRITICAL ERROR in try-catch block:', error);
    if (error.statusCode && error.error && error.error.description) { // Razorpay specific error structure
        console.error("[/api/razorpay/create-order] ERROR: Razorpay API Error Details:", {
            code: error.error.code,
            description: error.error.description,
            source: error.error.source,
            step: error.error.step,
            reason: error.error.reason,
            metadata: error.error.metadata,
        });
        return NextResponse.json({ error: `Razorpay error: ${error.error.description} (Code: ${error.error.code})` }, { status: error.statusCode });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error while creating Razorpay order.' }, { status: 500 });
  }
}
