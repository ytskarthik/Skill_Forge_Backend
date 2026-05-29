import { Schema, model } from "mongoose";

const videoSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "Video title is required"],
      trim: true,
      minlength: [3, "Video title must be at least 3 characters"],
      maxlength: [120, "Video title cannot exceed 120 characters"],
    },
    description: {
      type: String,
      default: "",
      trim: true,
      maxlength: [5000, "Video description cannot exceed 5000 characters"],
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: "courses",
      required: [true, "Course ID is required"],
    },
    instructorId: {
      type: Schema.Types.ObjectId,
      ref: "users",
      required: [true, "Instructor ID is required"],
    },
    videoUrl: {
      type: String,
      required: [true, "Video URL is required"],
      trim: true,
      maxlength: [1000, "Video URL cannot exceed 1000 characters"],
    },
    cloudinaryPublicId: {
      type: String,
      default: "",
      trim: true,
      maxlength: [300, "Cloudinary public id cannot exceed 300 characters"],
    },
    duration: {
      type: Number,
      default: 0,
      min: [0, "Duration cannot be negative"],
    },
    thumbnail: {
      type: String,
      default: "",
    },
    views: {
      type: Number,
      default: 0,
      min: [0, "Views cannot be negative"],
    },
    isPublished: {
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

export const VideoModel = model("videos", videoSchema);
