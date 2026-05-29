import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config } from "dotenv";
import { UserTypeModel } from "../models/UserModel.js";

config();

const getRequiredEnv = (key, fallback = "") => {
  const value = (process.env[key] || fallback).trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

const main = async () => {
  if (!process.env.DB_URL) {
    console.error("DB_URL is not set in environment. Set it in .env or environment variables.");
    process.exit(1);
  }

  const firstName = getRequiredEnv("ADMIN_FIRST_NAME", "Admin");
  const lastName = (process.env.ADMIN_LAST_NAME || "User").trim();
  const email = getRequiredEnv("ADMIN_EMAIL").toLowerCase();
  const password = getRequiredEnv("ADMIN_PASSWORD");

  try {
    await mongoose.connect(process.env.DB_URL, { autoIndex: true });
    console.log("Connected to DB for admin seeding");

    const hashedPassword = await bcrypt.hash(password, 10);
    const adminData = {
      firstName,
      lastName,
      email,
      password: hashedPassword,
      role: "ADMIN",
      isActive: true,
    };

    const updatedAdmin = await UserTypeModel.findOneAndUpdate(
      { email },
      adminData,
      { upsert: true, runValidators: true, returnDocument: "after" }
    ).select("-password");

    console.log("Admin account ready:", {
      email: updatedAdmin.email,
      role: updatedAdmin.role,
      isActive: updatedAdmin.isActive,
    });

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error creating admin:", err);
    process.exit(1);
  }
};

main();