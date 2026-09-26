/**
 * @openapi
 * /api/admin/restaurants:
 *   get:
 *     tags: ["Admin: Restaurants"]
 *     summary: List restaurants (scoped to the admin's assigned restaurants; SuperAdmin sees all)
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: adminId
 *         schema: { type: string, format: uuid }
 *         description: SuperAdmin only — list restaurants managed by this specific admin instead of the caller's own assignments.
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [ACTIVE, INACTIVE] }
 *         description: Only return active or only deactivated restaurants. Omit for both.
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 500, default: 20 }
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
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */

/**
 * @openapi
 * /api/admin/restaurants:
 *   post:
 *     tags: ["Admin: Restaurants"]
 *     summary: Create a restaurant
 *     description: An Admin (non-SuperAdmin) creator is automatically linked as a manager of the new restaurant.
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, cuisineLabel, prepTimeMin, prepTimeMax, priceForTwo, addressLine, city, phone, latitude, longitude]
 *             properties:
 *               name: { type: string }
 *               banner: { type: string }
 *               gallery: { type: array, items: { type: string } }
 *               categoryIds: { type: array, items: { type: string, format: uuid } }
 *               cuisineLabel: { type: string }
 *               isPureVeg: { type: boolean, default: false }
 *               prepTimeMin: { type: integer, minimum: 0 }
 *               prepTimeMax: { type: integer, minimum: 0 }
 *               priceForTwo: { type: integer, minimum: 0 }
 *               offerText: { type: string }
 *               offerSubText: { type: string }
 *               about: { type: string }
 *               addressLine: { type: string }
 *               city: { type: string }
 *               state: { type: string }
 *               country: { type: string, default: India }
 *               pincode: { type: string }
 *               phone: { type: string }
 *               latitude: { type: number, minimum: -90, maximum: 90 }
 *               longitude: { type: number, minimum: -180, maximum: 180 }
 *               seatingCapacity: { type: integer, minimum: 1, default: 40 }
 *               maxPartySize: { type: integer, minimum: 1, default: 12 }
 *     responses:
 *       201:
 *         description: Restaurant created
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       422:
 *         $ref: "#/components/responses/ValidationError"
 */

/**
 * @openapi
 * /api/admin/restaurants/{id}:
 *   get:
 *     tags: ["Admin: Restaurants"]
 *     summary: Get restaurant detail (must be an assigned restaurant, unless SuperAdmin)
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
 *         description: Restaurant
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
 * /api/admin/restaurants/{id}:
 *   patch:
 *     tags: ["Admin: Restaurants"]
 *     summary: Update a restaurant (must be an assigned restaurant, unless SuperAdmin)
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
 *             description: All fields from the create schema, made optional
 *     responses:
 *       200:
 *         description: Restaurant updated
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
 * /api/admin/restaurants/{id}/rating:
 *   patch:
 *     tags: ["Admin: Restaurants"]
 *     summary: Set a restaurant's public rating (SuperAdmin only)
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
 *             required: [rating, ratingCount]
 *             properties:
 *               rating: { type: number, minimum: 0, maximum: 5 }
 *               ratingCount: { type: integer, minimum: 0 }
 *     responses:
 *       200:
 *         description: Rating updated
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
 * /api/admin/restaurants/{id}:
 *   delete:
 *     tags: ["Admin: Restaurants"]
 *     summary: Deactivate a restaurant (must be an assigned restaurant, unless SuperAdmin)
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
 *         description: Restaurant deactivated
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
 * /api/admin/restaurants/{id}/permanent:
 *   delete:
 *     tags: ["Admin: Restaurants"]
 *     summary: Permanently delete a restaurant (SuperAdmin only)
 *     description: Removes the restaurant with its menus, slots, tables and assignments. If the restaurant has any bookings, it is deactivated instead.
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
 *         description: Deleted permanently (data.deleted = true) or, when history exists, deactivated instead (data.deactivated = true)
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/SuccessEnvelope" }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       404:
 *         $ref: "#/components/responses/NotFound"
 */

export {};
