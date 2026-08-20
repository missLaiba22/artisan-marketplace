import client from "./client";

export function listMyPromotions() {
  return client.get("/promotions/me").then((res) => res.data);
}

export function createPromotion(data) {
  return client.post("/promotions", data).then((res) => res.data);
}