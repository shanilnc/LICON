import { v2 as cloudinary } from "cloudinary";
import { CommerceError } from "./commerce.js";
export async function uploadImage(file) {
  if (!process.env.CLOUDINARY_API_SECRET)
    throw new CommerceError("Image storage is not configured.", 503);
  const b = file.buffer;
  const valid =
    (file.mimetype === "image/jpeg" && b[0] === 255 && b[1] === 216) ||
    (file.mimetype === "image/png" &&
      b
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) ||
    (file.mimetype === "image/webp" &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP");
  if (!valid) throw new CommerceError("Upload a valid JPG, PNG or WebP image.");
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  return new Promise((resolve, reject) =>
    cloudinary.uploader
      .upload_stream(
        {
          folder: "licon",
          resource_type: "image",
          allowed_formats: ["jpg", "png", "webp"],
          transformation: [{ width: 2400, height: 2400, crop: "limit" }],
        },
        (error, result) =>
          error
            ? reject(error)
            : resolve({ url: result.secure_url, publicId: result.public_id }),
      )
      .end(b),
  );
}
