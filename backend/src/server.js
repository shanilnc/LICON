import "dotenv/config";
import multer from "multer";
import {
  placeOrder,
  quoteCart,
  changeStatus,
  CommerceError,
} from "./services/commerce.js";
import { uploadImage } from "./services/storage.js";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import bcrypt from "bcryptjs";
import { z, ZodError } from "zod";
import {
  User,
  Product,
  Category,
  Collection,
  DeliveryZone,
  Coupon,
  Order,
  Wishlist,
  Review,
  CustomRequest,
  Notification,
  AuditLog,
  Content,
  Cart,
  Payment,
  Subscriber,
  Contact,
} from "./models/index.js";
import {
  auth,
  admin,
  tokenFor,
  signIn,
  cookieOptions,
} from "./middleware/auth.js";
export const app = express();
app.set("query parser", "simple");
mongoose.set("sanitizeFilter", false);
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: [process.env.CLIENT_URL, process.env.ADMIN_URL].filter(Boolean),
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(
  "/api",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 180,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  }),
);
app.use("/api", (req, res, next) => {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (
      origin &&
      ![process.env.CLIENT_URL, process.env.ADMIN_URL].includes(origin)
    )
      return res.status(403).json({ error: "Origin is not allowed" });
    if (req.get("sec-fetch-site") === "cross-site")
      return res
        .status(403)
        .json({ error: "Cross-site request is not allowed" });
    if (!origin && process.env.NODE_ENV === "production")
      return res.status(403).json({ error: "Origin header required" });
  }
  for (const value of Object.values(req.query))
    if (typeof value !== "string")
      return res.status(400).json({ error: "Invalid query parameter" });
  next();
});
const wrap = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const check =
  (schema, source = "body") =>
  (req, res, next) => {
    req.valid = schema.parse(req[source]);
    next();
  };
const log = (req, action, target, metadata = {}) =>
  AuditLog.create({
    actor: req.identity.sub,
    action,
    target,
    metadata,
    ip: req.ip,
  });
app.get("/api/health", (_q, r) => r.json({ status: "ok" }));
const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(72),
});
app.post(
  "/api/auth/register",
  check(
    credentials.extend({
      name: z.string().min(2).max(80),
      phone: z.string().optional(),
    }),
  ),
  wrap(async (req, res) => {
    if (await User.exists({ email: req.valid.email.toLowerCase() }))
      return res.status(409).json({ error: "Email already registered" });
    const u = await User.create({
      ...req.valid,
      email: req.valid.email.toLowerCase(),
      password: await bcrypt.hash(req.valid.password, 12),
    });
    res.status(201).json(signIn(res, u));
  }),
);
app.post(
  "/api/auth/login",
  rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 }),
  check(credentials),
  wrap(async (req, res) => {
    const u = await User.findOne({
      email: req.valid.email.toLowerCase(),
      active: true,
    }).select("+password");
    if (!u || !(await bcrypt.compare(req.valid.password, u.password)))
      return res.status(401).json({ error: "Invalid email or password" });
    res.json(signIn(res, u));
  }),
);
app.get(
  "/api/auth/me",
  auth,
  wrap(async (req, res) => {
    const u = await User.findById(req.identity.sub);
    res.json(u);
  }),
);
app.patch(
  "/api/auth/me",
  auth,
  check(
    z.object({
      name: z.string().min(2).optional(),
      phone: z.string().optional(),
      addresses: z
        .array(
          z.object({
            name: z.string(),
            line1: z.string(),
            line2: z.string().optional(),
            city: z.string(),
            state: z.string(),
            pin: z.string().regex(/^\d{6}$/),
            phone: z.string(),
          }),
        )
        .optional(),
    }),
  ),
  wrap(async (req, res) =>
    res.json(
      await User.findByIdAndUpdate(
        req.identity.sub,
        { $set: req.valid },
        { new: true },
      ),
    ),
  ),
);
app.get(
  "/api/products",
  wrap(async (req, res) => {
    let q = { published: true };
    const {
      category,
      search,
      material,
      color,
      collection,
      availability,
      minPrice,
      maxPrice,
      minRating,
      sort,
      page = 1,
      limit = 12,
    } = req.query;
    if (category) q.category = category;
    if (search) q.$text = { $search: String(search).slice(0, 100) };
    if (material)
      q.material = new RegExp(String(material).replace(/[^\w\s]/g, ""), "i");
    if (color) q.colors = color;
    if (collection) q.collectionId = collection;
    if (availability === "in-stock") q.stock = { $gt: 0 };
    if (minRating) q.rating = { $gte: Number(minRating) };
    if (minPrice || maxPrice)
      q.price = {
        ...(minPrice ? { $gte: Number(minPrice) } : {}),
        ...(maxPrice ? { $lte: Number(maxPrice) } : {}),
      };
    const sorts = {
      newest: "-createdAt",
      price_asc: "price",
      price_desc: "-price",
      rating: "-rating",
      best: "-bestSeller",
      recommended: "-featured",
    };
    const size = Math.min(Math.max(Number(limit) || 12, 1), 48),
      skip = (Math.max(Number(page) || 1, 1) - 1) * size;
    const [items, total] = await Promise.all([
      Product.find(q)
        .sort(sorts[sort] || "-featured")
        .skip(skip)
        .limit(size)
        .lean(),
      Product.countDocuments(q),
    ]);
    res.json({
      items,
      total,
      page: Number(page),
      pages: Math.ceil(total / size),
    });
  }),
);
app.get(
  "/api/products/:slug",
  wrap(async (req, res) => {
    const p = await Product.findOne({
      slug: req.params.slug,
      published: true,
    }).populate("related");
    if (!p) return res.status(404).json({ error: "Product not found" });
    res.json(p);
  }),
);
app.get(
  "/api/categories",
  wrap(async (_q, r) => r.json(await Category.find().lean())),
);
app.get(
  "/api/collections",
  wrap(async (_q, r) =>
    r.json(await Collection.find({ published: true }).lean()),
  ),
);
app.get(
  "/api/collections/:slug",
  wrap(async (req, r) => {
    const c = await Collection.findOne({
      slug: req.params.slug,
      published: true,
    });
    if (!c) return r.status(404).json({ error: "Collection not found" });
    r.json({
      collection: c,
      products: await Product.find({ collectionId: c.id, published: true }),
    });
  }),
);
app.get(
  "/api/delivery/:pin",
  wrap(async (req, res) => {
    if (!/^\d{6}$/.test(req.params.pin))
      return res.status(400).json({ error: "Enter a valid six-digit PIN" });
    const zone = await DeliveryZone.findOne({ pin: req.params.pin });
    res.json(
      zone
        ? {
            available: zone.available,
            fee: zone.fee,
            days: zone.days,
            installation: zone.installation,
          }
        : { available: false, fee: 0, installation: false },
    );
  }),
);
app.get(
  "/api/wishlist",
  auth,
  wrap(async (req, res) =>
    res.json(
      (await Wishlist.findOne({ user: req.identity.sub }).populate("products"))
        ?.products || [],
    ),
  ),
);
app.post(
  "/api/wishlist/:id",
  auth,
  wrap(async (req, res) => {
    if (!(await Product.exists({ _id: req.params.id, published: true })))
      return res.status(404).json({ error: "Product not found" });
    await Wishlist.updateOne(
      { user: req.identity.sub },
      { $addToSet: { products: req.params.id } },
      { upsert: true },
    );
    res.json({ ok: true });
  }),
);
app.delete(
  "/api/wishlist/:id",
  auth,
  wrap(async (req, res) => {
    await Wishlist.updateOne(
      { user: req.identity.sub },
      { $pull: { products: req.params.id } },
    );
    res.json({ ok: true });
  }),
);
const itemInput = z.object({
  product: z.string().regex(/^[a-f0-9]{24}$/i),
  quantity: z.number().int().min(1).max(20),
  variant: z
    .object({
      color: z.string().max(80).optional(),
      size: z.string().max(80).optional(),
    })
    .optional(),
});
const orderInput = z.object({
  items: z.array(itemInput).min(1).max(50),
  address: z.object({
    name: z.string().min(2).max(100),
    line1: z.string().min(5).max(300),
    city: z.string().min(2).max(100),
    state: z.string().min(2).max(100),
    pin: z.string().regex(/^\d{6}$/),
    phone: z.string().regex(/^[+0-9 ()-]{10,20}$/),
  }),
  paymentMethod: z.enum(["COD", "UPI", "CARD", "NET_BANKING"]),
  coupon: z.string().max(50).optional(),
  idempotencyKey: z.string().uuid(),
});
app.post(
  "/api/orders",
  auth,
  check(orderInput),
  wrap(async (req, res) =>
    res.status(201).json(await placeOrder(req.valid, req.user)),
  ),
);
app.get(
  "/api/orders",
  auth,
  wrap(async (req, res) =>
    res.json(
      await Order.find({ user: req.identity.sub }).sort("-createdAt").lean(),
    ),
  ),
);
app.get(
  "/api/orders/:id",
  auth,
  wrap(async (req, res) => {
    const o = await Order.findOne({
      _id: req.params.id,
      user: req.identity.sub,
    });
    if (!o) return res.status(404).json({ error: "Order not found" });
    res.json(o);
  }),
);
app.get(
  "/api/reviews/:product",
  wrap(async (req, res) =>
    res.json(
      await Review.find({ product: req.params.product, status: "APPROVED" })
        .populate("user", "name")
        .sort("-createdAt")
        .lean(),
    ),
  ),
);
app.post(
  "/api/reviews",
  auth,
  check(
    z.object({
      product: z.string(),
      rating: z.number().int().min(1).max(5),
      text: z.string().min(10).max(2000),
    }),
  ),
  wrap(async (req, res) => {
    const bought = await Order.exists({
      user: req.identity.sub,
      "items.product": req.valid.product,
      status: "DELIVERED",
    });
    const review = await Review.create({
      ...req.valid,
      user: req.identity.sub,
      verified: !!bought,
    });
    res.status(201).json(review);
  }),
);
app.post(
  "/api/custom-requests",
  check(
    z.object({
      name: z.string().min(2),
      email: z.string().email(),
      phone: z.string().min(10),
      furnitureType: z.string().min(2),
      dimensions: z.string().optional(),
      material: z.string().optional(),
      color: z.string().optional(),
      budget: z.string().optional(),
      referenceImage: z.string().url().optional(),
      requirements: z.string().max(3000).optional(),
    }),
  ),
  wrap(async (req, res) => {
    const doc = await CustomRequest.create(req.valid);
    await Notification.create({
      audience: "ADMIN",
      title: "New custom request",
      message: doc.furnitureType,
    });
    res.status(201).json({ id: doc.id, status: doc.status });
  }),
);
app.get(
  "/api/content/:key",
  wrap(async (req, res) =>
    res.json((await Content.findOne({ key: req.params.key }))?.value || {}),
  ),
);
const secure = [auth, admin("OWNER", "ADMIN", "STAFF")];
app.get(
  "/api/admin/dashboard",
  ...secure,
  wrap(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [orders, todayOrders, customers, lowStock, revenue] =
      await Promise.all([
        Order.find().sort("-createdAt").limit(8).lean(),
        Order.countDocuments({ createdAt: { $gte: today } }),
        User.countDocuments({ role: "CUSTOMER" }),
        Product.countDocuments({
          $expr: {
            $lte: [
              { $subtract: ["$stock", "$reserved"] },
              "$lowStockThreshold",
            ],
          },
        }),
        Order.aggregate([
          {
            $match: {
              createdAt: { $gte: today },
              status: { $nin: ["CANCELLED", "REFUNDED"] },
            },
          },
          { $group: { _id: null, total: { $sum: "$total" } } },
        ]),
      ]);
    res.json({
      orders,
      todayOrders,
      customers,
      lowStock,
      revenue: revenue[0]?.total || 0,
      pending: await Order.countDocuments({ status: "PENDING" }),
    });
  }),
);
app.get(
  "/api/admin/orders",
  ...secure,
  wrap(async (req, res) =>
    res.json(
      await Order.find(req.query.status ? { status: req.query.status } : {})
        .sort("-createdAt")
        .limit(100),
    ),
  ),
);
app.get(
  "/api/admin/orders/:id",
  ...secure,
  wrap(async (req, res) => {
    const o = await Order.findById(req.params.id);
    if (!o) return res.status(404).json({ error: "Order not found" });
    res.json(o);
  }),
);
const statuses = [
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PACKED",
  "SHIPPED",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
  "CANCELLED",
  "RETURN_REQUESTED",
  "RETURNED",
  "REFUNDED",
];
app.patch(
  "/api/admin/orders/:id/status",
  ...secure,
  check(
    z.object({
      status: z.enum(statuses),
      expectedStatus: z.enum(statuses).optional(),
      note: z.string().max(1000).optional(),
    }),
  ),
  wrap(async (req, res) =>
    res.json(
      await changeStatus(req.params.id, req.valid, req.identity.sub, req.ip),
    ),
  ),
);
app.get(
  "/api/admin/products",
  ...secure,
  wrap(async (_q, r) =>
    r.json(await Product.find().sort("-createdAt").limit(200)),
  ),
);
const productInput = z.object({
  name: z.string().min(2),
  slug: z.string().regex(/^[a-z0-9-]+$/),
  sku: z.string().min(2),
  category: z.string().min(2),
  description: z.string().optional(),
  shortDescription: z.string().optional(),
  price: z.number().min(0),
  salePrice: z.number().min(0).nullable().optional(),
  stock: z.number().int().min(0),
  material: z.string().max(100).optional(),
  colors: z.array(z.string().max(80)).max(30).optional(),
  sizes: z.array(z.string().max(80)).max(30).optional(),
  collectionId: z
    .string()
    .regex(/^[a-f0-9]{24}$/i)
    .optional(),
  related: z
    .array(z.string().regex(/^[a-f0-9]{24}$/i))
    .max(20)
    .optional(),
  specifications: z.record(z.string().max(2000)).optional(),
  seo: z
    .object({ title: z.string().max(100), description: z.string().max(300) })
    .optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  images: z
    .array(
      z.object({
        url: z.string().url(),
        alt: z.string().optional(),
        publicId: z.string().optional(),
      }),
    )
    .optional(),
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  bestSeller: z.boolean().optional(),
  newArrival: z.boolean().optional(),
  badge: z.string().optional(),
  dimensions: z
    .object({
      width: z.number().optional(),
      depth: z.number().optional(),
      height: z.number().optional(),
      seatHeight: z.number().optional(),
    })
    .optional(),
});
app.post(
  "/api/admin/products",
  auth,
  admin("OWNER", "ADMIN"),
  check(productInput),
  wrap(async (req, res) => {
    if (req.valid.salePrice > req.valid.price)
      return res
        .status(400)
        .json({ error: "Sale price cannot exceed regular price" });
    const p = await Product.create(req.valid);
    await log(req, "PRODUCT_CREATED", p.id);
    res.status(201).json(p);
  }),
);
app.patch(
  "/api/admin/products/:id",
  auth,
  admin("OWNER", "ADMIN"),
  check(productInput.partial()),
  wrap(async (req, res) => {
    const filter = { _id: req.params.id };
    if (req.valid.stock != null) filter.reserved = { $lte: req.valid.stock };
    const current = await Product.findById(req.params.id);
    if (!current) return res.status(404).json({ error: "Product not found" });
    if (
      (req.valid.salePrice ?? current.salePrice) >
      (req.valid.price ?? current.price)
    )
      return res
        .status(400)
        .json({ error: "Sale price cannot exceed regular price" });
    const p = await Product.findOneAndUpdate(
      filter,
      { $set: req.valid },
      { new: true, runValidators: true },
    );
    if (!p)
      return res
        .status(409)
        .json({ error: "Stock cannot be lower than reserved quantity" });
    await log(req, "PRODUCT_UPDATED", p.id);
    res.json(p);
  }),
);
app.delete(
  "/api/admin/products/:id",
  auth,
  admin("OWNER"),
  wrap(async (req, res) => {
    await Product.findByIdAndUpdate(req.params.id, { published: false });
    await log(req, "PRODUCT_UNPUBLISHED", req.params.id);
    res.json({ ok: true });
  }),
);
app.get(
  "/api/admin/custom-requests",
  ...secure,
  wrap(async (_q, r) => r.json(await CustomRequest.find().sort("-createdAt"))),
);
app.patch(
  "/api/admin/custom-requests/:id",
  ...secure,
  check(
    z.object({
      status: z
        .enum([
          "NEW",
          "CONTACTED",
          "QUOTED",
          "NEGOTIATING",
          "APPROVED",
          "IN_PRODUCTION",
          "COMPLETED",
          "CANCELLED",
        ])
        .optional(),
      note: z.string().optional(),
    }),
  ),
  wrap(async (req, res) => {
    const update = {};
    if (req.valid.status) update.$set = { status: req.valid.status };
    if (req.valid.note)
      update.$push = {
        notes: { body: req.valid.note, by: req.identity.sub, at: new Date() },
      };
    const doc = await CustomRequest.findByIdAndUpdate(req.params.id, update, {
      new: true,
    });
    await log(req, "CUSTOM_REQUEST_UPDATED", req.params.id);
    res.json(doc);
  }),
);
app.get(
  "/api/admin/delivery",
  ...secure,
  wrap(async (_q, r) => r.json(await DeliveryZone.find().sort("pin"))),
);
app.put(
  "/api/admin/delivery/:pin",
  auth,
  admin("OWNER", "ADMIN"),
  check(
    z.object({
      available: z.boolean(),
      fee: z.number().min(0),
      days: z.number().int().min(1),
      installation: z.boolean(),
      cod: z.boolean(),
    }),
  ),
  wrap(async (req, res) => {
    if (!/^\d{6}$/.test(req.params.pin))
      return res.status(400).json({ error: "Invalid PIN" });
    const zone = await DeliveryZone.findOneAndUpdate(
      { pin: req.params.pin },
      { $set: req.valid },
      { upsert: true, new: true },
    );
    await log(req, "DELIVERY_ZONE_UPDATED", zone.id);
    res.json(zone);
  }),
);
app.get(
  "/api/admin/reviews",
  ...secure,
  wrap(async (_q, r) =>
    r.json(
      await Review.find()
        .populate("product", "name")
        .populate("user", "name")
        .sort("-createdAt"),
    ),
  ),
);
app.patch(
  "/api/admin/reviews/:id",
  ...secure,
  check(z.object({ status: z.enum(["APPROVED", "REJECTED"]) })),
  wrap(async (req, res) => {
    const review = await Review.findByIdAndUpdate(
      req.params.id,
      { status: req.valid.status },
      { new: true },
    );
    if (!review) return res.status(404).json({ error: "Review not found" });
    const approved = await Review.find({
      product: review.product,
      status: "APPROVED",
    });
    await Product.findByIdAndUpdate(review.product, {
      rating: approved.length
        ? approved.reduce((n, r) => n + r.rating, 0) / approved.length
        : 0,
      reviewCount: approved.length,
    });
    await log(req, "REVIEW_MODERATED", review.id);
    res.json(review);
  }),
);
app.get(
  "/api/admin/customers",
  auth,
  admin("OWNER", "ADMIN"),
  wrap(async (_q, r) =>
    r.json(
      await User.find({ role: "CUSTOMER" })
        .select("name email phone active createdAt")
        .sort("-createdAt")
        .limit(200),
    ),
  ),
);
app.get(
  "/api/admin/audit-logs",
  auth,
  admin("OWNER"),
  wrap(async (_q, r) =>
    r.json(
      await AuditLog.find()
        .populate("actor", "name email")
        .sort("-createdAt")
        .limit(100),
    ),
  ),
);
app.get(
  "/api/admin/analytics",
  ...secure,
  wrap(async (_q, r) => {
    const rows = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 30 * 86400000) },
          status: { $nin: ["CANCELLED", "REFUNDED"] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          orders: { $sum: 1 },
          revenue: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    r.json(rows);
  }),
);
app.get(
  "/api/admin/content",
  ...secure,
  wrap(async (_q, r) => r.json(await Content.find())),
);
app.put(
  "/api/admin/content/:key",
  auth,
  admin("OWNER", "ADMIN"),
  check(z.object({ value: z.record(z.any()) })),
  wrap(async (req, res) => {
    const doc = await Content.findOneAndUpdate(
      { key: req.params.key },
      { $set: { value: req.valid.value } },
      { upsert: true, new: true },
    );
    await log(req, "CONTENT_UPDATED", doc.id);
    res.json(doc);
  }),
);
app.post(
  "/api/auth/logout",
  auth,
  wrap(async (req, res) => {
    await User.updateOne(
      { _id: req.identity.sub },
      { $inc: { tokenVersion: 1 } },
    );
    res.clearCookie("licon_token", { ...cookieOptions(), maxAge: undefined });
    res.json({ ok: true });
  }),
);
app.post(
  "/api/cart/quote",
  auth,
  check(
    z.object({
      items: z.array(itemInput).min(1).max(50),
      pin: z.string().regex(/^\d{6}$/),
      coupon: z.string().max(50).optional(),
    }),
  ),
  wrap(async (req, res) => {
    const q = await quoteCart(req.valid, req.identity.sub);
    res.json({
      subtotal: q.subtotal,
      discount: q.discount,
      delivery: q.delivery,
      tax: q.tax,
      total: q.total,
      days: q.zone.days,
      installation: q.zone.installation,
      cod: q.zone.cod,
    });
  }),
);
app.get(
  "/api/cart",
  auth,
  wrap(async (req, res) =>
    res.json(
      (await Cart.findOne({ user: req.identity.sub }).populate("items.product"))
        ?.items || [],
    ),
  ),
);
app.put(
  "/api/cart",
  auth,
  check(z.object({ items: z.array(itemInput).max(50) })),
  wrap(async (req, res) =>
    res.json(
      await Cart.findOneAndUpdate(
        { user: req.identity.sub },
        { $set: { items: req.valid.items, updatedAt: new Date() } },
        { upsert: true, new: true },
      ),
    ),
  ),
);
app.get(
  "/api/notifications",
  auth,
  wrap(async (req, res) =>
    res.json(
      await Notification.find({ user: req.identity.sub })
        .sort("-createdAt")
        .limit(50),
    ),
  ),
);
app.post(
  "/api/newsletter",
  rateLimit({ windowMs: 3600000, limit: 10 }),
  check(z.object({ email: z.string().email().max(200) })),
  wrap(async (req, res) => {
    await Subscriber.updateOne(
      { email: req.valid.email.toLowerCase() },
      { $setOnInsert: { email: req.valid.email.toLowerCase() } },
      { upsert: true },
    );
    res.json({ ok: true });
  }),
);
app.post(
  "/api/contact",
  rateLimit({ windowMs: 3600000, limit: 10 }),
  check(
    z.object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
      message: z.string().min(10).max(3000),
    }),
  ),
  wrap(async (req, res) => {
    const doc = await Contact.create(req.valid);
    await Notification.create({
      audience: "ADMIN",
      title: "Contact message",
      message: req.valid.message,
    });
    res.status(201).json({ id: doc.id });
  }),
);
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
});
app.post(
  "/api/uploads",
  auth,
  rateLimit({ windowMs: 3600000, limit: 20 }),
  upload.single("image"),
  wrap(async (req, res) => {
    if (!req.file)
      return res.status(400).json({ error: "An image is required" });
    res.status(201).json(await uploadImage(req.file));
  }),
);
app.get(
  "/api/admin/payments",
  auth,
  admin("OWNER", "ADMIN"),
  wrap(async (req, res) =>
    res.json(
      await Payment.find()
        .populate("order", "orderId")
        .sort("-createdAt")
        .limit(200),
    ),
  ),
);
app.post(
  "/api/admin/orders/:id/collect",
  auth,
  admin("OWNER", "ADMIN"),
  wrap(async (req, res) => {
    const session = await mongoose.startSession();
    let order;
    try {
      await session.withTransaction(async () => {
        order = await Order.findOneAndUpdate(
          {
            _id: req.params.id,
            paymentMethod: "COD",
            paymentStatus: "PENDING",
            status: "DELIVERED",
          },
          { $set: { paymentStatus: "PAID" } },
          { new: true, session },
        );
        if (!order)
          throw new CommerceError(
            "Order is not eligible for COD collection.",
            409,
          );
        await Payment.create(
          [
            {
              order: order.id,
              provider: "COD",
              amount: order.total,
              status: "PAID",
            },
          ],
          { session },
        );
        await AuditLog.create(
          [
            {
              actor: req.identity.sub,
              action: "COD_COLLECTED",
              target: order.id,
              ip: req.ip,
            },
          ],
          { session },
        );
        await Notification.create(
          [
            {
              user: order.user,
              title: "Payment received",
              message: `Payment received for ${order.orderId}`,
            },
          ],
          { session },
        );
      });
      res.json(order);
    } finally {
      await session.endSession();
    }
  }),
);
const couponInput = z
  .object({
    type: z.enum(["PERCENT", "FIXED"]),
    value: z.number().positive(),
    minOrder: z.number().min(0).optional(),
    maxDiscount: z.number().min(0).optional(),
    startAt: z.string().datetime().optional(),
    endAt: z.string().datetime().optional(),
    usageLimit: z.number().int().min(1).optional(),
    perCustomerLimit: z.number().int().min(1).optional(),
    categories: z.array(z.string().max(80)).max(50).default([]),
    active: z.boolean(),
  })
  .refine(
    (v) => v.type !== "PERCENT" || v.value <= 100,
    "Percentage must be at most 100",
  )
  .refine(
    (v) => !v.startAt || !v.endAt || v.endAt > v.startAt,
    "End date must follow start date",
  );
app.get(
  "/api/admin/coupons",
  auth,
  admin("OWNER", "ADMIN"),
  wrap(async (req, res) => res.json(await Coupon.find().sort("-createdAt"))),
);
app.put(
  "/api/admin/coupons/:code",
  auth,
  admin("OWNER", "ADMIN"),
  check(couponInput),
  wrap(async (req, res) => {
    if (!/^[A-Z0-9_-]{2,50}$/i.test(req.params.code))
      throw new CommerceError("Invalid coupon code");
    const c = await Coupon.findOneAndUpdate(
      { code: req.params.code.toUpperCase() },
      { $set: req.valid },
      { new: true, upsert: true, runValidators: true },
    );
    await log(req, "COUPON_UPDATED", c.id);
    res.json(c);
  }),
);
for (const [path, Model] of [
  ["categories", Category],
  ["collections", Collection],
]) {
  app.get(
    "/api/admin/" + path,
    ...secure,
    wrap(async (req, res) => res.json(await Model.find().sort("name"))),
  );
  app.put(
    "/api/admin/" + path + "/:slug",
    auth,
    admin("OWNER", "ADMIN"),
    check(
      z.object({
        name: z.string().min(2).max(100),
        description: z.string().max(2000).optional(),
        image: z.union([z.string().url(), z.literal("")]).optional(),
        published: z.boolean().optional(),
      }),
    ),
    wrap(async (req, res) => {
      if (!/^[a-z0-9-]+$/.test(req.params.slug))
        throw new CommerceError("Invalid slug");
      const doc = await Model.findOneAndUpdate(
        { slug: req.params.slug },
        { $set: req.valid },
        { new: true, upsert: true },
      );
      await log(req, path.toUpperCase() + "_UPDATED", doc.id);
      res.json(doc);
    }),
  );
}
app.get(
  "/api/admin/admin-users",
  auth,
  admin("OWNER"),
  wrap(async (req, res) =>
    res.json(
      await User.find({ role: { $ne: "CUSTOMER" } }).select(
        "name email role active",
      ),
    ),
  ),
);
app.post(
  "/api/admin/admin-users",
  auth,
  admin("OWNER"),
  check(
    z.object({
      name: z.string().min(2).max(100),
      email: z.string().email(),
      password: z.string().min(12).max(128),
      role: z.enum(["STAFF", "ADMIN"]),
    }),
  ),
  wrap(async (req, res) => {
    const u = await User.create({
      ...req.valid,
      password: await bcrypt.hash(req.valid.password, 12),
    });
    await log(req, "STAFF_CREATED", u.id);
    res.status(201).json({ id: u.id, name: u.name, role: u.role });
  }),
);
app.get(
  "/api/admin/contacts",
  auth,
  admin("OWNER", "ADMIN"),
  wrap(async (req, res) =>
    res.json(await Contact.find().sort("-createdAt").limit(100)),
  ),
);
app.get(
  "/api/admin/subscribers",
  auth,
  admin("OWNER", "ADMIN"),
  wrap(async (req, res) =>
    res.json(await Subscriber.find().sort("-createdAt").limit(200)),
  ),
);

app.use((_q, r) => r.status(404).json({ error: "Route not found" }));
app.use((err, _q, res, _n) => {
  if (err instanceof CommerceError)
    return res.status(err.status).json({ error: err.message });
  if (err.code === "LIMIT_FILE_SIZE")
    return res.status(413).json({ error: "Image must be under 5 MB" });
  if (err instanceof ZodError)
    return res
      .status(400)
      .json({ error: "Invalid input", details: err.flatten() });
  if (err.code === 11000)
    return res.status(409).json({ error: "That value already exists" });
  if (err.type === "entity.parse.failed")
    return res.status(400).json({ error: "Invalid JSON" });
  if (err.type === "entity.too.large")
    return res.status(413).json({ error: "Request is too large" });
  if (err.name === "ValidationError")
    return res.status(400).json({ error: "Invalid field value" });
  if (err.name === "CastError")
    return res.status(400).json({ error: "Invalid identifier" });
  console.error(err);
  res.status(500).json({ error: "Something went wrong. Please try again." });
});

export async function start() {
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    !process.env.MONGODB_URI
  )
    throw Error("Set MONGODB_URI and JWT_SECRET (at least 32 characters)");
  await mongoose.connect(process.env.MONGODB_URI);
  return app.listen(process.env.PORT || 5000, () =>
    console.log("LICON API is listening"),
  );
}
if (process.env.NODE_ENV !== "test") await start();
