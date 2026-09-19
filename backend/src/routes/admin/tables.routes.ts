import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAdminAuth, requireRestaurantAccess } from "../../middleware/auth.js";
import { ApiError, asyncHandler, idParam, sendSuccess, validateBody } from "../../utils/http.js";

const router = Router({ mergeParams: true });
router.use(requireAdminAuth, requireRestaurantAccess("restaurantId"));

const tableSchema = z.object({
  name: z.string().trim().min(1).max(100),
  capacity: z.coerce.number().int().min(1).max(100),
  preference: z.enum(["ANY", "WINDOW", "INDOOR", "OUTDOOR"]).default("ANY"),
  section: z.string().trim().max(100).optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "MAINTENANCE"]).default("ACTIVE"),
});
const toTable = (table: any) => ({ id: table.id, name: table.name, capacity: table.capacity, preference: table.preference, section: table.section, status: table.status, createdAt: table.createdAt, updatedAt: table.updatedAt });

router.get("/", asyncHandler(async (req, res) => {
  const restaurantId = idParam(req, "restaurantId");
  const tables = await prisma.diningTable.findMany({ where: { restaurantId }, orderBy: [{ capacity: "asc" }, { name: "asc" }] });
  sendSuccess(res, tables.map(toTable));
}));

router.post("/", asyncHandler(async (req, res) => {
  const restaurantId = idParam(req, "restaurantId");
  const body = validateBody(tableSchema, req.body);
  const table = await prisma.diningTable.create({ data: { ...body, restaurantId } });
  sendSuccess(res, toTable(table), "Table created", 201);
}));

const assertTable = async (restaurantId: string, tableId: string) => {
  const table = await prisma.diningTable.findFirst({ where: { id: tableId, restaurantId } });
  if (!table) throw new ApiError(404, "Table not found");
};
router.patch("/:tableId", asyncHandler(async (req, res) => {
  const restaurantId = idParam(req, "restaurantId"); const tableId = idParam(req, "tableId");
  await assertTable(restaurantId, tableId);
  const table = await prisma.diningTable.update({ where: { id: tableId }, data: validateBody(tableSchema.partial(), req.body) });
  sendSuccess(res, toTable(table), "Table updated");
}));
router.delete("/:tableId", asyncHandler(async (req, res) => {
  const restaurantId = idParam(req, "restaurantId"); const tableId = idParam(req, "tableId");
  await assertTable(restaurantId, tableId);
  await prisma.diningTable.update({ where: { id: tableId }, data: { status: "INACTIVE" } });
  sendSuccess(res, {}, "Table deactivated");
}));
export default router;
