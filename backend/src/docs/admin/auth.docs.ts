/**
 * @openapi
 * /api/admin/auth/login:
 *   post:
 *     tags: ["Admin: Auth"]
 *     summary: Admin/SuperAdmin login
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email: { type: string, format: email }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: Login successful
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
 *                         token: { type: string }
 *                         admin: { $ref: "#/components/schemas/AdminSummary" }
 *       401:
 *         description: Invalid email or password
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorEnvelope" }
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */

/**
 * @openapi
 * /api/admin/auth/me:
 *   get:
 *     tags: ["Admin: Auth"]
 *     summary: Get the current admin's profile
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     responses:
 *       200:
 *         description: Current admin
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: "#/components/schemas/SuccessEnvelope"
 *                 - type: object
 *                   properties:
 *                     data: { $ref: "#/components/schemas/AdminSummary" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 */

/**
 * @openapi
 * /api/admin/auth/change-password:
 *   patch:
 *     tags: ["Admin: Auth"]
 *     summary: Change the current admin's password
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword: { type: string, format: password }
 *               newPassword: { type: string, format: password, minLength: 8 }
 *     responses:
 *       200:
 *         description: Password changed
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       401:
 *         description: Not authenticated, or current password is incorrect
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorEnvelope" }
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */
export {};
