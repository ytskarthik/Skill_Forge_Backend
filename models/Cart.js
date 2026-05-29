import { Schema, Types, model } from "mongoose";

const cartItemSchema = new Schema(
  {
    course: {
      type: Types.ObjectId,
      ref: "courses",
      required: [true, "Course reference is required in cart item"],
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false, versionKey: false }
);

const cartSchema = new Schema(
  {
    student: {
      type: Types.ObjectId,
      ref: "users",
      required: [true, "Student reference is required for cart"],
    },
    items: {
      type: [cartItemSchema],
      default: [],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length <= 100,
        message: "Cart cannot contain more than 100 items",
      },
    },
  },
  {
    timestamps: true,
    strict: "throw",
    versionKey: false,
  }
);

export const Cart = model("carts", cartSchema);
export default Cart;