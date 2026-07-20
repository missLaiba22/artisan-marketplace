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