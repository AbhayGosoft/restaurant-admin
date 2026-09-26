/**
 * @openapi
 * /api/restaurants:
 *   get:
 *     tags: ["User: Restaurants"]
 *     summary: List/search restaurants
 *     security:
 *       - ClientKey: []
 *     parameters:
 *       - in: query
 *         name: city
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: q
 *         schema: { type: string }
 *         description: Free-text search
 *       - in: query
 *         name: latitude
 *         schema: { type: number }
 *       - in: query
 *         name: longitude
 *         schema: { type: number }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated restaurant list
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
 *                         restaurants: { type: array, items: { type: object } }
 *                         pagination: { $ref: "#/components/schemas/Pagination" }
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */

/**
 * @openapi
 * /api/restaurants/{id}:
 *   get:
 *     tags: ["User: Restaurants"]
 *     summary: Get restaurant detail
 *     security:
 *       - ClientKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: latitude
 *         schema: { type: number }
 *       - in: query
 *         name: longitude
 *         schema: { type: number }
 *     responses:
 *       200:
 *         description: Restaurant detail
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       404:
 *         $ref: "#/components/responses/NotFound"
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */

/**
 * @openapi
 * /api/restaurants/{id}/menu:
 *   get:
 *     tags: ["User: Menu"]
 *     summary: Get a restaurant's menu
 *     security:
 *       - ClientKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Menu categories and items
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */

/**
 * @openapi
 * /api/restaurants/{id}/slots:
 *   get:
 *     tags: ["User: Slots"]
 *     summary: Get available booking slots for a date/party size
 *     security:
 *       - ClientKey: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: date
 *         required: true
 *         schema: { type: string, example: "2026-09-20" }
 *       - in: query
 *         name: people
 *         schema: { type: integer, minimum: 1, default: 1 }
 *     responses:
 *       200:
 *         description: Available slots
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       404:
 *         $ref: "#/components/responses/NotFound"
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */

// Table booking disabled — GET /api/restaurants/{id}/tables/availability is turned off for now.

/**
 * @openapi
 * /api/restaurants/{id}/bookings:
 *   post:
 *     tags: ["User: Bookings"]
 *     summary: Create a booking (after payment order creation)
 *     security:
 *       - ClientKey: []
 *       - CustomerBearer: []
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
 *             required: [date, time, people, fullName, mobileNumber, preorderItems, payment]
 *             properties:
 *               date: { type: string, example: "2026-09-20" }
 *               time: { type: string, example: "07:30 PM" }
 *               people: { type: integer, minimum: 1 }
 *               tablePreference: { type: string, description: "Deprecated (table booking disabled). Optional, defaults to Any Table." }
 *               specialRequest: { type: string, maxLength: 500 }
 *               fullName: { type: string }
 *               mobileNumber: { type: string }
 *               email: { type: string, format: email }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               preorderItems:
 *                 type: array
 *                 minItems: 1
 *                 description: Must be the same items (same total) used for /api/payments/initiate.
 *                 items:
 *                   type: object
 *                   required: [menuItemId, quantity]
 *                   properties:
 *                     menuItemId: { type: string, format: uuid }
 *                     quantity: { type: integer, minimum: 1 }
 *                     note: { type: string }
 *               payment:
 *                 type: object
 *                 required: [razorpay_order_id, razorpay_payment_id]
 *                 properties:
 *                   razorpay_order_id: { type: string }
 *                   razorpay_payment_id: { type: string }
 *     responses:
 *       201:
 *         description: Booking confirmed
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/NotFound"
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */
export {};
