import mongoose from "mongoose";
import { config } from "dotenv";
import { CourseModel } from "../models/CourseModel.js";
import { VideoModel } from "../models/VideoModel.js";

config();

const main = async () => {
  if (!process.env.DB_URL) {
    console.error("DB_URL is not set. Set it in .env or environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.DB_URL, { autoIndex: true });
    console.log("Connected to DB for cleanup");

    // Find courses that have no lectures and no thumbnail
    const candidates = await CourseModel.find({ $or: [{ lectures: { $size: 0 } }, { lectures: { $exists: false } }], $or: [{ thumbnailUrl: "" }, { thumbnailUrl: { $exists: false } }] });

    if (!candidates.length) {
      console.log("No candidate courses to remove");
      await mongoose.disconnect();
      process.exit(0);
    }

    const toRemove = [];
    for (const c of candidates) {
      const videoCount = await VideoModel.countDocuments({ courseId: c._id });
      if (videoCount === 0) toRemove.push(c);
    }

    if (!toRemove.length) {
      console.log("No courses matched the full-remove criteria (they had videos)");
      await mongoose.disconnect();
      process.exit(0);
    }

    const ids = toRemove.map((t) => t._id);
    await CourseModel.deleteMany({ _id: { $in: ids } });

    console.log(`Removed ${ids.length} courses:`);
    toRemove.forEach((t) => console.log(` - ${t.title} (${t._id})`));

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error during cleanup:", err);
    process.exit(1);
  }
};

main();
