import mongoose from "mongoose";
import { config } from "dotenv";
import { CourseModel } from "../models/CourseModel.js";
import { UserTypeModel } from "../models/UserModel.js";

config();

const categories = [
  "Programming",
  "Data Science",
  "Design",
  "Business",
  "Marketing",
  "Personal Development",
];

const sampleDescription = (category, instructorName) =>
  `Comprehensive ${category} course taught by ${instructorName}. Learn practical skills and build real projects.`;

const main = async () => {
  if (!process.env.DB_URL) {
    console.error("DB_URL is not set. Set it in .env or environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.DB_URL, { autoIndex: true });
    console.log("Connected to DB for course seeding");

    const instructors = await UserTypeModel.find({ role: "INSTRUCTOR" });
    if (!instructors.length) {
      console.error("No instructors found. Seed instructors first.");
      process.exit(1);
    }

    const toInsert = [];

    for (const instr of instructors) {
      for (const category of categories) {
        const title = `${category} Essentials - ${instr.firstName} ${instr.lastName || ""}`.trim();

        // remove existing course with same title to keep idempotent
        await CourseModel.deleteMany({ title, instructorId: instr._id });

        toInsert.push({
          title,
          subtitle: `${category} course by ${instr.firstName}`,
          description: sampleDescription(category, instr.firstName),
          category,
          level: "BEGINNER",
          language: "English",
          price: 0,
          instructorId: instr._id,
          isPublished: true,
          tags: [category.toLowerCase(), "beginner"],
        });
      }
    }

    const created = await CourseModel.insertMany(toInsert);
    console.log(`Inserted ${created.length} courses`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error seeding courses:", err);
    process.exit(1);
  }
};

main();
