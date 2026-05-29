import exp from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import { fileURLToPath } from "url";
import { verifyToken } from "../middlewares/verifyToken.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { CourseModel } from "../models/CourseModel.js";
import { EnrollmentModel } from "../models/EnrollmentModel.js";
import { ReviewModel } from "../models/ReviewModel.js";
import { UserTypeModel } from "../models/UserModel.js";
import { buildCourseFilters } from "../services/courseService.js";

export const instructorRoute = exp.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, "..", "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const safeBase = file.originalname
      .replace(/\.[^/.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]/g, "-")
      .toLowerCase();
    const extension = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${safeBase}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
      return;
    }
    cb(new Error("Only image files are allowed"));
  },
});

const coerceNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

instructorRoute.use(verifyToken, authorizeRoles("INSTRUCTOR"));

instructorRoute.post("/uploads/thumbnail", upload.single("thumbnail"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Thumbnail file is required" });
    }

    const host = `${req.protocol}://${req.get("host")}`;
    const thumbnailUrl = `${host}/uploads/${req.file.filename}`;

    res.status(201).json({
      message: "Thumbnail uploaded",
      payload: { thumbnailUrl },
    });
  } catch (err) {
    next(err);
  }
});

instructorRoute.get("/profile", async (req, res, next) => {
  try {
    const instructor = await UserTypeModel.findById(req.user.userId).select("-password");
    res.status(200).json({ message: "Instructor profile fetched", payload: instructor });
  } catch (err) {
    next(err);
  }
});

instructorRoute.post("/courses", async (req, res, next) => {
  try {
    const courseDoc = new CourseModel({
      ...req.body,
      instructorId: req.user.userId,
      price: coerceNumber(req.body.price, 0),
      lectures: (req.body.lectures || []).map((lecture) => ({
        ...lecture,
        durationInSeconds: coerceNumber(lecture.durationInSeconds, 0),
      })),
    });

    const newCourse = await courseDoc.save();
    res.status(201).json({ message: "Course created", payload: newCourse });
  } catch (err) {
    next(err);
  }
});

instructorRoute.get("/courses", async (req, res, next) => {
  try {
    const filters = buildCourseFilters({ ...req.query, instructorId: req.user.userId });
    const courses = await CourseModel.find(filters).sort({ updatedAt: -1 });
    res.status(200).json({ message: "Instructor courses fetched", payload: courses });
  } catch (err) {
    next(err);
  }
});

instructorRoute.get("/courses/:courseId", async (req, res, next) => {
  try {
    const course = await CourseModel.findOne({
      _id: req.params.courseId,
      instructorId: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json({ message: "Instructor course fetched", payload: course });
  } catch (err) {
    next(err);
  }
});

instructorRoute.get("/courses/:courseId/reviews", async (req, res, next) => {
  try {
    const course = await CourseModel.findOne({
      _id: req.params.courseId,
      instructorId: req.user.userId,
    }).select("_id");

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const reviews = await ReviewModel.find({ courseId: req.params.courseId })
      .populate("studentId", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json({ message: "Course reviews fetched", payload: reviews });
  } catch (err) {
    next(err);
  }
});

instructorRoute.get("/dashboard", async (req, res, next) => {
  try {
    const [instructor, courses] = await Promise.all([
      UserTypeModel.findById(req.user.userId).select("-password"),
      CourseModel.find({ instructorId: req.user.userId }),
    ]);

    const courseIds = courses.map((course) => course._id);
    const enrollments = await EnrollmentModel.find({ courseId: { $in: courseIds } });

    res.status(200).json({
      message: "Instructor dashboard fetched",
      payload: {
        instructor,
        totalCourses: courses.length,
        publishedCourses: courses.filter((course) => course.isPublished).length,
        totalStudents: new Set(enrollments.map((enrollment) => String(enrollment.studentId))).size,
        totalEnrollments: enrollments.length,
        courses,
      },
    });
  } catch (err) {
    next(err);
  }
});

instructorRoute.patch("/courses/:courseId", async (req, res, next) => {
  try {
    const updatePayload = { ...req.body };
    if (updatePayload.price !== undefined) {
      updatePayload.price = coerceNumber(updatePayload.price, 0);
    }
    if (Array.isArray(updatePayload.lectures)) {
      updatePayload.lectures = updatePayload.lectures.map((lecture) => ({
        ...lecture,
        durationInSeconds: coerceNumber(lecture.durationInSeconds, 0),
      }));
    }

    const updatedCourse = await CourseModel.findOneAndUpdate(
      { _id: req.params.courseId, instructorId: req.user.userId },
      updatePayload,
      { new: true, runValidators: true },
    );

    if (!updatedCourse) {
      return res.status(404).json({ message: "Course not found" });
    }

    res.status(200).json({ message: "Course updated", payload: updatedCourse });
  } catch (err) {
    next(err);
  }
});

instructorRoute.post("/courses/:courseId/lectures", async (req, res, next) => {
  try {
    const course = await CourseModel.findOne({
      _id: req.params.courseId,
      instructorId: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    course.lectures.push(req.body);
    await course.save();

    res.status(201).json({ message: "Lecture added", payload: course });
  } catch (err) {
    next(err);
  }
});

instructorRoute.patch("/courses/:courseId/lectures/:lectureId", async (req, res, next) => {
  try {
    const course = await CourseModel.findOne({
      _id: req.params.courseId,
      instructorId: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const lecture = course.lectures.id(req.params.lectureId);
    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    Object.assign(lecture, req.body);
    await course.save();

    res.status(200).json({ message: "Lecture updated", payload: course });
  } catch (err) {
    next(err);
  }
});

instructorRoute.delete("/courses/:courseId/lectures/:lectureId", async (req, res, next) => {
  try {
    const course = await CourseModel.findOne({
      _id: req.params.courseId,
      instructorId: req.user.userId,
    });

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const lecture = course.lectures.id(req.params.lectureId);
    if (!lecture) {
      return res.status(404).json({ message: "Lecture not found" });
    }

    lecture.deleteOne();
    course.lectures = course.lectures.map((item, index) => ({
      ...item.toObject(),
      order: index + 1,
    }));

    await course.save();

    res.status(200).json({ message: "Lecture deleted", payload: course });
  } catch (err) {
    next(err);
  }
});