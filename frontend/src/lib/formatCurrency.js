export function formatCurrency(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(number);
}

