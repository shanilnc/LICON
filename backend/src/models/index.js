import mongoose from "mongoose";
const { Schema, model } = mongoose;
const opts = { timestamps: true };
const userSchema = new Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true, required: true },
    password: { type: String, required: true, select: false },
    phone: String,
    role: {
      type: String,
      enum: ["CUSTOMER", "STAFF", "ADMIN", "OWNER"],
      default: "CUSTOMER",
    },
    active: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    addresses: [
      {
        name: String,
        line1: String,
        line2: String,
        city: String,
        state: String,
        pin: String,
        phone: String,
      },
    ],
  },
  opts,
);
export const User = model("User", userSchema);
export const AdminUser = User;
const productSchema = new Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    sku: { type: String, required: true, unique: true },
    description: String,
    shortDescription: String,
    category: { type: String, index: true },
    collectionId: { type: Schema.Types.ObjectId, ref: "Collection" },
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, min: 0 },
    stock: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    material: String,
    colors: [String],
    sizes: [String],
    dimensions: {
      width: Number,
      depth: Number,
      height: Number,
      seatHeight: Number,
    },
    specifications: Schema.Types.Mixed,
    images: [{ url: String, alt: String, publicId: String }],
    badge: String,
    featured: Boolean,
    bestSeller: Boolean,
    newArrival: Boolean,
    published: { type: Boolean, default: false },
    rating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    related: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    seo: { title: String, description: String },
  },
  opts,
);
productSchema.index({ name: "text", description: "text", material: "text" });
export const Product = model("Product", productSchema);
export const Category = model(
  "Category",
  new Schema(
    {
      name: String,
      slug: { type: String, unique: true },
      description: String,
      image: String,
    },
    opts,
  ),
);
export const Collection = model(
  "Collection",
  new Schema(
    {
      name: String,
      slug: { type: String, unique: true },
      description: String,
      image: String,
      published: Boolean,
    },
    opts,
  ),
);
export const DeliveryZone = model(
  "DeliveryZone",
  new Schema(
    {
      pin: { type: String, unique: true, required: true },
      available: Boolean,
      fee: { type: Number, default: 0 },
      days: { type: Number, default: 7 },
      installation: Boolean,
      cod: { type: Boolean, default: false },
    },
    opts,
  ),
);
export const Coupon = model(
  "Coupon",
  new Schema(
    {
      code: { type: String, unique: true, uppercase: true },
      type: { type: String, enum: ["PERCENT", "FIXED"] },
      value: Number,
      minOrder: Number,
      maxDiscount: Number,
      startAt: Date,
      endAt: Date,
      usageLimit: Number,
      used: { type: Number, default: 0 },
      perCustomerLimit: Number,
      active: Boolean,
      categories: [String],
    },
    opts,
  ),
);
const cartItem = {
  product: { type: Schema.Types.ObjectId, ref: "Product" },
  quantity: { type: Number, min: 1 },
  variant: Schema.Types.Mixed,
};
export const Cart = model(
  "Cart",
  new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", unique: true },
    items: [cartItem],
    updatedAt: Date,
  }),
);
export const Wishlist = model(
  "Wishlist",
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: "User", unique: true },
      products: [{ type: Schema.Types.ObjectId, ref: "Product" }],
    },
    opts,
  ),
);
const orderSchema = new Schema(
  {
    orderId: { type: String, unique: true, index: true },
    idempotencyKey: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    customer: { name: String, email: String, phone: String },
    address: Schema.Types.Mixed,
    items: [
      {
        product: { type: Schema.Types.ObjectId, ref: "Product" },
        name: String,
        sku: String,
        quantity: Number,
        price: Number,
        variant: Schema.Types.Mixed,
      },
    ],
    subtotal: Number,
    discount: Number,
    delivery: Number,
    tax: Number,
    total: Number,
    coupon: String,
    pin: String,
    paymentMethod: String,
    paymentStatus: { type: String, default: "PENDING" },
    status: { type: String, default: "PENDING", index: true },
    history: [{ status: String, at: Date, note: String }],
  },
  opts,
);
orderSchema.index({ user: 1, idempotencyKey: 1 }, { unique: true });
export const Order = model("Order", orderSchema);
export const Inventory = model(
  "Inventory",
  new Schema(
    {
      product: { type: Schema.Types.ObjectId, ref: "Product", unique: true },
      stock: Number,
      reserved: Number,
      threshold: Number,
    },
    opts,
  ),
);
export const Payment = model(
  "Payment",
  new Schema(
    {
      order: { type: Schema.Types.ObjectId, ref: "Order" },
      provider: String,
      providerOrderId: String,
      providerPaymentId: String,
      amount: Number,
      status: String,
    },
    opts,
  ),
);
export const Review = model(
  "Review",
  new Schema(
    {
      product: { type: Schema.Types.ObjectId, ref: "Product", index: true },
      user: { type: Schema.Types.ObjectId, ref: "User" },
      rating: { type: Number, min: 1, max: 5 },
      quality: Number,
      comfort: Number,
      value: Number,
      text: String,
      images: [String],
      verified: Boolean,
      status: { type: String, default: "PENDING" },
    },
    opts,
  ),
);
export const CustomRequest = model(
  "CustomRequest",
  new Schema(
    {
      name: String,
      email: String,
      phone: String,
      furnitureType: String,
      dimensions: String,
      material: String,
      color: String,
      budget: String,
      referenceImage: String,
      requirements: String,
      status: { type: String, default: "NEW" },
      notes: [
        {
          body: String,
          by: { type: Schema.Types.ObjectId, ref: "User" },
          at: Date,
        },
      ],
    },
    opts,
  ),
);
export const Notification = model(
  "Notification",
  new Schema(
    {
      user: { type: Schema.Types.ObjectId, ref: "User" },
      audience: String,
      title: String,
      message: String,
      read: { type: Boolean, default: false },
      order: { type: Schema.Types.ObjectId, ref: "Order" },
    },
    opts,
  ),
);
export const AuditLog = model(
  "AuditLog",
  new Schema(
    {
      actor: { type: Schema.Types.ObjectId, ref: "User" },
      action: String,
      target: String,
      metadata: Schema.Types.Mixed,
      ip: String,
    },
    opts,
  ),
);
export const Content = model(
  "Content",
  new Schema(
    { key: { type: String, unique: true }, value: Schema.Types.Mixed },
    opts,
  ),
);

export const Subscriber = model(
  "Subscriber",
  new Schema({ email: { type: String, unique: true, lowercase: true } }, opts),
);
export const Contact = model(
  "Contact",
  new Schema({ name: String, email: String, message: String }, opts),
);
