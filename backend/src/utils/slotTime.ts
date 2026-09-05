/** DB stores slot times as 24h "HH:mm"; the API surface uses "h:mm AM/PM" throughout. */
export const to12Hour = (time24: string): string => {
  const [hourStr, minuteStr] = time24.split(":");
  const hour = Number(hourStr);
  const minute = Number(minuteStr);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute.toString().padStart(2, "0")} ${period}`;
};

export const to24Hour = (time12: string): string => {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time12.trim());
  if (!match) throw new Error(`Invalid time format: ${time12}`);
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const period = match[3]!.toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
};

export const isValidTime12 = (value: string) => /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.test(value.trim());
