import { Router } from "express";
import { z } from "zod";
import { authenticateCustomer, logoutCustomer, refreshCustomerSession } from "../services/customerAuthService.js";
import { asyncHandler, sendSuccess, validateBody } from "../utils/http.js";

const router = Router();

const authenticateSchema = z.object({
  firebase_token: z.string().min(1, "firebase_token is required"),
  name: z.string().trim().min(1).max(255).optional(),
  email: z.email().optional(),
  player_id: z.string().trim().min(1).optional(),
});

router.post(
  "/authenticate",
  asyncHandler(async (req, res) => {
    const body = validateBody(authenticateSchema, req.body);
    const { user, accessToken, refreshToken, isNewUser } = await authenticateCustomer({
      firebaseToken: body.firebase_token,
      name: body.name,
      email: body.email,
      playerId: body.player_id,
    });

    sendSuccess(
      res,
      {
        access_token: accessToken,
        refresh_token: refreshToken,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
        },
      },
      isNewUser ? "Account created" : "Login successful",
    );
  }),
);

const refreshSchema = z.object({ refresh_token: z.string().min(1, "refresh_token is required") });

router.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const body = validateBody(refreshSchema, req.body);
    const { accessToken, refreshToken } = await refreshCustomerSession(body.refresh_token);
    sendSuccess(res, { access_token: accessToken, refresh_token: refreshToken }, "Token refreshed");
  }),
);

router.post(
  "/logout",
  asyncHandler(async (req, res) => {
    const body = validateBody(refreshSchema, req.body);
    await logoutCustomer(body.refresh_token);
    sendSuccess(res, {}, "Logged out");
  }),
);

export default router;
