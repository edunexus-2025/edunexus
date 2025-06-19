import { NextResponse, NextRequest } from 'next/server';
import Razorpay from 'razorpay';
import { AppConfig, escapeForPbFilter } from '@/lib/constants';
import crypto from 'crypto'; // For generating short random string
import pb from '@/lib/pocketbase'; // Import PocketBase client for teacher referral validation
import type { TeacherReferralCode } from '@/lib/types';

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
    "Free": "FRE", "Starter": "STR", "Pro": "PRO",
    "Dpp": "DPP", "Chapterwise": "CHW", "Full_length": "FLL", "Combo": "CMB",
  };
  if (knownPlans[planId]) return knownPlans[planId];
  if (planId && planId.length === 15 && /^[a-z0-9]+$/.test(planId)) return planId.substring(planId.length - 6).toUpperCase();
  return planId.substring(0, 3).toUpperCase();
};

const getUserTypeAbbreviation = (userType: string): string => {
    switch(userType) {
        case 'student_platform_plan': return 'SPP';
        case 'teacher_platform_plan': return 'TPP';
        case 'student_teacher_plan': return 'STP'; // Student buying Teacher's Content Plan
        default: return userType.substring(0,3).toUpperCase();
    }
};

export async function POST(request: NextRequest) {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return NextResponse.json({ error: "Payment gateway server configuration error. Contact support." }, { status: 500 });
  }

  try {
    const body = await request.json();
    let {
      amount, // Expected in base currency unit (e.g., 500 for ₹500.00)
      currency = 'INR',
      planId,
      userId,
      userType,
      teacherIdForPlan, // For 'student_teacher_plan': ID of the teacher whose plan is being bought
      referralCodeUsed, // For 'student_teacher_plan': Teacher's referral code
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

    let finalAmount = Number(amount);
    let appliedReferralCodeDetails: string | null = null;

    if (userType === 'student_teacher_plan' && referralCodeUsed && teacherIdForPlan) {
      try {
        const filter = `teacher = "${escapeForPbFilter(teacherIdForPlan)}" && referral_code_string = "${escapeForPbFilter(referralCodeUsed.trim().toUpperCase())}" && (expiry_date = "" || expiry_date = null || expiry_date >= "${new Date().toISOString().split('T')[0]}")`;
        const promoRecord = await pb.collection('teacher_refferal_code').getFirstListItem<TeacherReferralCode>(filter);

        if (promoRecord.applicable_plan_ids.includes(planId)) {
          const discountPercent = Number(promoRecord.discount_percentage);
          if (discountPercent > 0 && discountPercent <= 100) {
            const discountValue = (finalAmount * discountPercent) / 100;
            finalAmount = finalAmount - discountValue;
            appliedReferralCodeDetails = `${promoRecord.referral_code_string} (${discountPercent}% off)`;
            console.log(`[Razorpay Create Order] INFO: Teacher referral code "${referralCodeUsed}" applied. Original: ${amount}, Discount: ${discountPercent}%, New: ${finalAmount}`);
          }
        } else {
          console.log(`[Razorpay Create Order] INFO: Teacher referral code "${referralCodeUsed}" not applicable to plan ${planId}.`);
        }
      } catch (promoError: any) {
        if (promoError.status === 404) {
          console.log(`[Razorpay Create Order] INFO: Teacher referral code "${referralCodeUsed}" not found or expired for teacher ${teacherIdForPlan}.`);
        } else {
          console.warn(`[Razorpay Create Order] WARN: Error validating teacher referral code:`, promoError.data || promoError.message);
        }
      }
    }

    finalAmount = Math.max(1, finalAmount); // Ensure amount is at least 1 (Razorpay minimum)

    const appPrefix = "ENX";
    const userTypeAbbr = getUserTypeAbbreviation(userType);
    const planIdShort = getPlanIdAbbreviation(String(planId));
    const userIdShort = String(userId).substring(String(userId).length - 8);
    const randomSuffix = generateShortRandomString(6);
    const receiptId = `${appPrefix}-${userTypeAbbr}-${planIdShort}-${userIdShort}-${randomSuffix}`.substring(0, 40);

    const options = {
      amount: Math.round(Number(finalAmount) * 100), // Amount in paisa
      currency: currency,
      receipt: receiptId,
      notes: {
        planId: String(planId),
        userId: String(userId),
        userType: String(userType),
        ...(teacherIdForPlan && { teacherIdForPlan: String(teacherIdForPlan) }),
        ...(appliedReferralCodeDetails && { referralCodeUsed: appliedReferralCodeDetails }), // Store applied code with discount
        productDescription: String(productDescription || `Payment for ${planId}`),
        app_name: `${AppConfig.appName} - The Online Test Platform`, // Updated app_name in notes
      },
    };

    console.log("[Razorpay Create Order] INFO: Creating order with options:", options);
    const order = await instance.orders.create(options);
    console.log("[Razorpay Create Order] INFO: Order created successfully:", order);

    return NextResponse.json(order, { status: 200 });

  } catch (error: any) {
    console.error('[Razorpay Create Order] CRITICAL ERROR:', error);
    let errorMessage = "Failed to create Razorpay order.";
    if (error.statusCode && error.error && error.error.description) { errorMessage = error.error.description; }
    else if (error.message) { errorMessage = error.message; }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
