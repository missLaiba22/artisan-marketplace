import client from "./client";

export function getMyArtisanProfile() {
  return client.get("/artisans/me").then((res) => res.data);
}

export function listApprovedArtisans() {
  return client.get("/artisans").then((res) => res.data);
}

export function getArtisan(artisanId) {
  return client.get(`/artisans/${artisanId}`).then((res) => res.data);
}

export function listArtisanProducts(artisanId) {
  return client.get(`/artisans/${artisanId}/products`).then((res) => res.data);
}

export function listPendingArtisans() {
  return client.get("/artisans/pending").then((res) => res.data);
}

export function approveArtisan(artisanId) {
  return client.patch(`/artisans/${artisanId}/approve`).then((res) => res.data);
}

// Used only right after a brand-new Google-signup artisan authenticates —
// creates their Artisan profile (shop_name etc.) since Google never
// supplies that. Idempotent on the backend, safe to call even on a
// double-submit.
export function completeProfile(data) {
  return client.post("/artisans/complete-profile", data).then((res) => res.data);
}