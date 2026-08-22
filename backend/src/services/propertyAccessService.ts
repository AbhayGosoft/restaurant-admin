import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/http.js";

export const assertPropertyAccess = async (userId: string, role: string, propertyId: string) => {
  const property = await prisma.stayProfile.findUnique({
    where: { id: propertyId },
    select: { id: true, ownerId: true, name: true },
  });

  if (!property) {
    throw new ApiError(404, "Property not found");
  }

  if (role !== "ADMIN" && property.ownerId !== userId) {
    throw new ApiError(403, "You cannot access this property");
  }

  return property;
};

export const assertOwnerSetupCompleted = async (ownerId: string) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { setupCompleted: true, currentStep: true },
  });

  if (!owner) {
    throw new ApiError(404, "Owner not found");
  }

  if (!owner.setupCompleted) {
    throw new ApiError(409, `Owner setup is incomplete. Current step: ${owner.currentStep}`);
  }
};
