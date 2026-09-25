import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import {
  Product,
  DeliveryZone,
  Coupon,
  Order,
  Notification,
  AuditLog,
} from "../models/index.js";
export class CommerceError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function aggregateItems(items) {
  const map = new Map(),
    totals = new Map();
  for (const item of items) {
    const key =
      item.product +
      JSON.stringify({ color: item.variant?.color, size: item.variant?.size });
    const existing = map.get(key);
    if (existing) existing.quantity += item.quantity;
    else map.set(key, { ...item });
    totals.set(item.product, (totals.get(item.product) || 0) + item.quantity);
  }
  for (const total of totals.values())
    if (total > 20) throw new CommerceError("Maximum 20 units per product.");
  return [...map.values()];
}
export function discountFor(coupon, lines, userUsage = 0, now = new Date()) {
  if (!coupon) return 0;
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0);
  if (
    !coupon.active ||
    coupon.startAt > now ||
    coupon.endAt < now ||
    subtotal < (coupon.minOrder || 0) ||
    (coupon.usageLimit != null && coupon.used >= coupon.usageLimit) ||
    (coupon.perCustomerLimit != null && userUsage >= coupon.perCustomerLimit)
  )
    throw new CommerceError(
      "Coupon is invalid, expired, or its usage limit has been reached.",
    );
  const eligible = lines
    .filter(
      (l) =>
        !coupon.categories?.length || coupon.categories.includes(l.category),
    )
    .reduce((sum, l) => sum + l.price * l.quantity, 0);
  if (!eligible)
    throw new CommerceError("Coupon does not apply to these products.");
  return (
    Math.round(
      Math.max(
        0,
        Math.min(
          eligible,
          coupon.type === "PERCENT"
            ? (eligible * coupon.value) / 100
            : coupon.value,
          coupon.maxDiscount ?? Infinity,
        ),
      ) * 100,
    ) / 100
  );
}
export async function quoteCart(input, user, session = null) {
  const items = aggregateItems(input.items);
  const zone = await DeliveryZone.findOne({
    pin: input.pin,
    available: true,
  }).session(session);
  if (!zone) throw new CommerceError("Delivery is unavailable for this PIN.");
  const products = await Product.find({
    _id: { $in: items.map((i) => i.product) },
    published: true,
  }).session(session);
  const quantities = new Map();
  for (const item of items)
    quantities.set(
      item.product,
      (quantities.get(item.product) || 0) + item.quantity,
    );
  const lines = items.map((item) => {
    const p = products.find((p) => p.id === item.product);
    if (!p || p.stock - p.reserved < quantities.get(item.product))
      throw new CommerceError(
        "An item is out of stock. Please refresh your cart.",
        409,
      );
    if (item.variant?.color && !p.colors.includes(item.variant.color))
      throw new CommerceError("Invalid product color.");
    if (item.variant?.size && !p.sizes.includes(item.variant.size))
      throw new CommerceError("Invalid product size.");
    return {
      product: p.id,
      name: p.name,
      sku: p.sku,
      category: p.category,
      quantity: item.quantity,
      price: p.salePrice ?? p.price,
      variant: item.variant,
    };
  });
  let coupon = null,
    usage = 0;
  if (input.coupon) {
    coupon = await Coupon.findOne({ code: input.coupon.toUpperCase() }).session(
      session,
    );
    if (!coupon) throw new CommerceError("Coupon not found.");
    usage = await Order.countDocuments({
      user,
      coupon: coupon.code,
      status: { $nin: ["CANCELLED"] },
    }).session(session);
  }
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    discount = discountFor(coupon, lines, usage),
    delivery = zone.fee,
    tax = 0;
  return {
    lines,
    subtotal,
    discount,
    delivery,
    tax,
    total: Math.round((subtotal - discount + delivery) * 100) / 100,
    coupon,
    zone,
  };
}
export async function placeOrder(input, user) {
  if (input.paymentMethod !== "COD")
    throw new CommerceError(
      "Online payment is not enabled. Choose cash on delivery.",
    );
  const existing = await Order.findOne({
    user: user.id,
    idempotencyKey: input.idempotencyKey,
  });
  if (existing) return existing;
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const duplicate = await Order.findOne({
        user: user.id,
        idempotencyKey: input.idempotencyKey,
      }).session(session);
      if (duplicate) {
        result = duplicate;
        return;
      }
      const q = await quoteCart(
        { ...input, pin: input.address.pin },
        user.id,
        session,
      );
      if (!q.zone.cod)
        throw new CommerceError(
          "Cash on delivery is unavailable for this PIN.",
        );
      for (const item of q.lines) {
        const reserved = await Product.updateOne(
          {
            _id: item.product,
            published: true,
            $expr: {
              $gte: [{ $subtract: ["$stock", "$reserved"] }, item.quantity],
            },
          },
          { $inc: { reserved: item.quantity } },
          { session },
        );
        if (!reserved.modifiedCount)
          throw new CommerceError(
            "Stock changed. Please refresh your cart.",
            409,
          );
      }
      if (q.coupon) {
        const filter = { _id: q.coupon.id };
        if (q.coupon.usageLimit != null)
          filter.used = { $lt: q.coupon.usageLimit };
        const updated = await Coupon.updateOne(
          filter,
          { $inc: { used: 1 } },
          { session },
        );
        if (!updated.modifiedCount)
          throw new CommerceError("Coupon usage limit reached.", 409);
      }
      [result] = await Order.create(
        [
          {
            orderId: `LICON-${randomUUID().slice(0, 8).toUpperCase()}`,
            idempotencyKey: input.idempotencyKey,
            user: user.id,
            customer: {
              name: input.address.name,
              email: user.email,
              phone: input.address.phone,
            },
            address: input.address,
            items: q.lines,
            subtotal: q.subtotal,
            discount: q.discount,
            delivery: q.delivery,
            tax: q.tax,
            total: q.total,
            pin: input.address.pin,
            paymentMethod: "COD",
            paymentStatus: "PENDING",
            status: "PENDING",
            coupon: q.coupon?.code,
            history: [{ status: "PENDING", at: new Date() }],
          },
        ],
        { session },
      );
      await Notification.create(
        [
          {
            audience: "ADMIN",
            title: "New order",
            message: result.orderId,
            order: result.id,
          },
          {
            user: user.id,
            title: "Order received",
            message: `${result.orderId}: order received`,
            order: result.id,
          },
        ],
        { session },
      );
    });
    return result;
  } finally {
    await session.endSession();
  }
}
export const transitions = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["PROCESSING", "CANCELLED"],
  PROCESSING: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED"],
  SHIPPED: ["OUT_FOR_DELIVERY"],
  OUT_FOR_DELIVERY: ["DELIVERED"],
  DELIVERED: ["RETURN_REQUESTED"],
  RETURN_REQUESTED: ["RETURNED"],
  RETURNED: ["REFUNDED"],
};
export async function changeStatus(id, input, actor, ip) {
  const session = await mongoose.startSession();
  let order;
  try {
    await session.withTransaction(async () => {
      order = await Order.findById(id).session(session);
      if (!order) throw new CommerceError("Order not found.", 404);
      if (input.expectedStatus && order.status !== input.expectedStatus)
        throw new CommerceError(
          "This order was updated by someone else. Refresh and try again.",
          409,
        );
      if (!transitions[order.status]?.includes(input.status))
        throw new CommerceError("Invalid status transition.", 409);
      if (input.status === "REFUNDED" && order.paymentStatus === "PAID")
        throw new CommerceError(
          "Record a confirmed refund through your payment operations before changing payment status. Automatic refunds are not enabled.",
          409,
        );
      const previous = order.status;
      order.status = input.status;
      order.history.push({
        status: input.status,
        at: new Date(),
        note: input.note,
      });
      await order.save({ session });
      if (input.status === "CANCELLED" || input.status === "DELIVERED") {
        for (const item of order.items) {
          const inc = { reserved: -item.quantity };
          if (input.status === "DELIVERED") inc.stock = -item.quantity;
          const update = await Product.updateOne(
            { _id: item.product, reserved: { $gte: item.quantity } },
            { $inc: inc },
            { session },
          );
          if (!update.modifiedCount)
            throw new CommerceError("Inventory reconciliation required.", 409);
        }
        if (input.status === "CANCELLED" && order.coupon)
          await Coupon.updateOne(
            { code: order.coupon, used: { $gt: 0 } },
            { $inc: { used: -1 } },
            { session },
          );
      }
      await Notification.create(
        [
          {
            user: order.user,
            title: "Order update",
            message: `${order.orderId}: ${order.status.replaceAll("_", " ")}`,
            order: order.id,
          },
        ],
        { session },
      );
      await AuditLog.create(
        [
          {
            actor,
            action: "ORDER_STATUS",
            target: id,
            metadata: { previous, next: order.status },
            ip,
          },
        ],
        { session },
      );
    });
    return order;
  } finally {
    await session.endSession();
  }
}
