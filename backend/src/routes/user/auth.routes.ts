import { Router } from "express";
import { z } from "zod";
import { logoutCustomer, refreshCustomerSession } from "../../services/customerAuthService.js";
import { asyncHandler, sendSuccess, validateBody } from "../../utils/http.js";

const router = Router();

// Login/registration for this module now happens exclusively via the Darshan Admin
// (central auth) server-to-server bridge — see POST /api/restaurant/auth and
// RESTAURANT_CENTRAL_AUTH_SPEC.md. The app never calls a login endpoint here directly;
// it only uses the session (access/refresh tokens) that bridge issues.

const refreshSchema = z.object({ refresh_token: z.string().min(1, "refresh_token is required") });

// OpenAPI docs: src/docs/user/auth.docs.ts
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
