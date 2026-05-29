import { CourseModel } from "../models/CourseModel.js";
import { ReviewModel } from "../models/ReviewModel.js";

export const buildCourseFilters = ({ search, category, level, instructorId }) => {
  const filters = {};

  if (search) {
    filters.$or = [
      { title: { $regex: search, $options: "i" } },
      { subtitle: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
      { tags: { $elemMatch: { $regex: search, $options: "i" } } },
    ];
  }

  if (category) {
    filters.category = category;
  }

  if (level) {
    filters.level = level;
  }

  if (instructorId) {
    filters.instructorId = instructorId;
  }

  return filters;
};

export const recalculateCourseRating = async (courseId) => {
  const reviews = await ReviewModel.find({ courseId });

  const totalReviews = reviews.length;
  const averageRating =
    totalReviews === 0
      ? 0
      : Number(
          (
            reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
          ).toFixed(1),
        );

  await CourseModel.findByIdAndUpdate(courseId, {
    averageRating,
    totalReviews,
  });
};