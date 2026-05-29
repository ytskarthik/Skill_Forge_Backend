import mongoose from "mongoose";
import { config } from "dotenv";
import fs from "fs";
import path from "path";
import { VideoModel } from "../models/VideoModel.js";

config();

const main = async () => {
  try {
    const dbUrl = process.env.DB_URL || "mongodb://localhost:27017/ONLINE_LEARNING_PLATFORM";
    await mongoose.connect(dbUrl, { autoIndex: true });
    console.log("Connected to DB, listing recent videos...");

    const videos = await VideoModel.find({}).sort({ createdAt: -1 }).limit(200);
    for (const v of videos) {
      const rel = v.videoUrl ? (v.videoUrl.startsWith("/") ? v.videoUrl.slice(1) : v.videoUrl) : "";
      const filePath = path.join(process.cwd(), rel || "");
      const exists = rel ? fs.existsSync(filePath) : false;
      console.log({ id: v._id.toString(), title: v.title, videoUrl: v.videoUrl, thumbnail: v.thumbnail || v.thumbnailUrl || "", fileExists: exists });
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

main();
