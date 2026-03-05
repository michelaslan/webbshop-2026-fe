import { getBaseUrl } from "./api.js";

export async function getProducts() {
  const url = new URL("products", getBaseUrl());
  const response = await fetch(url);
  if (response.ok) {
    return response.json();
  }
  return [];
}

export async function createProduct(product) {
  const url = new URL("products", getBaseUrl());
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
  if (response.ok) {
    return response.json();
  }
  const err = await response.json().catch(() => ({}));
  throw new Error(err.errors?.[0]?.msg || "Failed to create product");
}