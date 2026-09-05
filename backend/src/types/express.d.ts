import type { AdminRole } from "../../generated/prisma/enums.js";

declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
      /** Present only on requests authenticated with an admin/superadmin JWT. */
      admin?: {
        id: string;
        email: string;
        role: AdminRole;
      };
      /** Present only on requests authenticated with a restaurant customer JWT. */
      customer?: {
        id: string;
        phone: string;
      };
    }
  }
}
