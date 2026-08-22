import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/http.js";

const setupOrder = ["CATEGORY", "ROOM_TYPE", "ROOM", "RATE_PLAN", "SERVICE", "COMPLETED"] as const;

type SetupStep = (typeof setupOrder)[number];

const nextStep = (step: SetupStep): SetupStep => setupOrder[Math.min(setupOrder.indexOf(step) + 1, setupOrder.length - 1)];

export const getSetupProgress = async (ownerId: string) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: {
      id: true,
      setupCompleted: true,
      currentStep: true,
      _count: { select: { stayProfiles: true } },
    },
  });

  if (!owner) {
    throw new ApiError(404, "Owner not found");
  }

  return owner;
};

export const advanceSetupStep = async (ownerId: string, completedStep: SetupStep) => {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { currentStep: true, setupCompleted: true },
  });

  if (!owner || owner.setupCompleted) {
    return getSetupProgress(ownerId);
  }

  const ownerStepIndex = setupOrder.indexOf(owner.currentStep as SetupStep);
  const completedStepIndex = setupOrder.indexOf(completedStep);
  if (completedStepIndex < ownerStepIndex) {
    return getSetupProgress(ownerId);
  }

  const updatedStep = nextStep(completedStep);
  await prisma.user.update({
    where: { id: ownerId },
    data: {
      currentStep: updatedStep,
      setupCompleted: updatedStep === "COMPLETED",
    },
  });

  return getSetupProgress(ownerId);
};

export const finishSetup = async (ownerId: string) =>
  prisma.user.update({
    where: { id: ownerId },
    data: { currentStep: "COMPLETED", setupCompleted: true },
    select: { id: true, setupCompleted: true, currentStep: true },
  });
