import { Schema, Types, model } from "mongoose";

const lectureSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Lecture title is required"],
      trim: true,
      minlength: [3, "Lecture title must be at least 3 characters"],
      maxlength: [120, "Lecture title cannot exceed 120 characters"],
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [2000, "Lecture description cannot exceed 2000 characters"],
    },
    videoUrl: {
      type: String,
      default: "",
    },
    durationInSeconds: {
      type: Number,
      default: 0,
      min: [0, "Duration cannot be negative"],
    },
    order: {
      type: Number,
      required: [true, "Lecture order is required"],
      min: [1, "Lecture order must start from 1"],
    },
    isPreview: {
      type: Boolean,
      default: false,
    },
  },
  {
    _id: true,
    versionKey: false,
  },
);

const courseSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Course title is required"],
      trim: true,
      minlength: [3, "Course title must be at least 3 characters"],
      maxlength: [120, "Course title cannot exceed 120 characters"],
    },
    subtitle: {
      type: String,
      default: "",
      trim: true,
      maxlength: [160, "Subtitle cannot exceed 160 characters"],
    },
    description: {
      type: String,
      required: [true, "Course description is required"],
      trim: true,
      minlength: [20, "Course description must be at least 20 characters"],
      maxlength: [5000, "Course description cannot exceed 5000 characters"],
    },
    category: {
      type: String,
      required: [true, "Category is required"],
      trim: true,
      minlength: [2, "Category must be at least 2 characters"],
      maxlength: [80, "Category cannot exceed 80 characters"],
    },
    level: {
      type: String,
      enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"],
      default: "BEGINNER",
    },
    language: {
      type: String,
      default: "English",
      trim: true,
      maxlength: [40, "Language cannot exceed 40 characters"],
    },
    price: {
      type: Number,
      default: 0,
      min: [0, "Price cannot be negative"],
      set: (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      },
    },
    thumbnailUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Thumbnail URL cannot exceed 1000 characters"],
    },
    previewVideoUrl: {
      type: String,
      default: "",
      trim: true,
      maxlength: [1000, "Preview video URL cannot exceed 1000 characters"],
    },
    instructorId: {
      type: Types.ObjectId,
      ref: "users",
      required: [true, "Instructor is required"],
    },
    lectures: {
      type: [lectureSchema],
      default: [],
    },
    tags: {
      type: [String],
      default: [],
      validate: {
        validator: (tags) => Array.isArray(tags) && tags.length <= 20,
        message: "A course can have at most 20 tags",
      },
    },
    isPublished: {
      type: Boolean,
      default: false,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be below 0"],
      max: [5, "Rating cannot exceed 5"],
    },
    totalReviews: {
      type: Number,
      default: 0,
      min: [0, "Review count cannot be negative"],
    },
    totalEnrollments: {
      type: Number,
      default: 0,
      min: [0, "Enrollment count cannot be negative"],
    },
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false,
  },
);

export const CourseModel = model("courses", courseSchema);