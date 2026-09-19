import path from "node:path";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { Router } from "express";
import multer from "multer";
import { requireAdminAuth } from "../../middleware/auth.js";
import { ApiError, asyncHandler } from "../../utils/http.js";

const router = Router();
const uploadDir = path.resolve(process.cwd(), "uploads", "images");

fs.mkdirSync(uploadDir, { recursive: true });

const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const extensionByType: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
};

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, uploadDir),
  filename: (_req, file, callback) => callback(null, `${randomUUID()}${extensionByType[file.mimetype] ?? path.extname(file.originalname)}`),
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024, files: 10 },
  fileFilter: (_req, file, callback) => {
    if (!allowedTypes.has(file.mimetype)) {
      callback(new ApiError(422, "Only JPEG, PNG, WebP and GIF images are allowed"));
      return;
    }
    callback(null, true);
  },
});

router.use(requireAdminAuth);

// OpenAPI docs: src/docs/admin/uploads.docs.ts
router.post(
  "/images",
  upload.array("images", 10),
  asyncHandler(async (req, res) => {
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files?.length) throw new ApiError(422, "Select at least one image");
    res.status(201).json({ urls: files.map((file) => `/uploads/images/${file.filename}`) });
  }),
);

export default router;
