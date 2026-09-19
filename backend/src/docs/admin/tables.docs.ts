/**
 * @openapi
 * /api/admin/restaurants/{restaurantId}/tables:
 *   get:
 *     tags: ["Admin: Tables"]
 *     summary: List a restaurant's physical tables
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
 *         description: Tables
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
 * /api/admin/restaurants/{restaurantId}/tables:
 *   post:
 *     tags: ["Admin: Tables"]
 *     summary: Create a physical table
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
 *             required: [name, capacity]
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 100, example: "T-01" }
 *               capacity: { type: integer, minimum: 1, maximum: 100, example: 4 }
 *               preference: { type: string, enum: [ANY, WINDOW, INDOOR, OUTDOOR], default: ANY, example: WINDOW }
 *               section: { type: string, maxLength: 100, nullable: true, example: "Ground floor" }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, MAINTENANCE], default: ACTIVE }
 *     responses:
 *       201:
 *         description: Table created
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
 * /api/admin/restaurants/{restaurantId}/tables/availability:
 *   get:
 *     tags: ["Admin: Tables"]
 *     summary: Check which physical tables are free for a date/time/party size
 *     description: Independent of the slot grid — useful for walk-ins or manual booking assignment.
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
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
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       403:
 *         $ref: "#/components/responses/Forbidden"
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */

/**
 * @openapi
 * /api/admin/restaurants/{restaurantId}/tables/{tableId}:
 *   patch:
 *     tags: ["Admin: Tables"]
 *     summary: Update a physical table
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Send one or more fields to update.
 *             properties:
 *               name: { type: string, minLength: 1, maxLength: 100, example: "T-01" }
 *               capacity: { type: integer, minimum: 1, maximum: 100, example: 4 }
 *               preference: { type: string, enum: [ANY, WINDOW, INDOOR, OUTDOOR] }
 *               section: { type: string, maxLength: 100, nullable: true }
 *               status: { type: string, enum: [ACTIVE, INACTIVE, MAINTENANCE] }
 *     responses:
 *       200:
 *         description: Table updated
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
 * /api/admin/restaurants/{restaurantId}/tables/{tableId}:
 *   delete:
 *     tags: ["Admin: Tables"]
 *     summary: Deactivate a physical table
 *     description: Marks the table INACTIVE; it is not permanently deleted.
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     parameters:
 *       - in: path
 *         name: restaurantId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: tableId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Table deactivated
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
