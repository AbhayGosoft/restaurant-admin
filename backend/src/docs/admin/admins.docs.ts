/**
 * @openapi
 * /api/admin/admins:
 *   get:
 *     tags: [Admins]
 *     summary: List admin accounts (SuperAdmin only)
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     responses:
 *       200:
 *         description: Admins
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 */

/**
 * @openapi
 * /api/admin/admins:
 *   post:
 *     tags: [Admins]
 *     summary: Create an admin account (SuperAdmin only)
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password]
 *             properties:
 *               name: { type: string }
 *               email: { type: string, format: email }
 *               password: { type: string, format: password, minLength: 8 }
 *               role: { type: string, enum: [ADMIN, SUPERADMIN], default: ADMIN }
 *               restaurantIds: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       201:
 *         description: Admin created
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 *       409:
 *         description: An admin with this email already exists
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorEnvelope" }
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */

/**
 * @openapi
 * /api/admin/admins/{id}:
 *   patch:
 *     tags: [Admins]
 *     summary: Update an admin account (SuperAdmin only). Set status to ACTIVE to reactivate a deactivated admin.
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               role: { type: string, enum: [ADMIN, SUPERADMIN] }
 *               status: { type: string, enum: [ACTIVE, INACTIVE] }
 *               password: { type: string, format: password, minLength: 8 }
 *               restaurantIds: { type: array, items: { type: string, format: uuid } }
 *     responses:
 *       200:
 *         description: Admin updated
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       400:
 *         description: Cannot deactivate your own account
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorEnvelope" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 *       404:
 *         $ref: "#/components/responses/NotFound"
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */

/**
 * @openapi
 * /api/admin/admins/{id}:
 *   delete:
 *     tags: [Admins]
 *     summary: Deactivate an admin account (SuperAdmin only)
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Admin deactivated
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       400:
 *         description: Cannot deactivate your own account
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorEnvelope" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 */
export {};
