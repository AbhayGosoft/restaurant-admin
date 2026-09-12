/**
 * @openapi
 * /api/my-restaurant-bookings:
 *   get:
 *     tags: [Bookings]
 *     summary: List the signed-in customer's bookings
 *     security:
 *       - ClientKey: []
 *       - CustomerBearer: []
 *     parameters:
 *       - in: query
 *         name: filter
 *         schema: { type: string, enum: [upcoming, past] }
 *     responses:
 *       200:
 *         description: Bookings
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 */
export {};
