export function parseAmount(text) {
  const match = text.match(/\b(?:KSH|KES|Ksh|Kes)\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
  return match ? match[1].replace(/,/g, "") : "";
}

export function parsePhone(text) {
  const match = text.match(/\b(?:2547\d{8}|2541\d{8}|07\d{8}|01\d{8})\b/);
  return match ? match[0] : "";
}

function toIsoDate(day, month, year) {
  const fullYear = Number(year) < 100 ? 2000 + Number(year) : Number(year);
  return `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseDate(text) {
  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, "0")}-${String(iso[3]).padStart(2, "0")}`;
  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (slash) return toIsoDate(slash[1], slash[2], slash[3]);
  const monthNames = {
    jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
    jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  };
  const words = text.match(/\b(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})\b/);
  if (words && monthNames[words[2].toLowerCase()]) return toIsoDate(words[1], monthNames[words[2].toLowerCase()], words[3]);
  return "";
}

export function parseReference(text) {
  const ignored = new Set(["COMPLETED", "PROCESSED", "SUCCESSFULLY", "SUCCESSFUL", "CONFIRMED", "PESALINK", "REQUEST"]);
  const explicit = text.match(/\b(?:ref(?:erence)?|txn|transaction|code|receipt|rrn|utr|mpesa)\s*(?:no\.?|number|id|code)?\s*[:#-]?\s*([A-Za-z0-9-]{6,40})\b/i);
  if (explicit && !ignored.has(explicit[1].toUpperCase())) {
    return explicit[1].replace(/[^A-Za-z0-9-]/g, "");
  }
  const leading = text.match(/^\s*\.?([A-Za-z0-9]{12,40})\b/);
  if (leading) return leading[1];
  const confirmed = text.match(/^\s*([A-Za-z0-9]{8,14})\s+Confirmed\b/i);
  if (confirmed) return confirmed[1];
  const candidates = text.match(/\b[A-Za-z0-9]{8,40}\b/g) || [];
  return candidates.find((candidate) => !ignored.has(candidate.toUpperCase()) && !/^254\d+$/.test(candidate) && !/^0\d+$/.test(candidate)) || "";
}

export function parseBankName(text) {
  const lower = text.toLowerCase();
  const banks = ["KCB", "EQUITY", "CO-OP", "COOP", "ABSA", "NCBA", "DTB", "I&M", "STANBIC", "STANDARD CHARTERED", "FAMILY BANK"];
  return banks.find((bank) => lower.includes(bank.toLowerCase())) || "";
}

export function parsePaymentMessage(text) {
  const lower = text.toLowerCase();
  const method = lower.includes("mpesa") || lower.includes("m-pesa") || /\bconfirmed\b/i.test(text) ? "mpesa" : "bank";
  return {
    amount: parseAmount(text),
    phone: parsePhone(text),
    date: parseDate(text),
    reference: parseReference(text),
    method,
    bankName: method === "bank" ? parseBankName(text) : "",
  };
}
