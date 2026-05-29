import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { config } from "dotenv";
import { UserTypeModel } from "../models/UserModel.js";

config();

const users = [
  // 5 students
  { firstName: "Alice", lastName: "Nguyen", email: "alice.student@example.com", password: "Password123", role: "STUDENT" },
  { firstName: "Bob", lastName: "Patel", email: "bob.student@example.com", password: "Password123", role: "STUDENT" },
  { firstName: "Carla", lastName: "Smith", email: "carla.student@example.com", password: "Password123", role: "STUDENT" },
  { firstName: "Daniel", lastName: "Kim", email: "daniel.student@example.com", password: "Password123", role: "STUDENT" },
  { firstName: "Eva", lastName: "Lopez", email: "eva.student@example.com", password: "Password123", role: "STUDENT" },

  // 4 instructors
  { firstName: "Frank", lastName: "Miller", email: "frank.instructor@example.com", password: "Password123", role: "INSTRUCTOR", headline: "Senior JS Instructor" },
  { firstName: "Grace", lastName: "Hernandez", email: "grace.instructor@example.com", password: "Password123", role: "INSTRUCTOR", headline: "Data Structures Instructor" },
  { firstName: "Hector", lastName: "Wang", email: "hector.instructor@example.com", password: "Password123", role: "INSTRUCTOR", headline: "Web Dev Instructor" },
  { firstName: "Ivy", lastName: "Chen", email: "ivy.instructor@example.com", password: "Password123", role: "INSTRUCTOR", headline: "Machine Learning Instructor" },
];

const main = async () => {
  if (!process.env.DB_URL) {
    console.error("DB_URL is not set in environment. Set it in .env or environment variables.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.DB_URL, { autoIndex: true });
    console.log("Connected to DB for seeding");

    const emails = users.map((u) => u.email.toLowerCase());
    // remove any existing users with these emails to make the script idempotent
    await UserTypeModel.deleteMany({ email: { $in: emails } });

    // hash passwords
    for (const u of users) {
      u.email = u.email.toLowerCase();
      u.password = await bcrypt.hash(u.password, 10);
    }

    const created = await UserTypeModel.insertMany(users);
    console.log(`Inserted ${created.length} users`);
    console.log(created.map((c) => ({ email: c.email, role: c.role }))); // brief confirmation

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error seeding users:", err);
    process.exit(1);
  }
};

main();
