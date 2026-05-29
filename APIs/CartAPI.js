import express from "express";
import { verifyToken } from "../middlewares/verifyToken.js";
import { authorizeRoles } from "../middlewares/authorizeRoles.js";
import {
  addToCartService,
  getCartService,
  removeFromCartService,
} from "../services/CartService.js";

const router = express.Router();
router.use(verifyToken);
router.use(authorizeRoles("STUDENT"));
router.post("/:courseId", async (req, res) => {
  try {
    const studentId = req.user.userId;
    const { courseId } = req.params;

    const cart = await addToCartService(
      studentId,
      courseId
    );

    res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.get("/", async (req, res) => {
  try {
    const studentId = req.user.userId;

    const cart = await getCartService(studentId);

    res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

router.delete("/:courseId", async (req, res) => {
  try {
    const studentId = req.user.userId;

    const { courseId } = req.params;

    const cart = await removeFromCartService(
      studentId,
      courseId
    );

    res.status(200).json({
      success: true,
      cart,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;