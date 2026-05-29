import { Schema, model } from "mongoose";

// Enforce that local-part starts with a letter (no leading digits)
const emailPattern = /^[A-Za-z][^\s@]*@[^\s@]+\.[^\s@]+$/;

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
      minlength: [2, "First name must be at least 2 characters"],
      maxlength: [50, "First name cannot exceed 50 characters"],
      validate: {
        validator: (v) => {
          if (!v) return false;
          // allow letters (including many unicode letters), spaces, hyphens and apostrophes
          return /^[A-Za-zÀ-ÖØ-öø-ÿ' \-]+$/u.test(v);
        },
        message: "First name cannot contain numbers or special characters",
      },
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: [50, "Last name cannot exceed 50 characters"],
      validate: {
        validator: (v) => {
          if (!v) return true; // lastName is optional
          return /^[A-Za-zÀ-ÖØ-öø-ÿ' \-]+$/u.test(v);
        },
        message: "Last name cannot contain numbers or special characters",
      },
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [emailPattern, "Enter a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      maxlength: [128, "Password cannot exceed 128 characters"],
    },
    role: {
      type: String,
      enum: ["STUDENT", "INSTRUCTOR", "ADMIN"],
      required: [true, "Role is required"],
    },
    profileImageUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Profile image URL cannot exceed 500 characters"],
    },
    headline: {
      type: String,
      default: "",
      trim: true,
      maxlength: [120, "Headline cannot exceed 120 characters"],
    },
    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Bio cannot exceed 2000 characters"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false,
  },
);

export const UserTypeModel = model("users", userSchema);