# Online Learning Platform Backend

This backend follows the same style as the reference project, with the code organized into `APIs`, `models`, `middlewares`, and `services`.

## Features covered in this backend scaffold

- JWT authentication for `STUDENT`, `INSTRUCTOR`, and `ADMIN`
- Course creation and management for instructors
- Course browsing and course details endpoints
- Student enrollment and progress tracking
- Reviews and ratings
- Student, instructor, and admin dashboard endpoints

## Project structure

- `server.js` - app setup, route mounting, MongoDB connection
- `APIs/` - route modules
- `models/` - Mongoose schemas
- `middlewares/` - authentication and role authorization
- `services/` - auth and course helper logic

## Run locally

1. Install dependencies with `npm install`
2. Update `.env` with a valid `DB_URL` and `JWT_SECRET`
3. Start in dev mode with `npm run dev`

## Main routes

- `POST /common-api/register`
- `POST /common-api/authenticate`
- `POST /common-api/logout`
- `GET /common-api/courses`
- `GET /common-api/courses/:courseId`
- `GET /student-api/dashboard`
- `POST /student-api/courses/:courseId/enroll`
- `PATCH /student-api/courses/:courseId/progress`
- `POST /student-api/courses/:courseId/reviews`
- `GET /instructor-api/dashboard`
- `POST /instructor-api/courses`
- `PATCH /instructor-api/courses/:courseId`
- `POST /instructor-api/courses/:courseId/lectures`
- `GET /admin-api/dashboard`
- `GET /admin-api/users`
- `PATCH /admin-api/users/:userId/status`

## Notes

- Video upload, streaming, payments, Cloudinary/S3, Stripe/Razorpay, and HLS are not implemented yet in this backend pass.
- The enrollment endpoint currently marks paid courses as `PENDING` so you can add payment integration later without rewriting the data model.