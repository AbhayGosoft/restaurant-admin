import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { asyncHandler } from "../utils/http.js";
import { finishSetup, getSetupProgress } from "../services/setupService.js";

const router = Router();

router.use(requireAuth, requireRole("OWNER"));

router.get(
  "/progress",
  asyncHandler(async (req, res) => {
    res.json(await getSetupProgress(req.user!.id));
  }),
);

router.post(
  "/finish",
  asyncHandler(async (req, res) => {
    res.json(await finishSetup(req.user!.id));
  }),
);

export default router;
