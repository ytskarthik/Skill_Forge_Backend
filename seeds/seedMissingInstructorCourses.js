import mongoose from "mongoose";
import { config } from "dotenv";
import { CourseModel } from "../models/CourseModel.js";
import { UserTypeModel } from "../models/UserModel.js";

config();

const courseTemplates = [
  {
    category: "Programming",
    title: "Programming Fundamentals",
    subtitle: "Build a strong foundation in coding",
    description:
      "Learn the basics of programming, problem solving, and writing clean code with practical examples.",
    level: "BEGINNER",
    price: 0,
    tags: ["programming", "coding", "beginner"],
  },
  {
    category: "Data Science",
    title: "Data Science Essentials",
    subtitle: "Start analyzing data with confidence",
    description:
      "Explore the core ideas of data collection, analysis, and visualization through hands-on examples.",
    level: "BEGINNER",
    price: 0,
    tags: ["data science", "analytics", "beginner"],
  },
  {
    category: "Business",
    title: "Business Strategy Basics",
    subtitle: "Understand how modern businesses grow",
    description:
      "Discover the fundamentals of business strategy, planning, and decision-making for real-world use.",
    level: "BEGINNER",
    price: 0,
    tags: ["business", "strategy", "beginner"],
  },
];

const pickTemplate = (index) => courseTemplates[index % courseTemplates.length];

const buildCourseTitle = (template, instructor) => {
  const instructorName = `${instructor.firstName} ${instructor.lastName || ""}`.trim();
  return `${template.title} - ${instructorName}`;
};

const main = async () => {
  const dbUrl = process.env.DB_URL || process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!dbUrl) {
    console.error("DB_URL is not set. Set it in .env or environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(dbUrl, { autoIndex: true });
    console.log("Connected to DB for missing instructor course seeding");

    const instructors = await UserTypeModel.find({ role: "INSTRUCTOR" }).select("firstName lastName email");
    if (!instructors.length) {
      console.log("No instructors found.");
      await mongoose.disconnect();
      process.exit(0);
    }

    let createdCount = 0;

    for (const [index, instructor] of instructors.entries()) {
      const existingCount = await CourseModel.countDocuments({ instructorId: instructor._id });
      if (existingCount > 0) {
        continue;
      }

      const template = pickTemplate(index);
      const title = buildCourseTitle(template, instructor);

      const created = await CourseModel.create({
        title,
        subtitle: template.subtitle,
        description: template.description,
        category: template.category,
        level: template.level,
        language: "English",
        price: template.price,
        instructorId: instructor._id,
        isPublished: true,
        isBlocked: false,
        tags: template.tags,
      });

      createdCount += 1;
      console.log(`Created course for ${instructor.email}: ${created.title}`);
    }

    console.log(`Created ${createdCount} missing instructor course(s)`);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error seeding missing instructor courses:", err);
    process.exit(1);
  }
};

main();
