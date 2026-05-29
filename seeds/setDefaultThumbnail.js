import mongoose from "mongoose";
import { config } from "dotenv";
import { CourseModel } from "../models/CourseModel.js";
import { VideoModel } from "../models/VideoModel.js";

config();

const DEFAULT_THUMB = "/uploads/1778559640270-yoriichi-tsugikuni.jpg";

const main = async () => {
  if (!process.env.DB_URL) {
    console.error("DB_URL is not set.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.DB_URL, { autoIndex: true });
    console.log("Connected to DB for setting default thumbnails");

    const courseResult = await CourseModel.updateMany(
      { $or: [{ thumbnailUrl: "" }, { thumbnailUrl: { $exists: false } }] },
      { $set: { thumbnailUrl: DEFAULT_THUMB } },
    );

    const videoResult = await VideoModel.updateMany(
      { $or: [{ thumbnail: "" }, { thumbnail: { $exists: false } }] },
      { $set: { thumbnail: DEFAULT_THUMB } },
    );

    console.log(`Courses updated: ${courseResult.modifiedCount || courseResult.nModified || 0}`);
    console.log(`Videos updated: ${videoResult.modifiedCount || videoResult.nModified || 0}`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
};

main();
