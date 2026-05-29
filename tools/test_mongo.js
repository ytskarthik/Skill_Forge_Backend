import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DB_URL;

(async () => {
  try {
    await mongoose.connect(url, {
      dbName: "ONLINE_LEARNING_PLATFORM",
      serverSelectionTimeoutMS: 5000,
    });
    console.log("Connected OK");
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Connect error message:", err && err.message ? err.message : err);
    if (err && err.reason) console.error("Reason:", err.reason);
    process.exit(1);
  }
})();
