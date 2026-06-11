export function monthStartDate() {
  const date = new Date();
  date.setDate(1);
  return date.toISOString().slice(0, 10);
}
