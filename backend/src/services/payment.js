// Provider adapter only. Checkout intentionally does not create unpaid online orders.
// Enable online checkout only with transactional reservations, verified webhooks,
// timeout release, reconciliation and refunds tested end to end.
import Razorpay from "razorpay";
import { createHmac, timingSafeEqual } from "node:crypto";
export function paymentProvider() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
    throw new Error("Payment provider is not configured");
  return new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}
export function verifySignature(message, signature, secret) {
  if (
    !secret ||
    typeof signature !== "string" ||
    !/^[a-f0-9]{64}$/i.test(signature)
  )
    return false;
  const expected = createHmac("sha256", secret).update(message).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
