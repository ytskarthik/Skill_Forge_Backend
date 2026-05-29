import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { config } from "dotenv";
import { VideoModel } from "../models/VideoModel.js";
import { CourseModel } from "../models/CourseModel.js";

config();

// simple mp4 mvhd parser
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
    const timescale = buffer.readUInt32BE(idx + 16);
    const duration = buffer.readUInt32BE(idx + 20);
    return duration / timescale;
  } catch (err) {
    return null;
  }
};

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i += 1) {
  const a = argv[i];
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true;
    args[key] = val;
    if (val !== true) i += 1;
  }
}

const filePath = args.file || args.f;
const courseId = args.courseId;
const courseTitle = args.courseTitle;
const lectureTitle = args.title || "Imported Lecture";

if (!filePath) {
  console.error("Usage: node addLocalVideo.js --file <absolute-path> --courseId <id> OR --courseTitle <title> [--title <lecture title>]");
  process.exit(1);
}

const uploadsDir = path.join(process.cwd(), "uploads", "videos");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const main = async () => {
  if (!process.env.DB_URL) {
    console.error("DB_URL is not set in environment");
    process.exit(1);
  }

  if (!fs.existsSync(filePath)) {
    console.error("File does not exist:", filePath);
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.DB_URL, { autoIndex: true });

    // resolve course
    let course;
    if (courseId) course = await CourseModel.findById(courseId);
    else if (courseTitle) course = await CourseModel.findOne({ title: courseTitle });
    if (!course) {
      console.error("Course not found. Provide --courseId or --courseTitle matching an existing course.");
      await mongoose.disconnect();
      process.exit(1);
    }

    const basename = path.basename(filePath).replace(/[^a-z0-9._-]/gi, "-");
    const destName = `${Date.now()}-${basename}`;
    const destPath = path.join(uploadsDir, destName);
    fs.copyFileSync(filePath, destPath);

    // read file to compute duration
    let duration = 0;
    try {
      const buf = fs.readFileSync(destPath);
      const s = getMp4DurationSeconds(buf);
      duration = s ? Math.round(s) : 0;
    } catch (err) {
      console.warn("Could not compute duration, using 0", err.message || err);
      duration = 0;
    }

    const videoUrl = `/uploads/videos/${destName}`;

    // avoid duplicate
    const exists = await VideoModel.findOne({ courseId: course._id, videoUrl });
    if (exists) {
      console.log("Video already exists in DB:", exists._id.toString());
      await mongoose.disconnect();
      process.exit(0);
    }

    const video = await VideoModel.create({
      title: lectureTitle,
      description: lectureTitle,
      courseId: course._id,
      instructorId: course.instructorId,
      videoUrl,
      duration,
      isPublished: true,
      thumbnail: course.thumbnailUrl || "/uploads/1778559640270-yoriichi-tsugikuni.jpg",
    });

    // add lecture if not exists
    const lectureExists = (course.lectures || []).some((l) => l.videoUrl === videoUrl || l.title === lectureTitle);
    if (!lectureExists) {
      course.lectures.push({
        title: video.title,
        description: video.description,
        videoUrl: video.videoUrl,
        durationInSeconds: video.duration || 0,
        order: (course.lectures || []).length + 1,
      });
      await course.save();
    }

    console.log("Video added:", video._id.toString());
    console.log("Video URL:", videoUrl);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error adding video:", err);
    process.exit(1);
  }
};

main();
