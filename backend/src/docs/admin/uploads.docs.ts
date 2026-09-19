/**
 * @openapi
 * /api/uploads/images:
 *   post:
 *     tags: ["Admin: Uploads"]
 *     summary: Upload up to 10 images (JPEG/PNG/WebP/GIF, 5MB each)
 *     security:
 *       - ClientKey: []
 *       - AdminBearer: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               images:
 *                 type: array
 *                 items: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Uploaded image URLs
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 urls: { type: array, items: { type: string } }
 *       401:
 *         $ref: "#/components/responses/Unauthorized"
 *       422:
 *         description: No files selected, or an invalid file type was provided
 *         content:
 *           application/json:
 *             schema: { $ref: "#/components/schemas/ErrorEnvelope" }
 */
export {};
