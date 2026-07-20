import client from "./client";

export function checkout(data) {
  // data: { items: [{ product_id, quantity }] }
  return client.post("/orders/checkout", data).then((res) => res.data);
}

export function listMyArtisanOrders() {
  return client.get("/orders/me/artisan-orders").then((res) => res.data);
}

export function listMyOrderHistory() {
  return client.get("/orders/me/history").then((res) => res.data);
}

export function getMyLatestOrder() {
  return client.get("/orders/me/latest").then((res) => res.data);
}
