/**
 * @openapi
 * /api/payments/initiate:
 *   post:
 *     tags: ["User: Payments"]
 *     summary: Create a Razorpay order for the selected menu items
 *     description: The amount is the server-side total of the selected items (DB prices). Send the same items as `preorderItems` when creating the booking.
 *     security:
 *       - ClientKey: []
 *       - CustomerBearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [restaurantId, items]
 *             properties:
 *               restaurantId: { type: string, format: uuid }
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [menuItemId, quantity]
 *                   properties:
 *                     menuItemId: { type: string, format: uuid }
 *                     quantity: { type: integer, minimum: 1, maximum: 50 }
 *     responses:
 *       200:
 *         description: Payment order created
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 */

/**
 * @openapi
 * /api/payments/verify:
 *   post:
 *     tags: ["User: Payments"]
 *     summary: Verify a Razorpay payment signature
 *     security:
 *       - ClientKey: []
 *       - CustomerBearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [razorpay_order_id, razorpay_payment_id, razorpay_signature]
 *             properties:
 *               razorpay_order_id: { type: string }
 *               razorpay_payment_id: { type: string }
 *               razorpay_signature: { type: string }
 *     responses:
 *       200:
 *         description: Payment verified
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */
export {};
