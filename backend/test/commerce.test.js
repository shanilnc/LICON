import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateItems, discountFor } from "../src/services/commerce.js";
import { verifySignature } from "../src/services/payment.js";
import { createHmac } from "node:crypto";
test("duplicate lines aggregate and quantity limits apply", () => {
  assert.equal(
    aggregateItems([
      { product: "1", quantity: 2 },
      { product: "1", quantity: 3 },
    ])[0].quantity,
    5,
  );
  assert.throws(() =>
    aggregateItems([
      { product: "1", quantity: 20 },
      { product: "1", quantity: 1 },
    ]),
  );
});
test("discount cannot exceed eligible product subtotal", () => {
  const lines = [
    { category: "tables", quantity: 1, price: 100 },
    { category: "sofas", quantity: 1, price: 1000 },
  ];
  assert.equal(
    discountFor(
      { active: true, type: "FIXED", value: 500, categories: ["tables"] },
      lines,
    ),
    100,
  );
  assert.throws(() =>
    discountFor(
      { active: true, type: "FIXED", value: 100, perCustomerLimit: 1 },
      lines,
      1,
    ),
  );
});
test("payment signature validation rejects malformed or forged input", () => {
  const message = "order|payment",
    secret = "test",
    sig = createHmac("sha256", secret).update(message).digest("hex");
  assert.ok(verifySignature(message, sig, secret));
  assert.equal(verifySignature(message, "bad", secret), false);
  assert.equal(verifySignature("forged", sig, secret), false);
});
