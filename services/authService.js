import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "dotenv";
import { UserTypeModel } from "../models/UserModel.js";

config();

const sanitizeUser = (userDoc) => {
  const user = userDoc.toObject();
  delete user.password;
  return user;
};

export const register = async (userObj) => {
  if (userObj?.role === "ADMIN") {
    const err = new Error("Admin accounts cannot be created through public registration");
    err.status = 403;
    throw err;
  }

  const userDoc = new UserTypeModel(userObj);
  await userDoc.validate();
  userDoc.password = await bcrypt.hash(userDoc.password, 10);
  const createdUser = await userDoc.save();
  return sanitizeUser(createdUser);
};

export const authenticate = async ({ email, password, role }) => {
  const userDoc = await UserTypeModel.findOne({
    email: email?.toLowerCase(),
    ...(role ? { role } : {}),
  });

  if (!userDoc) {
    const err = new Error("Invalid email or role");
    err.status = 401;
    throw err;
  }

  if (!userDoc.isActive) {
    const err = new Error("Account is inactive. Contact admin");
    err.status = 403;
    throw err;
  }

  const isPasswordValid = await bcrypt.compare(password, userDoc.password);
  if (!isPasswordValid) {
    const err = new Error("Invalid password");
    err.status = 401;
    throw err;
  }

  const user = sanitizeUser(userDoc);
  const token = jwt.sign(
    {
      userId: userDoc._id,
      email: userDoc.email,
      role: userDoc.role,
      firstName: userDoc.firstName,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1d" },
  );

  return { token, user };
};