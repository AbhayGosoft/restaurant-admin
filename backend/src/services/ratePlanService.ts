export const calculateRate = (basePrice: number, amountType: "FLAT" | "PERCENTAGE", amountValue: number) => {
  if (amountType === "FLAT") {
    return Number((basePrice + amountValue).toFixed(2));
  }

  return Number((basePrice + basePrice * (amountValue / 100)).toFixed(2));
};
