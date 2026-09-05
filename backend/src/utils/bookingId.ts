import crypto from "node:crypto";

/** e.g. "#SSR" (from "Shree Shyam Restaurant") + "240822" (yyMMdd) + 4 random digits. */
export const generateHumanBookingId = (restaurantName: string, now = new Date()) => {
  const initials = restaurantName
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase())
    .join("")
    .slice(0, 4) || "RB";

  const yy = String(now.getUTCFullYear()).slice(-2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const random = crypto.randomInt(1000, 9999);

  return `#${initials}${yy}${mm}${dd}${random}`;
};
