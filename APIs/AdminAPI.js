import exp from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { UserTypeModel } from "../models/UserModel.js";
import { CourseModel } from "../models/CourseModel.js";
import { EnrollmentModel } from "../models/EnrollmentModel.js";
import { ReviewModel } from "../models/ReviewModel.js";
import { PaymentModel } from "../models/PaymentModel.js";

export const adminRoute = exp.Router();

adminRoute.use(verifyToken, authorizeRoles("ADMIN"));

adminRoute.get("/dashboard", async (req, res, next) => {
  try {
    const [users, courses, enrollments, reviews] = await Promise.all([
      UserTypeModel.find().select("-password"),
      CourseModel.find(),
      EnrollmentModel.find(),
      ReviewModel.find(),
    ]);

    res.status(200).json({
      message: "Admin dashboard fetched",
      payload: {
        totalUsers: users.length,
        totalStudents: users.filter((user) => user.role === "STUDENT").length,
        totalInstructors: users.filter((user) => user.role === "INSTRUCTOR").length,
        totalCourses: courses.length,
        totalEnrollments: enrollments.length,
        totalReviews: reviews.length,
      },
    });
  } catch (err) {
    next(err);
  }
});

adminRoute.get("/users", async (req, res, next) => {
  try {
    const users = await UserTypeModel.find().select("-password").sort({ createdAt: -1 });
    res.status(200).json({ message: "Users fetched", payload: users });
  } catch (err) {
    next(err);
  }
});

adminRoute.patch("/users/:userId/status", async (req, res, next) => {
  try {
    const updatedUser = await UserTypeModel.findByIdAndUpdate(
      req.params.userId,
      { isActive: req.body.isActive },
      { new: true, runValidators: true },
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ message: "User status updated", payload: updatedUser });
  } catch (err) {
    next(err);
  }
});

adminRoute.get("/courses", async (req, res, next) => {
  try {
    const courses = await CourseModel.find()
      .populate("instructorId", "firstName lastName email")
      .sort({ createdAt: -1 });

    res.status(200).json({ message: "Courses fetched", payload: courses });
  } catch (err) {
    next(err);
  }
});

adminRoute.patch("/courses/:courseId/status", async (req, res, next) => {
  try {
    const { isBlocked } = req.body;
    const updated = await CourseModel.findByIdAndUpdate(
      req.params.courseId,
      { isBlocked },
      { new: true, runValidators: true },
    ).populate("instructorId", "firstName lastName email");

    if (!updated) return res.status(404).json({ message: "Course not found" });

    res.status(200).json({ message: "Course status updated", payload: updated });
  } catch (err) {
    next(err);
  }
});

adminRoute.get("/students/:studentId/details", async (req, res, next) => {
  try {
    const student = await UserTypeModel.findById(req.params.studentId).select("-password");
    if (!student || student.role !== "STUDENT") {
      return res.status(404).json({ message: "Student not found" });
    }

    const payments = await PaymentModel.find({ studentId: req.params.studentId })
      .populate("courseId", "title price")
      .sort({ createdAt: -1 });

    const totalAmountPaid = payments
      .filter((p) => p.status === "SUCCESS")
      .reduce((sum, p) => sum + p.amount, 0);

    res.status(200).json({
      message: "Student details fetched",
      payload: { student, payments, totalAmountPaid },
    });
  } catch (err) {
    next(err);
  }
});

adminRoute.get("/instructors/:instructorId/details", async (req, res, next) => {
  try {
    const instructor = await UserTypeModel.findById(req.params.instructorId).select("-password");
    if (!instructor || instructor.role !== "INSTRUCTOR") {
      return res.status(404).json({ message: "Instructor not found" });
    }

    const courses = await CourseModel.find({ instructorId: req.params.instructorId });

    const coursesWithEnrollments = await Promise.all(
      courses.map(async (course) => {
        const enrollmentCount = await EnrollmentModel.countDocuments({ courseId: course._id });
        return {
          ...course.toObject(),
          enrollmentCount,
        };
      }),
    );

    const totalEarnings = coursesWithEnrollments.reduce((sum, course) => {
      return sum + course.price * course.enrollmentCount;
    }, 0);

    res.status(200).json({
      message: "Instructor details fetched",
      payload: { instructor, courses: coursesWithEnrollments, totalEarnings },
    });
  } catch (err) {
    next(err);
  }
});

adminRoute.get("/users/:userId/courses", async (req, res, next) => {
  try {
    const user = await UserTypeModel.findById(req.params.userId).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "INSTRUCTOR") {
      const courses = await CourseModel.find({ instructorId: req.params.userId })
        .populate("instructorId", "firstName lastName email")
        .sort({ createdAt: -1 });

      return res.status(200).json({
        message: "Instructor courses fetched",
        payload: { user, role: user.role, courses },
      });
    }

    if (user.role === "STUDENT") {
      const enrollments = await EnrollmentModel.find({ studentId: req.params.userId })
        .populate("courseId", "title subtitle category level price thumbnailUrl isPublished isBlocked instructorId")
        .sort({ createdAt: -1 });

      const courses = enrollments
        .filter((enrollment) => enrollment.courseId)
        .map((enrollment) => ({
          ...enrollment.courseId.toObject(),
          enrollmentId: enrollment._id,
          enrollmentStatus: enrollment.paymentStatus,
          progressPercentage: enrollment.progressPercentage,
          lastAccessedAt: enrollment.lastAccessedAt,
        }));

      return res.status(200).json({
        message: "Student courses fetched",
        payload: { user, role: user.role, courses },
      });
    }

    return res.status(400).json({ message: "User role does not have course data" });
  } catch (err) {
    next(err);
  }
});