const STORAGE_KEY = "order_history";
const LAST_ORDER_KEY = "last_checkout";

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export function saveCheckout(checkout) {
  const record = {
    ...checkout,
    saved_at: new Date().toISOString(),
  };

  const history = readJson(STORAGE_KEY, []);
  const nextHistory = [record, ...history].slice(0, 10);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory));
  localStorage.setItem(LAST_ORDER_KEY, JSON.stringify(record));
  return record;
}

export function getLastCheckout() {
  return readJson(LAST_ORDER_KEY, null);
}

export function getCheckoutHistory() {
  return readJson(STORAGE_KEY, []);
}