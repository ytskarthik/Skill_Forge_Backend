import exp from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { v2 as cloudinary } from "cloudinary";
import { verifyToken } from "../middlewares/verifyToken.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { CourseModel } from "../models/CourseModel.js";
import { VideoModel } from "../models/VideoModel.js";
import { EnrollmentModel } from "../models/EnrollmentModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsVideoDir = path.join(__dirname, "..", "uploads", "videos");

if (!fs.existsSync(uploadsVideoDir)) {
  fs.mkdirSync(uploadsVideoDir, { recursive: true });
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const videoRoute = exp.Router();

const hasCloudinaryConfig = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  const hasAll = CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET;
  const hasPlaceholder = [CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET].some((value) =>
    String(value || "").toLowerCase().includes("your_"),
  );
  return Boolean(hasAll) && !hasPlaceholder;
};

// Memory storage — buffer is piped directly to Cloudinary, nothing written to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ["video/mp4", "video/mpeg", "video/quicktime", "video/x-msvideo"];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error("Only video files are allowed"));
  },
});

function streamToCloudinary(buffer, options) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
    stream.end(buffer);
  });
}

const saveVideoLocally = async (req, file) => {
  const extension = path.extname(file.originalname || "") || ".mp4";
  const safeBase = (file.originalname || "lecture-video")
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .toLowerCase();
  const fileName = `${Date.now()}-${safeBase}${extension}`;
  const filePath = path.join(uploadsVideoDir, fileName);

  await fs.promises.writeFile(filePath, file.buffer);

  return {
    secure_url: `${req.protocol}://${req.get("host")}/uploads/videos/${fileName}`,
    public_id: "",
    duration: 0,
  };
};

videoRoute.post("/upload-temp", verifyToken, authorizeRoles("INSTRUCTOR"), upload.single("video"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No video file uploaded" });
    }

    const fallbackTitle = req.file.originalname?.replace(/\.[^/.]+$/, "") || "lecture-video";
    const title = (req.body?.title || fallbackTitle).trim();

    const result = hasCloudinaryConfig()
      ? await streamToCloudinary(req.file.buffer, {
          resource_type: "video",
          folder: "skillforge/lecture-temp",
          public_id: `temp-${req.user.userId}-${Date.now()}`,
        })
      : await saveVideoLocally(req, req.file);

    res.status(201).json({
      message: "Lecture video uploaded",
      payload: {
        title,
        videoUrl: result.secure_url,
        durationInSeconds: Math.round(result.duration || 0),
      },
    });
  } catch (err) {
    next(err);
  }
});

videoRoute.post("/upload", verifyToken, authorizeRoles("INSTRUCTOR"), upload.single("video"), async (req, res, next) => {
  try {
    const { title, description = "", courseId, duration = 0 } = req.body;

    if (!title || !courseId) {
      return res.status(400).json({ message: "Title and courseId are required" });
    }

    if (!req.file) {
      return res.status(400).json({ message: "No video file uploaded" });
    }

    const course = await CourseModel.findOne({ _id: courseId, instructorId: req.user.userId });
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const result = hasCloudinaryConfig()
      ? await streamToCloudinary(req.file.buffer, {
          resource_type: "video",
          folder: "skillforge/videos",
          public_id: `${courseId}-${Date.now()}`,
        })
      : await saveVideoLocally(req, req.file);

    const videoDoc = new VideoModel({
      title: title.trim(),
      description: description.trim(),
      courseId,
      instructorId: req.user.userId,
      videoUrl: result.secure_url,
      cloudinaryPublicId: result.public_id,
      duration: Number(duration) || Math.round(result.duration || 0),
    });

    const video = await videoDoc.save();

    res.status(201).json({
      message: "Video uploaded successfully",
      video,
    });
  } catch (err) {
    next(err);
  }
});

videoRoute.get("/course/:courseId", verifyToken, async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const course = await CourseModel.findById(courseId).select("lectures instructorId");
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    if (req.user.role === "STUDENT") {
      const enrollment = await EnrollmentModel.findOne({
        studentId: req.user.userId,
        courseId,
      });

      if (!enrollment) {
        return res.status(403).json({ message: "Enroll in this course to watch lectures" });
      }
    }

    if (req.user.role === "INSTRUCTOR" && String(course.instructorId) !== String(req.user.userId)) {
      return res.status(403).json({ message: "You can only access videos for your own courses" });
    }

    const uploadedVideos = await VideoModel.find({ courseId, isPublished: true })
      .populate("instructorId", "firstName lastName")
      .sort({ createdAt: -1 });

    const lectureVideos = (course.lectures || [])
      .filter((lecture) => lecture?.videoUrl)
      .map((lecture, index) => ({
        _id: lecture._id || `lecture-${index}`,
        title: lecture.title || `Lecture ${index + 1}`,
        description: lecture.description || "",
        videoUrl: lecture.videoUrl,
        duration: lecture.durationInSeconds || 0,
        views: 0,
      }));

    const videos = [...lectureVideos, ...uploadedVideos];

    res.status(200).json({
      message: "Videos fetched successfully",
      videos,
      videoCount: videos.length,
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /video-api/:videoId — instructor deletes their own video (also removes from Cloudinary)
videoRoute.delete("/:videoId", verifyToken, authorizeRoles("INSTRUCTOR"), async (req, res, next) => {
  try {
    const video = await VideoModel.findOne({ _id: req.params.videoId, instructorId: req.user.userId });
    if (!video) {
      return res.status(404).json({ message: "Video not found" });
    }

    if (video.cloudinaryPublicId) {
      await cloudinary.uploader.destroy(video.cloudinaryPublicId, { resource_type: "video" });
    } else if (video.videoUrl?.includes("/uploads/videos/")) {
      const localFileName = video.videoUrl.split("/uploads/videos/")[1];
      if (localFileName) {
        const localPath = path.join(uploadsVideoDir, localFileName);
        if (fs.existsSync(localPath)) {
          await fs.promises.unlink(localPath);
        }
      }
    }

    await video.deleteOne();
    res.status(200).json({ message: "Video deleted successfully" });
  } catch (err) {
    next(err);
  }
});
