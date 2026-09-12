/**
 * @openapi
 * /api/admin/restaurants/{restaurantId}/slots:
 *   get:
 *     tags: [Slots]
 *     summary: List a restaurant's booking slot configuration
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Slots
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
 * /api/admin/restaurants/{restaurantId}/slots:
 *   post:
 *     tags: [Slots]
 *     summary: Create a booking slot
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [meal, time]
 *             properties:
 *               meal: { type: string, enum: [LUNCH, DINNER] }
 *               time: { type: string, example: "12:00 PM" }
 *               sortOrder: { type: integer, default: 0 }
 *               isActive: { type: boolean, default: true }
 *     responses:
 *       201:
 *         description: Slot created
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */

/**
 * @openapi
 * /api/admin/restaurants/{restaurantId}/slots/{slotId}:
 *   patch:
 *     tags: [Slots]
 *     summary: Update a booking slot
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               meal: { type: string, enum: [LUNCH, DINNER] }
 *               time: { type: string, example: "12:00 PM" }
 *               sortOrder: { type: integer }
 *               isActive: { type: boolean }
 *     responses:
 *       200:
 *         description: Slot updated
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
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
 * /api/admin/restaurants/{restaurantId}/slots/{slotId}:
 *   delete:
 *     tags: [Slots]
 *     summary: Deactivate a booking slot
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: slotId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Slot deactivated
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */
export {};
