import mongoose from "mongoose";
import { config } from "dotenv";
import { CourseModel } from "../models/CourseModel.js";
import { VideoModel } from "../models/VideoModel.js";

config();

// sample videos available in uploads/videos directory
const sampleVideos = [
  "/uploads/videos/1779421608431-sample.mp4",
  "/uploads/videos/1779421570973-sample.mp4",
  "/uploads/videos/1779344616486-sample.mp4",
  "/uploads/videos/1779338724827-sample.mp4",
  "/uploads/videos/1779337069587-sample.mp4",
  "/uploads/videos/1779251936309-sample.mp4",
  "/uploads/videos/1779251707217-sample.mp4",
];

const main = async () => {
  if (!process.env.DB_URL) {
    console.error("DB_URL is not set. Set it in .env or environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.DB_URL, { autoIndex: true });
    console.log("Connected to DB for lecture seeding");

    const courses = await CourseModel.find({});
    if (!courses.length) {
      console.error("No courses found. Seed courses first.");
      process.exit(1);
    }

    let sampleIndex = 0;

    let insertedCount = 0;
    for (const course of courses) {
      const instructorId = course.instructorId;

      for (let i = 1; i <= 2; i++) {
        const title = `${course.title} - Lecture ${i}`;
        const description = `Lecture ${i} for ${course.title}`;
        const videoUrl = sampleVideos[sampleIndex % sampleVideos.length];

        // Check if a video already exists for this course with same title or url
        const existingVideo = await VideoModel.findOne({
          courseId: course._id,
          $or: [{ title }, { videoUrl }],
        });

        let videoDoc;
        if (existingVideo) {
          videoDoc = existingVideo;
        } else {
          videoDoc = await VideoModel.create({
            title,
            description,
            courseId: course._id,
            instructorId,
            videoUrl,
            duration: 0,
            isPublished: true,
          });
          insertedCount++;
        }

        // Ensure course lecture entry does not already exist
        const courseHasLecture = (course.lectures || []).some((lec) => lec.title === title || lec.videoUrl === videoUrl);
        if (!courseHasLecture) {
          await CourseModel.findByIdAndUpdate(course._id, {
            $push: {
              lectures: {
                title: videoDoc.title,
                description: videoDoc.description,
                videoUrl: videoDoc.videoUrl,
                durationInSeconds: videoDoc.duration || 0,
                order: 1,
              },
            },
          });
        }

        sampleIndex++;
      }
    }

    // Renumber lecture orders for each course
    const updatedCourses = await CourseModel.find({});
    for (const c of updatedCourses) {
      if (Array.isArray(c.lectures) && c.lectures.length > 0) {
        c.lectures.sort((a, b) => (a._id > b._id ? 1 : -1));
        c.lectures = c.lectures.map((lec, idx) => ({ ...lec.toObject ? lec.toObject() : lec, order: idx + 1 }));
        await c.save();
      }
    }

    console.log(`Inserted ${insertedCount} new videos and attached lectures to courses`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error seeding lectures:", err);
    process.exit(1);
  }
};

main();
