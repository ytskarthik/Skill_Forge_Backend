import exp from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { UserTypeModel } from "../models/UserModel.js";
import { CourseModel } from "../models/CourseModel.js";
import { EnrollmentModel } from "../models/EnrollmentModel.js";
import { ReviewModel } from "../models/ReviewModel.js";
import { recalculateCourseRating } from "../services/courseService.js";

export const studentRoute = exp.Router();

studentRoute.use(verifyToken, authorizeRoles("STUDENT"));

studentRoute.get("/profile", async (req, res, next) => {
  try {
    const student = await UserTypeModel.findById(req.user.userId).select("-password");
    res.status(200).json({ message: "Student profile fetched", payload: student });
  } catch (err) {
    next(err);
  }
});

studentRoute.post("/courses/:courseId/enroll", async (req, res, next) => {
  try {
    const course = await CourseModel.findById(req.params.courseId);
    if (!course || !course.isPublished) {
      return res.status(404).json({ message: "Published course not found" });
    }

    const existingEnrollment = await EnrollmentModel.findOne({
      studentId: req.user.userId,
      courseId: req.params.courseId,
    });

    if (existingEnrollment) {
      return res.status(200).json({
        message: "Student already enrolled in this course",
        payload: existingEnrollment,
      });
    }

    if (course.price > 0) {
      return res.status(402).json({
        message: "Payment required before enrollment for this course",
      });
    }

    const enrollment = await EnrollmentModel.create({
      studentId: req.user.userId,
      courseId: req.params.courseId,
      paymentStatus: "FREE",
    });

    await CourseModel.findByIdAndUpdate(req.params.courseId, {
      $inc: { totalEnrollments: 1 },
    });

    res.status(201).json({ message: "Enrollment created", payload: enrollment });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "Student already enrolled in this course" });
    }
    next(err);
  }
});

studentRoute.get("/enrollments", async (req, res, next) => {
  try {
    const enrollments = await EnrollmentModel.find({ studentId: req.user.userId })
      .populate({
        path: "courseId",
        populate: {
          path: "instructorId",
          select: "firstName lastName headline",
        },
      })
      .sort({ updatedAt: -1 });

    res.status(200).json({ message: "Enrollments fetched", payload: enrollments });
  } catch (err) {
    next(err);
  }
});

studentRoute.get("/dashboard", async (req, res, next) => {
  try {
    const [student, enrollments, reviews] = await Promise.all([
      UserTypeModel.findById(req.user.userId).select("-password"),
      EnrollmentModel.find({ studentId: req.user.userId }).populate("courseId", "title thumbnailUrl level"),
      ReviewModel.find({ studentId: req.user.userId }).populate("courseId", "title"),
    ]);

    res.status(200).json({
      message: "Student dashboard fetched",
      payload: {
        student,
        totalEnrolledCourses: enrollments.length,
        completedCourses: enrollments.filter((enrollment) => enrollment.progressPercentage === 100).length,
        enrollments,
        reviews,
      },
    });
  } catch (err) {
    next(err);
  }
});

studentRoute.get("/courses/:courseId/progress", async (req, res, next) => {
  try {
    const enrollment = await EnrollmentModel.findOne({
      studentId: req.user.userId,
      courseId: req.params.courseId,
    }).populate("courseId", "title lectures");

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    res.status(200).json({ message: "Progress fetched", payload: enrollment });
  } catch (err) {
    next(err);
  }
});

studentRoute.patch("/courses/:courseId/progress", async (req, res, next) => {
  try {
    const { completedLectureIds = [] } = req.body;
    const course = await CourseModel.findById(req.params.courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const totalLectures = course.lectures.length;
    const progressPercentage =
      totalLectures === 0 ? 0 : Math.round((completedLectureIds.length / totalLectures) * 100);

    const enrollment = await EnrollmentModel.findOneAndUpdate(
      { studentId: req.user.userId, courseId: req.params.courseId },
      {
        completedLectureIds,
        progressPercentage,
        lastAccessedAt: new Date(),
        completedAt: progressPercentage === 100 ? new Date() : null,
      },
      { new: true },
    );

    if (!enrollment) {
      return res.status(404).json({ message: "Enrollment not found" });
    }

    res.status(200).json({ message: "Progress updated", payload: enrollment });
  } catch (err) {
    next(err);
  }
});

studentRoute.post("/courses/:courseId/reviews", async (req, res, next) => {
  try {
    const enrollment = await EnrollmentModel.findOne({
      studentId: req.user.userId,
      courseId: req.params.courseId,
    });

    if (!enrollment) {
      return res.status(403).json({ message: "Enroll in the course before reviewing it" });
    }

    const review = await ReviewModel.findOneAndUpdate(
      { studentId: req.user.userId, courseId: req.params.courseId },
      {
        rating: req.body.rating,
        comment: req.body.comment || "",
      },
      { new: true, upsert: true, runValidators: true },
    );

    await recalculateCourseRating(req.params.courseId);

    res.status(201).json({ message: "Review saved", payload: review });
  } catch (err) {
    next(err);
  }
});