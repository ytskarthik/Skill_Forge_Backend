import exp from "express";
import { authenticate, register } from "../services/authService.js";
import { CourseModel } from "../models/CourseModel.js";
import { ReviewModel } from "../models/ReviewModel.js";
import { buildCourseFilters } from "../services/courseService.js";

export const commonRouter = exp.Router();

commonRouter.get("/health", (req, res) => {
  res.status(200).json({ message: "Online learning platform backend is running" });
});

commonRouter.post("/register", async (req, res, next) => {
  try {
    const newUser = await register(req.body);
    res.status(201).json({ message: "Registration successful", payload: newUser });
  } catch (err) {
    next(err);
  }
});

commonRouter.post("/authenticate", async (req, res, next) => {
  try {
    const { token, user } = await authenticate(req.body);

    res.cookie("token", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      message: "Login successful",
      token,
      payload: user,
    });
  } catch (err) {
    next(err);
  }
});

commonRouter.post("/logout", (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ message: "Logout successful" });
});

commonRouter.get("/courses", async (req, res, next) => {
  try {
    const filters = buildCourseFilters(req.query);
    filters.isPublished = true;

    const courses = await CourseModel.find(filters)
      .populate("instructorId", "firstName lastName email headline")
      .sort({ createdAt: -1 });

    res.status(200).json({ message: "Courses fetched", payload: courses });
  } catch (err) {
    next(err);
  }
});

commonRouter.get("/courses/:courseId", async (req, res, next) => {
  try {
    const courseDoc = await CourseModel.findById(req.params.courseId).populate(
      "instructorId",
      "firstName lastName email headline bio",
    );

    if (!courseDoc) {
      return res.status(404).json({ message: "Course not found" });
    }

    const course = courseDoc.toObject();
    course.lectures = (course.lectures || []).map((lecture) => ({
      ...lecture,
      videoUrl: "",
    }));

    const reviews = await ReviewModel.find({ courseId: req.params.courseId })
      .populate("studentId", "firstName lastName")
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Course fetched",
      payload: {
        course,
        reviews,
      },
    });
  } catch (err) {
    next(err);
  }
});