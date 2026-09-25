import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import {
  Product,
  User,
  DeliveryZone,
  Order,
  Coupon,
} from "../src/models/index.js";
let repl, server, base, cookie, ownerCookie, staffCookie, product;
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-secret-not-for-real-deployment-123456789";
process.env.CLIENT_URL = "http://localhost:5173";
process.env.ADMIN_URL = "http://localhost:5174";
async function request(
  path,
  method = "GET",
  body,
  session = cookie,
  origin = process.env.CLIENT_URL,
) {
  const r = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      ...(session ? { Cookie: session } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
before(
  async () => {
    repl = await MongoMemoryReplSet.create({
      replSet: { count: 1 },
      binary: { version: "7.0.24" },
    });
    await mongoose.connect(repl.getUri());
    const { app } = await import("../src/server.js");
    server = app.listen(0);
    await new Promise((r) => server.once("listening", r));
    base = `http://127.0.0.1:${server.address().port}/api`;
    await Promise.all([
      User.init(),
      Product.init(),
      Order.init(),
      Coupon.init(),
    ]);
    let r = await request("/auth/register", "POST", {
      name: "Test Buyer",
      email: "buyer@example.test",
      password: "Test-password-123",
    });
    assert.equal(r.status, 201);
    cookie = r.cookie;
    for (const role of ["OWNER", "STAFF"]) {
      await User.create({
        name: role,
        email: role.toLowerCase() + "@example.test",
        password: await bcrypt.hash("Test-password-123", 4),
        role,
      });
      const logged = await request(
        "/auth/login",
        "POST",
        {
          email: role.toLowerCase() + "@example.test",
          password: "Test-password-123",
        },
        null,
      );
      if (role === "OWNER") ownerCookie = logged.cookie;
      else staffCookie = logged.cookie;
    }
    product = await Product.create({
      name: "Oak table",
      slug: "oak-table",
      sku: "OAK1",
      price: 1000,
      stock: 3,
      category: "tables",
      colors: ["Oak"],
      published: true,
    });
    await DeliveryZone.create({
      pin: "673001",
      available: true,
      fee: 100,
      days: 7,
      cod: true,
    });
  },
  { timeout: 180000 },
);
after(async () => {
  if (server) await new Promise((r) => server.close(r));
  await mongoose.disconnect();
  if (repl) await repl.stop();
});
const input = (qty = 1) => ({
  items: [{ product: product.id, quantity: qty }],
  address: {
    name: "Test Buyer",
    line1: "12 Sample Street",
    city: "Kozhikode",
    state: "Kerala",
    pin: "673001",
    phone: "9999999999",
  },
  paymentMethod: "COD",
  idempotencyKey: randomUUID(),
});
test("customer cannot access admin; staff cannot create products; cross-origin writes fail", async () => {
  assert.equal((await request("/admin/products")).status, 403);
  assert.equal(
    (await request("/admin/products", "POST", {}, staffCookie)).status,
    403,
  );
  assert.equal(
    (
      await request(
        "/auth/me",
        "PATCH",
        { name: "Attack" },
        cookie,
        "https://evil.example",
      )
    ).status,
    403,
  );
});
test("product query operator injection is not interpreted", async () => {
  const r = await request("/products?category[$ne]=hidden");
  assert.equal(r.status, 200);
  assert.equal(r.data.total, 1);
});
test("checkout uses authoritative prices and caps discounts", async () => {
  await Coupon.create({
    code: "FREE",
    active: true,
    type: "FIXED",
    value: 5000,
    perCustomerLimit: 1,
  });
  const r = await request("/cart/quote", "POST", {
    items: [{ product: product.id, quantity: 1, price: 1 }],
    pin: "673001",
    coupon: "FREE",
  });
  assert.equal(r.status, 200);
  assert.equal(r.data.subtotal, 1000);
  assert.equal(r.data.discount, 1000);
  assert.equal(r.data.total, 100);
});
test("unsupported PIN and online payment do not create orders", async () => {
  const v = input();
  v.address.pin = "111111";
  assert.equal((await request("/orders", "POST", v)).status, 400);
  assert.equal(
    (await request("/orders", "POST", { ...input(), paymentMethod: "CARD" }))
      .status,
    400,
  );
  assert.equal(await Order.countDocuments(), 0);
});
test("repeated checkout is idempotent", async () => {
  const v = input();
  const a = await request("/orders", "POST", v),
    b = await request("/orders", "POST", v);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.equal(a.data._id, b.data._id);
  assert.equal((await Product.findById(product.id)).reserved, 1);
});
test("concurrent checkout cannot oversell", async () => {
  const results = await Promise.all([
    request("/orders", "POST", input(2)),
    request("/orders", "POST", input(2)),
  ]);
  assert.deepEqual(results.map((x) => x.status).sort(), [201, 409]);
  assert.equal((await Product.findById(product.id)).reserved, 3);
});
test("duplicate cart lines cannot bypass stock checks", async () => {
  const v = input();
  v.items.push({ ...v.items[0] });
  assert.equal((await request("/orders", "POST", v)).status, 409);
});
test("owner cannot reduce physical stock below reservations", async () => {
  const r = await request(
    "/admin/products/" + product.id,
    "PATCH",
    { stock: 0 },
    ownerCookie,
  );
  assert.ok(r.status >= 400);
  assert.equal((await Product.findById(product.id)).stock, 3);
});
test("cancellation releases reservations once and customer sees update", async () => {
  const order = await Order.findOne({ "items.quantity": 2 });
  const url = "/admin/orders/" + order.id + "/status";
  assert.equal(
    (
      await request(
        url,
        "PATCH",
        { status: "CANCELLED", expectedStatus: "PENDING" },
        ownerCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        url,
        "PATCH",
        { status: "CANCELLED", expectedStatus: "PENDING" },
        ownerCookie,
      )
    ).status,
    409,
  );
  assert.equal((await Product.findById(product.id)).reserved, 1);
  assert.equal((await request("/orders/" + order.id)).data.status, "CANCELLED");
});
test("fulfillment decrements stock once and COD collection is recorded once", async () => {
  const order = await Order.findOne({ status: "PENDING" });
  for (const status of [
    "CONFIRMED",
    "PROCESSING",
    "PACKED",
    "SHIPPED",
    "OUT_FOR_DELIVERY",
    "DELIVERED",
  ])
    assert.equal(
      (
        await request(
          "/admin/orders/" + order.id + "/status",
          "PATCH",
          { status },
          ownerCookie,
        )
      ).status,
      200,
    );
  const p = await Product.findById(product.id);
  assert.equal(p.stock, 2);
  assert.equal(p.reserved, 0);
  assert.equal(
    (
      await request(
        "/admin/orders/" + order.id + "/collect",
        "POST",
        {},
        ownerCookie,
      )
    ).status,
    200,
  );
  assert.equal(
    (
      await request(
        "/admin/orders/" + order.id + "/collect",
        "POST",
        {},
        ownerCookie,
      )
    ).status,
    409,
  );
});
test("ownership, account disabling and logout invalidate access", async () => {
  const order = await Order.findOne();
  assert.equal(
    (await request("/orders/" + order.id, "GET", undefined, staffCookie))
      .status,
    404,
  );
  await User.updateOne({ role: "STAFF" }, { $set: { active: false } });
  assert.equal(
    (await request("/admin/orders", "GET", undefined, staffCookie)).status,
    401,
  );
  assert.equal((await request("/auth/logout", "POST", {})).status, 200);
  assert.equal((await request("/auth/me")).status, 401);
});
