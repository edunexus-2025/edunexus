
'use server';

// This is now a mock OTP generation service.
// It does not send an actual SMS or WhatsApp message.
// For production, you would integrate a real OTP sending service.

export async function generateMockOtp(phoneNumber: string): Promise<{ success: boolean; otp?: string; error?: string; message?: string }> {
  if (!phoneNumber.match(/^\d{10,15}$/)) {
    return { success: false, error: "Invalid phone number format. It should be digits only, e.g., 919876543210." };
  }

  // Simulate OTP generation
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  
  console.log(`Mock OTP generated for ${phoneNumber}: ${otp}. This OTP is NOT sent to the user's device.`);

  // In a real scenario, you might store this OTP (hashed) temporarily with an expiry
  // on the server (e.g., in PocketBase in a temporary collection, or a KV store)
  // for server-side verification.

  // For this simplified version, we return the OTP to the client for mock verification.
  // This is NOT SECURE FOR PRODUCTION.
  return { success: true, otp: otp, message: `Mock OTP generated for ${phoneNumber}. (Visible in server logs).` };
}
