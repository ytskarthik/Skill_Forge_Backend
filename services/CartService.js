import Cart from "../models/Cart.js";

export const addToCartService = async (studentId, courseId) => {
  let cart = await Cart.findOne({ student: studentId });

  if (!cart) {
    cart = new Cart({
      student: studentId,
      items: [],
    });
  }

  const alreadyExists = cart.items.find(
    (item) => item.course.toString() === courseId
  );

  if (alreadyExists) {
    throw new Error("Course already in cart");
  }

  cart.items.push({ course: courseId });

  await cart.save();
  await cart.populate({
    path: "items.course",
    populate: {
      path: "instructorId",
      select: "firstName lastName email",
    },
  });

  return cart;
};

export const getCartService = async (studentId) => {
  return await Cart.findOne({ student: studentId }).populate({
    path: "items.course",
    populate: {
      path: "instructorId",
      select: "firstName lastName email",
    },
  });
};

export const removeFromCartService = async (
  studentId,
  courseId
) => {
  const cart = await Cart.findOne({ student: studentId });

  if (!cart) {
    throw new Error("Cart not found");
  }

  cart.items = cart.items.filter(
    (item) => item.course.toString() !== courseId
  );

  await cart.save();
  await cart.populate({
    path: "items.course",
    populate: {
      path: "instructorId",
      select: "firstName lastName email",
    },
  });

  return cart;
};