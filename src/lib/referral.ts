import { randomInt } from "crypto";

/**
 * Generate a unique referral code in format HF-XXXXX
 * Uses crypto.randomInt for better security than Math.random
 */
export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "HF-";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(randomInt(chars.length));
  }
  return code;
}
