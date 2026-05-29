import mongoose from "mongoose";
import { config } from "dotenv";
import { CourseModel } from "../models/CourseModel.js";

config();

const main = async () => {
  try {
    await mongoose.connect(process.env.DB_URL);
    const course = await CourseModel.findOne({ isPublished: true });
    if (!course) {
      console.error('No published course found');
      process.exit(1);
    }
    course.price = 100;
    await course.save();
    console.log('Updated course', course._id.toString(), 'title=', course.title);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

main();
