import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { fileURLToPath } from "node:url";
import {
  User,
  Product,
  Category,
  Collection,
  DeliveryZone,
  Content,
} from "./models/index.js";
const photo = (id) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`;
export async function seed() {
  if (
    !process.env.SEED_OWNER_EMAIL ||
    !process.env.SEED_OWNER_PASSWORD ||
    process.env.SEED_OWNER_PASSWORD.length < 12
  )
    throw Error(
      "Set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD (12+ characters).",
    );
  if (
    !(await User.exists({ email: process.env.SEED_OWNER_EMAIL.toLowerCase() }))
  )
    await User.create({
      name: "LICON Owner",
      email: process.env.SEED_OWNER_EMAIL,
      password: await bcrypt.hash(process.env.SEED_OWNER_PASSWORD, 12),
      role: "OWNER",
    });
  const rows = [
    ["sofas", "Sofas", "photo-1555041469-a586c61ea9bc"],
    ["beds", "Beds", "photo-1505693416388-ac5ce068fe85"],
    ["tables", "Tables", "photo-1499933374294-4584851497cc"],
    ["chairs", "Chairs", "photo-1567538096630-e0c55bd6374c"],
    ["small-space", "Small space", "photo-1493663284031-b7e3aefcae8e"],
  ];
  for (const [slug, name, image] of rows)
    await Category.updateOne(
      { slug },
      { $setOnInsert: { name, slug, image: photo(image) } },
      { upsert: true },
    );
  const collection = await Collection.findOneAndUpdate(
    { slug: "the-natural-edit" },
    {
      $setOnInsert: {
        name: "The natural edit",
        slug: "the-natural-edit",
        description: "Warm wood, quiet forms and everyday comfort.",
        image: photo("photo-1616486338812-3dadae4b4ace"),
        published: true,
      },
    },
    { upsert: true, new: true },
  );
  const products = [
    [
      "Forma Lounge Sofa",
      "forma-lounge-sofa",
      "sofas",
      38900,
      "Fabric / oak",
      "photo-1555041469-a586c61ea9bc",
      210,
      90,
      80,
      "Best Seller",
    ],
    [
      "Noma Accent Chair",
      "noma-accent-chair",
      "chairs",
      14900,
      "Oak / fabric",
      "photo-1567538096630-e0c55bd6374c",
      75,
      78,
      82,
      "New",
    ],
    [
      "Milo Oak Table",
      "milo-oak-table",
      "tables",
      12900,
      "Solid oak",
      "photo-1499933374294-4584851497cc",
      100,
      55,
      42,
      "",
    ],
    [
      "Still Upholstered Bed",
      "still-upholstered-bed",
      "beds",
      42900,
      "Fabric / oak",
      "photo-1505693416388-ac5ce068fe85",
      165,
      210,
      100,
      "",
    ],
    [
      "Nest Compact Sofa",
      "nest-compact-sofa",
      "small-space",
      24900,
      "Fabric",
      "photo-1493663284031-b7e3aefcae8e",
      150,
      80,
      78,
      "Small Space",
    ],
    [
      "Arc Walnut Side Table",
      "arc-walnut-side-table",
      "tables",
      7900,
      "Walnut",
      "photo-1538688423619-a81d3f23454b",
      45,
      45,
      50,
      "New",
    ],
    [
      "Terra Lounge Chair",
      "terra-lounge-chair",
      "chairs",
      18900,
      "Oak / fabric",
      "photo-1598300042247-d088f8ab3a91",
      80,
      85,
      85,
      "",
    ],
    [
      "Linea Writing Desk",
      "linea-writing-desk",
      "small-space",
      16900,
      "Solid oak",
      "photo-1499933374294-4584851497cc",
      110,
      50,
      75,
      "",
    ],
  ];
  for (const [i, row] of products.entries()) {
    const [
      name,
      slug,
      category,
      price,
      material,
      image,
      width,
      depth,
      height,
      badge,
    ] = row;
    await Product.updateOne(
      { slug },
      {
        $setOnInsert: {
          name,
          slug,
          sku: `LIC-${String(i + 1).padStart(3, "0")}`,
          category,
          price,
          stock: 12,
          reserved: 0,
          lowStockThreshold: 3,
          material,
          colors: ["Natural"],
          sizes: ["Standard"],
          dimensions: { width, depth, height },
          description: `${name} brings warm textures and a considered silhouette to your everyday spaces. Designed to feel at home, from quiet mornings to evenings with friends.`,
          shortDescription: material,
          images: [{ url: photo(image), alt: name }],
          badge,
          featured: i < 4,
          bestSeller: i === 0,
          newArrival: badge === "New",
          published: true,
          collectionId: collection._id,
          specifications: {
            assembly: "Check with LICON before ordering",
            care: "Dust with a soft dry cloth; avoid direct sunlight",
            warranty: "Sample catalog — confirm actual product warranty",
          },
          rating: 0,
          reviewCount: 0,
        },
      },
      { upsert: true },
    );
  }
  const featured = await Product.find({ featured: true });
  for (const p of featured)
    if (!p.related.length) {
      p.related = featured
        .filter((x) => x.id !== p.id)
        .slice(0, 2)
        .map((x) => x.id);
      await p.save();
    }
  // Local demo service area only; replace with real operational zones before launch.
  for (const pin of ["673001", "676505"])
    await DeliveryZone.updateOne(
      { pin },
      {
        $setOnInsert: {
          pin,
          available: true,
          fee: 499,
          days: 7,
          installation: true,
          cod: true,
        },
      },
      { upsert: true },
    );
  await Content.updateOne(
    { key: "home" },
    {
      $setOnInsert: {
        key: "home",
        value: {
          title: "Furniture for\nmodern living.",
          description:
            "Thoughtfully designed pieces for calm, comfortable spaces.",
        },
      },
    },
    { upsert: true },
  );
  console.log("Sample catalog seeded. Existing records were not overwritten.");
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await seed();
  } finally {
    await mongoose.disconnect();
  }
}
