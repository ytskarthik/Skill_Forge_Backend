import { Schema, Types, model } from "mongoose";

const reviewSchema = new Schema(
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
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot be more than 5"],
    },
    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Review comment cannot exceed 2000 characters"],
    },
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false,
  },
);

reviewSchema.index({ studentId: 1, courseId: 1 }, { unique: true });

export const ReviewModel = model("reviews", reviewSchema);