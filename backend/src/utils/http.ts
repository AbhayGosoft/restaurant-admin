import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";
import { env } from "../config/env.js";

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const asyncHandler =
  (handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };

export const validateBody = <T>(schema: ZodType<T>, body: unknown) => schema.parse(body);
export const validateQuery = <T>(schema: ZodType<T>, query: unknown) => schema.parse(query);

export const idParam = (req: Request, name = "id") => {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new ApiError(400, `Invalid route parameter: ${name}`);
  }
  return value;
};

/** Standard success envelope: { status: true, message, data }. */
export const sendSuccess = (res: Response, data: unknown, message = "OK", statusCode = 200) => {
  res.status(statusCode).json({ status: true, message, data });
};

export const errorHandler = (
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (error instanceof ZodError) {
    return res.status(422).json({
      status: false,
      message: error.issues[0]?.message ?? "Validation failed",
      errors: error.issues,
    });
  }

  if (error instanceof ApiError) {
    return res.status(error.statusCode).json({ status: false, message: error.message });
  }

  console.error(error);
  return res.status(500).json({
    status: false,
    message: "Internal server error",
    ...(env.nodeEnv === "development" && error instanceof Error
      ? { error: error.message }
      : {}),
  });
};
