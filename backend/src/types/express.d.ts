import type { UserRole } from "../../generated/prisma/enums.js";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      user?: {
        id: string;
        email: string;
        role: UserRole;
      };
    }
  }
}
