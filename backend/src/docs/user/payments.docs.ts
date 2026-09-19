/**
 * @openapi
 * /api/payments/initiate:
 *   post:
 *     tags: ["User: Payments"]
 *     summary: Create a Razorpay order for the booking advance
 *     security:
 *       - ClientKey: []
 *       - CustomerBearer: []
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
