import client from "./client";

export function register(data) {
  // data: { email, password, name, role, shop_name? }
  return client.post("/auth/register", data).then((res) => res.data);
}

export function login(data) {
  // data: { email, password } -> { access_token, token_type }
  return client.post("/auth/login", data).then((res) => res.data);
}

export function getMe() {
  return client.get("/auth/me").then((res) => res.data);
}
