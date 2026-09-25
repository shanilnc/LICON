import jwt from "jsonwebtoken";
import { User } from "../models/index.js";
export const tokenFor = (user) =>
  jwt.sign(
    { sub: user.id, version: user.tokenVersion || 0 },
    process.env.JWT_SECRET,
    { expiresIn: "12h", issuer: "licon-api", audience: "licon-apps" },
  );
export async function auth(req, res, next) {
  try {
    const token = req.cookies?.licon_token;
    if (!token) return res.status(401).json({ error: "Sign in to continue" });
    const payload = jwt.verify(token, process.env.JWT_SECRET, {
      issuer: "licon-api",
      audience: "licon-apps",
      algorithms: ["HS256"],
    });
    const user = await User.findById(payload.sub);
    if (!user?.active || (user.tokenVersion || 0) !== payload.version)
      return res
        .status(401)
        .json({ error: "Session expired. Please sign in again" });
    req.identity = { sub: user.id, role: user.role };
    req.user = user;
    next();
  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError"
    )
      return res
        .status(401)
        .json({ error: "Session expired. Please sign in again" });
    next(error);
  }
}
export const admin =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.identity?.role)
      ? next()
      : res.status(403).json({ error: "Insufficient permissions" });
export const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 12 * 60 * 60 * 1000,
});
export function signIn(res, user) {
  res.cookie("licon_token", tokenFor(user), cookieOptions());
  return {
    user: {
      _id: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      addresses: user.addresses,
      role: user.role,
    },
  };
}
