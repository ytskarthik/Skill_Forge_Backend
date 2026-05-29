import jwt from "jsonwebtoken";
import { config } from "dotenv";

config();

export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : undefined;
  const token = req.cookies.token || bearerToken;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized request. Please login" });
  }

  try {
    const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decodedToken;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};