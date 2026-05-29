import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { config } from "dotenv";
// lightweight MP4 mvhd parser to extract duration without external binaries

const getMp4DurationSeconds = (buffer) => {
  const mvhd = Buffer.from("mvhd");
  const idx = buffer.indexOf(mvhd);
  if (idx === -1) return null;
  const version = buffer.readUInt8(idx + 4);
  try {
    if (version === 1) {
      const timescale = buffer.readUInt32BE(idx + 24);
      const duration = Number(buffer.readBigUInt64BE(idx + 28));
      return duration / timescale;
    }
    // version 0
    const timescale = buffer.readUInt32BE(idx + 16);
    const duration = buffer.readUInt32BE(idx + 20);
    return duration / timescale;
  } catch (err) {
    return null;
  }
};
import { VideoModel } from "../models/VideoModel.js";
import { CourseModel } from "../models/CourseModel.js";

config();

const main = async () => {
  if (!process.env.DB_URL) {
    console.error("DB_URL is not set. Set it in .env or environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.DB_URL, { autoIndex: true });
    console.log("Connected to DB for fixing lecture durations");

    // process all videos to ensure thumbnails are set on courses and lectures
    const videos = await VideoModel.find({});
    if (!videos.length) {
      console.log("No videos found in DB.");
      await mongoose.disconnect();
      process.exit(0);
    }

    for (const v of videos) {
      try {
        const relPath = v.videoUrl.startsWith("/") ? v.videoUrl.slice(1) : v.videoUrl;
        const filePath = path.join(process.cwd(), relPath);
        if (!fs.existsSync(filePath)) {
          console.warn(`File not found for video ${v._id}: ${filePath}`);
          continue;
        }

        let dur = 0;
        try {
          const buf = fs.readFileSync(filePath);
          const seconds = getMp4DurationSeconds(buf);
          if (seconds && seconds > 0) dur = Math.round(seconds);
          else {
            console.warn(`Could not parse mp4 mvhd for ${filePath}, using fallback 120s`);
            dur = 120;
          }
        } catch (err) {
          console.warn(`Could not read file ${filePath}, using fallback 120s: ${err.message || err}`);
          dur = 120; // fallback to 2 minutes
        }

        const thumbnail = "/uploads/1779336994785-dsa-1.png";

        await VideoModel.findByIdAndUpdate(v._id, { duration: dur, thumbnail });

        // update course lecture entries
        await CourseModel.updateMany(
          { _id: v.courseId, "lectures.videoUrl": v.videoUrl },
          { $set: { "lectures.$.durationInSeconds": dur, "lectures.$.thumbnail": thumbnail } },
        );

        // if course has no thumbnailUrl, set it to this video's thumbnail
        await CourseModel.updateOne(
          { _id: v.courseId, $or: [{ thumbnailUrl: "" }, { thumbnailUrl: { $exists: false } }] },
          { $set: { thumbnailUrl: thumbnail } },
        );

        console.log(`Updated video ${v._id} duration=${dur}s`);
      } catch (err) {
        console.error(`Failed to update video ${v._id}:`, err.message || err);
      }
    }

    await mongoose.disconnect();
    console.log("Done updating video durations.");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
};

main();
