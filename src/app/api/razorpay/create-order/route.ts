
// This file is no longer needed as Razorpay integration is being removed.
// You can delete this file.
// To prevent build errors, I will leave it with a simple placeholder response.

import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  console.warn('[/api/razorpay/create-order] WARN: This Razorpay endpoint is deprecated and should not be called.');
  return NextResponse.json({ error: 'Razorpay integration has been removed. Use PayU instead.' }, { status: 410 }); // 410 Gone
}
