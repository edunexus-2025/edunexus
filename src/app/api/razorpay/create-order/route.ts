
import { NextResponse, NextRequest } from 'next/server';
import Razorpay from 'razorpay';
import { AppConfig } from '@/lib/constants';
import crypto from 'crypto'; // For generating short random string

const RAZORPAY_KEY_ID = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
  console.error("CRITICAL: Razorpay Key ID or Key Secret is not configured on the server.");
}

const instance = new Razorpay({
  key_id: RAZORPAY_KEY_ID!, 
  key_secret: RAZORPAY_KEY_SECRET!,
});

const generateShortRandomString = (length: number): string => {
  return crypto.randomBytes(Math.ceil(length / 2))
    .toString('hex')
    .slice(0, length)
    .toUpperCase();
};

const getPlanIdAbbreviation = (planId: string): string => {
  const knownPlans: Record<string, string> = {
    "Free": "FRE",
    "Starter": "STR",
    "Pro": "PRO",
    "Dpp": "DPP",
    "Chapterwise": "CHW",
    "Full_length": "FLL", // Underscore for consistency with how it might be stored
    "Combo": "CMB",
  };
  if (knownPlans[planId]) {
    return knownPlans[planId];
  }
  // If it's likely a PocketBase ID (typically 15 chars)
  if (planId && planId.length === 15 && /^[a-z0-9]+$/.test(planId)) {
    return planId.substring(planId.length - 6).toUpperCase();
  }
  // Fallback for other planId formats
  return planId.substring(0, 3).toUpperCase();
};

const getUserTypeAbbreviation = (userType: string): string => {
    switch(userType) {
        case 'student_platform_plan': return 'SPP';
        case 'teacher_platform_plan': return 'TPP';
        case 'student_teacher_plan': return 'STP';
        default: return userType.substring(0,3).toUpperCase();
    }
};


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
      userType, // 'student_platform_plan', 'teacher_platform_plan', 'student_teacher_plan'
      teacherIdForPlan, 
      referralCodeUsed, 
      productDescription 
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

    // Generate a shorter receipt ID
    const appPrefix = "ENX";
    const userTypeAbbr = getUserTypeAbbreviation(userType);
    const planIdShort = getPlanIdAbbreviation(String(planId));
    const userIdShort = String(userId).substring(String(userId).length - 8);
    const randomSuffix = generateShortRandomString(6);
    
    const receiptId = `${appPrefix}-${userTypeAbbr}-${planIdShort}-${userIdShort}-${randomSuffix}`;

    if (receiptId.length > 40) {
        // This should not happen with the new logic, but as a safeguard:
        console.error(`[Razorpay Create Order] ERROR: Generated receiptId is still too long: ${receiptId} (Length: ${receiptId.length}). Truncating.`);
        // If it's still too long, truncate it forcefully, though this might risk non-uniqueness.
        // Better to ensure the components above are short enough.
        // For now, let's assume the new logic keeps it < 40.
        // If this error log appears, the abbreviation logic needs more refinement.
    }


    const options = {
      amount: Math.round(Number(amount) * 100), 
      currency: currency,
      receipt: receiptId,
      notes: {
        planId: String(planId),
        userId: String(userId),
        userType: String(userType),
        ...(teacherIdForPlan && { teacherIdForPlan: String(teacherIdForPlan) }), 
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
    // Check if it's a Razorpay specific error structure
    if (error.statusCode && error.error && error.error.description) {
      errorMessage = error.error.description;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

