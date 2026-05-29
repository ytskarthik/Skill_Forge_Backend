import { Schema, Types, model } from "mongoose";

const paymentSchema = new Schema(
  {
    studentId: {
      type: Types.ObjectId,
      ref: "users",
      required: [true, "Student is required"],
    },
    courseId: {
      type: Types.ObjectId,
      ref: "courses",
      required: [true, "Course is required"],
    },
    orderId: {
      type: String,
      required: [true, "Order id is required"],
      unique: true,
      trim: true,
      maxlength: [200, "Order id cannot exceed 200 characters"],
    },
    paymentId: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0, "Amount cannot be negative"],
    },
    currency: {
      type: String,
      default: "INR",
      uppercase: true,
      trim: true,
      maxlength: [3, "Currency code must be 3 characters"],
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "PENDING",
    },
    paidAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 30 * 60 * 1000),
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false,
  },
);

paymentSchema.index({ studentId: 1, courseId: 1, status: 1 });

export const PaymentModel = model("payments", paymentSchema);
