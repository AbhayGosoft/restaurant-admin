/**
 * @openapi
 * /api/restaurant/auth:
 *   post:
 *     tags: [Restaurant Central Auth]
 *     summary: Authenticate/register a user from a central-auth token (server-to-server only)
 *     description: |
 *       Called only by Darshan Admin (central auth), never the app directly. See
 *       RESTAURANT_CENTRAL_AUTH_SPEC.md for the full contract. Verifies `central_token`
 *       against the central JWKS and cross-checks its `phone_number`/`central_user_id`
 *       claims against the request body before logging in or registering the user.
 *     security:
 *       - RestaurantAppKey: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [phone, central_token, central_user_id]
 *             properties:
 *               phone: { type: string, example: "+919876543210", description: "E.164 phone number" }
 *               central_token: { type: string, description: "JWT minted by the central auth service" }
 *               central_user_id: { type: integer, example: 12345 }
 *               name: { type: string, maxLength: 255 }
 *               email: { type: string, format: email }
 *               player_id: { type: string, description: "OneSignal player id for push notifications" }
 *     responses:
 *       200:
 *         description: Authenticated (or newly registered) successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: "#/components/schemas/SuccessEnvelope"
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         user:
 *                           type: object
 *                           properties:
 *                             id: { type: string, format: uuid }
 *                             name: { type: string, nullable: true }
 *                             phone: { type: string }
 *                             email: { type: string, nullable: true }
 *                         access_token: { type: string }
 *                         refresh_token: { type: string }
 *                         expires_in: { type: integer, description: "Access token TTL in seconds" }
 *       401:
 *         description: Invalid/missing app key, or central_token invalid/mismatched with body
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorEnvelope" }
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 *       503:
 *         description: Downstream dependency (e.g. restaurant service) temporarily unavailable
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorEnvelope" }
 */
export {};
