import { Schema, Types, model } from "mongoose";

const enrollmentSchema = new Schema(
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
    paymentStatus: {
      type: String,
      enum: ["FREE", "PENDING", "PAID"],
      default: "FREE",
    },
    completedLectureIds: {
      type: [Types.ObjectId],
      default: [],
    },
    progressPercentage: {
      type: Number,
      default: 0,
      min: [0, "Progress cannot be below 0"],
      max: [100, "Progress cannot exceed 100"],
    },
    lastAccessedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false,
  },
);

enrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

export const EnrollmentModel = model("enrollments", enrollmentSchema);