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

/**
 * @openapi
 * /api/restaurants/{id}/tables/availability:
 *   get:
 *     tags: ["User: Tables"]
 *     summary: Check which physical tables are free for a date/time/party size
 *     description: Lets the app show real tables (not just slot capacity) before the customer books.
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
 *         schema: { type: string, example: "2026-09-25" }
 *       - in: query
 *         name: time
 *         required: true
 *         schema: { type: string, example: "12:00 PM" }
 *       - in: query
 *         name: people
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: tablePreference
 *         schema: { type: string, enum: [Any Table, Window Seat, Indoor Seat, Outdoor Seat] }
 *     responses:
 *       200:
 *         description: Table availability for the requested slot
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
 *             required: [date, time, people, tablePreference, fullName, mobileNumber, payment]
 *             properties:
 *               date: { type: string, example: "2026-09-20" }
 *               time: { type: string, example: "07:30 PM" }
 *               people: { type: integer, minimum: 1 }
 *               tablePreference: { type: string, description: "One of the configured table preference labels" }
 *               specialRequest: { type: string, maxLength: 500 }
 *               fullName: { type: string }
 *               mobileNumber: { type: string }
 *               email: { type: string, format: email }
 *               latitude: { type: number }
 *               longitude: { type: number }
 *               tableId: { type: string, format: uuid, description: "Optional physical table; otherwise the smallest suitable table is selected" }
 *               preorderItems:
 *                 type: array
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
