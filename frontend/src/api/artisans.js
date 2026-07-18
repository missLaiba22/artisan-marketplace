import client from "./client";

export function getMyArtisanProfile() {
  return client.get("/artisans/me").then((res) => res.data);
}

export function listPendingArtisans() {
  return client.get("/artisans/pending").then((res) => res.data);
}

export function approveArtisan(artisanId) {
  return client.patch(`/artisans/${artisanId}/approve`).then((res) => res.data);
}