export function formatPrice(price) {
  const value = Number(price);

  if (!Number.isFinite(value)) {
    return "Price pending";
  }

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(value);
}

export function formatStockAmount(stockAmount) {
  const value = Number(stockAmount);

  if (!Number.isFinite(value)) {
    return "Stock unavailable";
  }

  if (value <= 0) {
    return "Out of stock";
  }

  if (value === 1) {
    return "1 in stock";
  }

  return `${value} in stock`;
}
