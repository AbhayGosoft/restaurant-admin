/**
 * @openapi
 * /api/admin/bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: List bookings (scoped to the admin's assigned restaurants; SuperAdmin sees all)
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     parameters:
 *       - in: query
 *         name: restaurantId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [upcoming, past, cancelled] }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated bookings
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
 *                         bookings: { type: array, items: { type: object } }
 *                         pagination: { $ref: "#/components/schemas/Pagination" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */

/**
 * @openapi
 * /api/admin/bookings/{id}:
 *   get:
 *     tags: [Bookings]
 *     summary: Get a booking by id (must be an assigned restaurant, unless SuperAdmin)
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
 *         description: Booking
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

/**
 * @openapi
 * /api/admin/bookings/{id}/cancel:
 *   post:
 *     tags: [Bookings]
 *     summary: Cancel a booking (must be an assigned restaurant, unless SuperAdmin)
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason: { type: string, default: Other, description: "One of the configured cancellation reason labels" }
 *     responses:
 *       200:
 *         description: Booking cancelled
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
export {};
