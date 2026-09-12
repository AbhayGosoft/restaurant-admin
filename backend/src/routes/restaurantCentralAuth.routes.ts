import { Router } from "express";
import { z } from "zod";
import { verifyCentralToken } from "../lib/centralAuth.js";
import { requireRestaurantAppKey } from "../middleware/auth.js";
import { authenticateCentralUser } from "../services/customerAuthService.js";
import { ApiError, asyncHandler, sendSuccess, validateBody } from "../utils/http.js";
import { logger } from "../modules/logger.js";

const router = Router();

const e164 = /^\+[1-9]\d{6,14}$/;

const authSchema = z.object({
  phone: z.string().regex(e164, "phone must be E.164 (e.g. +919876543210)"),
  central_token: z.string().min(1, "central_token is required"),
  central_user_id: z.number().int().positive(),
  name: z.string().trim().min(1).max(255).optional(),
  email: z.email().optional(),
  player_id: z.string().trim().min(1).optional(),
});

// OpenAPI docs: src/docs/restaurantCentralAuth.docs.ts
router.post(
  "/auth",
  requireRestaurantAppKey,
  asyncHandler(async (req, res) => {
    const body = validateBody(authSchema, req.body);

    const claims = await verifyCentralToken(body.central_token);

    // Trust the token, never the body: the phone in the JWT is the one a real OTP
    // verified, the phone in the JSON is whatever the caller typed in the request.
    if (claims.phoneNumber !== body.phone) {
      throw new ApiError(401, "Invalid central_token: phone_number claim does not match phone");
    }
    if (claims.centralUserId !== body.central_user_id) {
      throw new ApiError(401, "Invalid central_token: central_user_id claim does not match body");
    }

    let result;
    try {
      result = await authenticateCentralUser({
        phone: body.phone,
        centralUserId: body.central_user_id,
        name: body.name,
        email: body.email,
        playerId: body.player_id,
      });
    } catch (error) {
      if (error instanceof ApiError) throw error;
      logger.error({ err: error }, "central auth login-or-register failed");
      throw new ApiError(503, "Restaurant service is temporarily unavailable");
    }

    const { user, accessToken, refreshToken, expiresIn, isNewUser } = result;

    sendSuccess(
      res,
      {
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          email: user.email,
        },
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_in: expiresIn,
      },
      isNewUser ? "Account created" : "Authenticated.",
    );
  }),
);

export default router;
