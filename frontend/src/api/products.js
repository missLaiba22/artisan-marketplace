import client from "./client";

export function listProducts({ skip = 0, limit = 20 } = {}) {
  return client
    .get("/products", { params: { skip, limit } })
    .then((res) => res.data);
}

export function getProduct(productId) {
  return client.get(`/products/${productId}`).then((res) => res.data);
}

export function listMyProducts() {
  return client.get("/products/me/listings").then((res) => res.data);
}

export function createProduct(data) {
  return client.post("/products", data).then((res) => res.data);
}

export function updateProduct(productId, data) {
  return client.patch(`/products/${productId}`, data).then((res) => res.data);
}

export function deleteProduct(productId) {
  return client.delete(`/products/${productId}`).then((res) => res.data);
}
