import axios from "axios";
import qs from "qs";
import { config } from "dotenv";
import mongoose from "mongoose";
import { CourseModel } from "../models/CourseModel.js";

config();

const API_BASE = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 5000}`;

const main = async () => {
  try {
    // find a payable course
    await mongoose.connect(process.env.DB_URL);
    const course = await CourseModel.findOne({ price: { $gt: 0 }, isPublished: true });
    await mongoose.disconnect();
    if (!course) throw new Error("No payable published course found");

    console.log("Using course", course._id.toString(), course.title, "price", course.price);

    // authenticate student
    const authResp = await axios.post(`${API_BASE}/common-api/authenticate`, { email: "alice.student@example.com", password: "Password123" });
    const token = authResp.data?.token;
    console.log("Authenticated, token length", token?.length || 0);

    // create order
    const createResp = await axios.post(`${API_BASE}/payment-api/create-order`, { courseId: course._id }, { headers: { Authorization: `Bearer ${token}` } });
    console.log("Create order response status", createResp.status);
    const clientSecret = createResp.data?.clientSecret;
    const paymentIntentId = createResp.data?.paymentIntentId;
    console.log("PaymentIntentId", paymentIntentId);

    // confirm PaymentIntent via Stripe test API using test secret
    const stripeSecret = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecret) throw new Error("No STRIPE_SECRET_KEY in env");

    const confirmUrl = `https://api.stripe.com/v1/payment_intents/${paymentIntentId}/confirm`;
    const confirmResp = await axios.post(confirmUrl, qs.stringify({ payment_method: "pm_card_visa" }), {
      auth: { username: stripeSecret, password: "" },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    console.log("Stripe confirm status", confirmResp.status, confirmResp.data.status);

    // call backend verify
    const verifyResp = await axios.post(`${API_BASE}/payment-api/verify`, { paymentIntentId, courseId: course._id }, { headers: { Authorization: `Bearer ${token}` } });
    console.log("Verify response", verifyResp.status, verifyResp.data.message);

    process.exit(0);
  } catch (err) {
    console.error(err.response?.data || err.message || err);
    process.exit(1);
  }
};

main();
