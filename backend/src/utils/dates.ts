import { ApiError } from "./http.js";

export const parseDateOnly = (value: string) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(422, `Invalid date: ${value}`);
  }
  return date;
};

export const dateRangeNights = (checkIn: Date, checkOut: Date) => {
  const ms = checkOut.getTime() - checkIn.getTime();
  const nights = Math.ceil(ms / 86_400_000);
  if (nights <= 0) {
    throw new ApiError(422, "checkOutDate must be after checkInDate");
  }
  return nights;
};

export const eachBookedNight = (checkIn: Date, checkOut: Date) => {
  const nights = dateRangeNights(checkIn, checkOut);
  return Array.from({ length: nights }, (_, index) => {
    const date = new Date(checkIn);
    date.setUTCDate(date.getUTCDate() + index);
    return date;
  });
};
