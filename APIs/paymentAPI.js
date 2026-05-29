import exp from "express";
import Stripe from "stripe";
import { verifyToken } from "../middlewares/verifyToken.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import { PaymentModel } from "../models/PaymentModel.js";
import { CourseModel } from "../models/CourseModel.js";
import { EnrollmentModel } from "../models/EnrollmentModel.js";

const getStripeClient = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  // specify API version to avoid runtime incompatibilities
  return new Stripe(key, { apiVersion: "2022-11-15" });
};

export const paymentRoute = exp.Router();

paymentRoute.use(verifyToken, authorizeRoles("STUDENT"));

const markEnrollmentPaid = async ({ studentId, courseId }) => {
  let enrollment = await EnrollmentModel.findOne({ studentId, courseId });

  if (!enrollment) {
    enrollment = await EnrollmentModel.create({
      studentId,
      courseId,
      paymentStatus: "PAID",
    });

    await CourseModel.findByIdAndUpdate(courseId, {
      $inc: { totalEnrollments: 1 },
    });
  } else if (enrollment.paymentStatus !== "PAID") {
    enrollment.paymentStatus = "PAID";
    enrollment.lastAccessedAt = new Date();
    await enrollment.save();

    await CourseModel.findByIdAndUpdate(courseId, {
      $inc: { totalEnrollments: 1 },
    });
  }

  return enrollment;
};

paymentRoute.post("/create-order", async (req, res, next) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ message: "Stripe is not configured on server" });
    }

    const { courseId, courseIds } = req.body;
    const studentId = req.user.userId;

    let paymentCourses;
    let paymentAmount;
    let paymentCourseId;

    if (Array.isArray(courseIds) && courseIds.length > 0) {
      paymentCourses = await CourseModel.find({
        _id: { $in: courseIds },
        isPublished: true,
      });

      if (paymentCourses.length !== courseIds.length) {
        return res.status(404).json({ message: "One or more published paid courses not found" });
      }

      paymentAmount = paymentCourses.reduce((total, course) => total + (Number(course.price) || 0), 0);
      paymentCourseId = courseIds[0];
    } else {
      paymentCourses = [];
      paymentCourseId = courseId;
      const course = await CourseModel.findById(courseId);
      if (!course || !course.isPublished) {
        return res.status(404).json({ message: "Published course not found" });
      }
      if (Number(course.price) <= 0) {
        return res.status(400).json({ message: "This course is free. Use enrollment directly." });
      }
      paymentCourses = [course];
      paymentAmount = Number(course.price) || 0;
    }

    if (paymentAmount <= 0) {
      return res.status(400).json({ message: "No payable courses found" });
    }

    const amountInPaise = Math.round(paymentAmount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPaise,
      currency: "inr",
      payment_method_types: ["card"],
      metadata: {
        studentId: studentId.toString(),
        courseId: paymentCourseId.toString(),
        courseIds: JSON.stringify(courseIds || [paymentCourseId]),
      },
    });

    await PaymentModel.create({
      studentId,
      courseId: paymentCourseId,
      orderId: paymentIntent.id,
      amount: paymentAmount,
      currency: "INR",
      status: "PENDING",
    });

    res.status(200).json({
      message: "Payment order created",
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    next(err);
  }
});

paymentRoute.post("/verify", async (req, res, next) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ message: "Stripe is not configured on server" });
    }

    const { paymentIntentId, courseId, courseIds } = req.body;
    const studentId = req.user.userId;

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    const intentCourseIds = paymentIntent.metadata?.courseIds
      ? JSON.parse(paymentIntent.metadata.courseIds)
      : [paymentIntent.metadata?.courseId];
    const matchesStudent = paymentIntent.metadata?.studentId === String(studentId);

    if (!matchesStudent) {
      return res.status(400).json({ message: "Payment intent does not match this enrollment" });
    }

    const isSingleCourse = !Array.isArray(courseIds) || courseIds.length === 0;
    if (isSingleCourse && paymentIntent.metadata?.courseId !== courseId) {
      return res.status(400).json({ message: "Payment intent does not match this enrollment" });
    }
    if (!isSingleCourse && JSON.stringify(intentCourseIds) !== JSON.stringify(courseIds)) {
      return res.status(400).json({ message: "Payment intent does not match this batch enrollment" });
    }

    if (paymentIntent.status !== "succeeded") {
      await PaymentModel.findOneAndUpdate({ orderId: paymentIntentId }, { status: "FAILED" });
      return res.status(400).json({ message: "Payment not completed" });
    }

    await PaymentModel.findOneAndUpdate(
      { orderId: paymentIntentId },
      {
        status: "SUCCESS",
        paymentId: paymentIntent.id,
        paidAt: new Date(),
        $unset: { expiresAt: "" },
      },
    );

    const coursesToEnroll = courseIds && Array.isArray(courseIds) && courseIds.length > 0
      ? courseIds
      : [courseId];

    const enrollmentResults = [];
    for (const courseToEnroll of coursesToEnroll) {
      const enrollment = await markEnrollmentPaid({ studentId, courseId: courseToEnroll });
      enrollmentResults.push(enrollment);
    }

    res.status(200).json({
      message: "Payment successful and enrollment completed",
      success: true,
      payload: enrollmentResults,
    });
  } catch (err) {
    next(err);
  }
});

paymentRoute.post("/retry-verify", async (req, res, next) => {
  try {
    const stripe = getStripeClient();
    if (!stripe) {
      return res.status(500).json({ message: "Stripe is not configured on server" });
    }

    const { courseId, courseIds } = req.body;
    const studentId = req.user.userId;
    const targetCourseId = Array.isArray(courseIds) && courseIds.length > 0 ? courseIds[0] : courseId;

    const latestPayment = await PaymentModel.findOne({
      studentId,
      courseId: targetCourseId,
      status: { $in: ["PENDING", "SUCCESS"] },
    }).sort({ createdAt: -1 });

    if (!latestPayment) {
      return res.status(404).json({ message: "No payment record found for this course" });
    }

    if (latestPayment.status === "SUCCESS") {
      const coursesToEnroll = Array.isArray(courseIds) && courseIds.length > 0 ? courseIds : [courseId];
      const enrollmentResults = [];
      for (const courseToEnroll of coursesToEnroll) {
        const enrollment = await markEnrollmentPaid({ studentId, courseId: courseToEnroll });
        enrollmentResults.push(enrollment);
      }
      return res.status(200).json({
        message: "Payment already successful. Enrollment synced.",
        success: true,
        payload: enrollmentResults,
      });
    }

    const paymentIntent = await stripe.paymentIntents.retrieve(latestPayment.orderId);

    const intentCourseIds = paymentIntent.metadata?.courseIds
      ? JSON.parse(paymentIntent.metadata.courseIds)
      : [paymentIntent.metadata?.courseId];
    const matchesStudent = paymentIntent.metadata?.studentId === String(studentId);

    const isSingleCourse = !Array.isArray(courseIds) || courseIds.length === 0;
    if (!matchesStudent) {
      return res.status(400).json({ message: "Payment intent does not match this enrollment" });
    }
    if (isSingleCourse && paymentIntent.metadata?.courseId !== String(courseId)) {
      return res.status(400).json({ message: "Payment intent does not match this enrollment" });
    }
    if (!isSingleCourse && JSON.stringify(intentCourseIds) !== JSON.stringify(courseIds)) {
      return res.status(400).json({ message: "Payment intent does not match this batch enrollment" });
    }

    if (paymentIntent.status !== "succeeded") {
      const ageMs = Date.now() - new Date(latestPayment.createdAt).getTime();
      const fifteenMinutesMs = 15 * 60 * 1000;

      if (ageMs >= fifteenMinutesMs) {
        await PaymentModel.findByIdAndUpdate(latestPayment._id, {
          status: "FAILED",
        });
      }

      return res.status(400).json({
        message: "Payment is still not completed",
        stripeStatus: paymentIntent.status,
      });
    }

    await PaymentModel.findByIdAndUpdate(latestPayment._id, {
      status: "SUCCESS",
      paymentId: paymentIntent.id,
      paidAt: new Date(),
      $unset: { expiresAt: "" },
    });

    const enrollment = await markEnrollmentPaid({ studentId, courseId });

    res.status(200).json({
      message: "Payment verified and enrollment updated",
      success: true,
      payload: enrollment,
    });
  } catch (err) {
    next(err);
  }
});

paymentRoute.get("/my-payments", async (req, res, next) => {
  try {
    const payments = await PaymentModel.find({
      studentId: req.user.userId,
      status: "SUCCESS",
    })
      .populate("courseId", "title thumbnailUrl price")
      .sort({ paidAt: -1 });

    res.status(200).json({ message: "Payments fetched", payload: payments });
  } catch (err) {
    next(err);
  }
});
