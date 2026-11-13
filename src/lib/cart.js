import { useEffect, useState } from "react";

const KEY = "avora_cart_v2";
const EVENT = "avora-cart-change";

export function readCart() {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persist(items) {
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

export function addToCart(line, qty = 1) {
  const items = readCart();
  const existing = items.find((item) => item.product_id === line.product_id);
  const next = existing
    ? items.map((item) =>
        item.product_id === line.product_id ? { ...item, qty: item.qty + qty } : item
      )
    : [...items, { ...line, qty }];
  persist(next);
  return next;
}

export function setCartQty(productId, qty) {
  const items = readCart();
  const next = qty <= 0
    ? items.filter((item) => item.product_id !== productId)
    : items.map((item) => (item.product_id === productId ? { ...item, qty } : item));
  persist(next);
  return next;
}

export function removeCartLine(productId) {
  persist(readCart().filter((item) => item.product_id !== productId));
}

export function clearCart() {
  persist([]);
}

export function replaceCart(lines) {
  persist(lines);
  return lines;
}

export function cartLinesFromOrder(order) {
  return (order.items ?? []).map((item) => ({
    product_id: item.product_id,
    name: item.name,
    price: item.unit_price,
    qty: item.qty,
    emoji: "🍽️",
    tint: "bg-[#F6EEFB]",
    unit: "",
    store_id: order.store_id,
    store_name: order.store_name,
    delivery_fee: order.delivery_fee || 0,
  }));
}

export function useCart() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const sync = () => setItems(readCart());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const subtotal = items.reduce((sum, item) => sum + (item.price || 0) * (item.qty || 0), 0);
  const count = items.reduce((sum, item) => sum + (item.qty || 0), 0);
  const store = items[0] ? { id: items[0].store_id, name: items[0].store_name, fee: items[0].delivery_fee || 0 } : null;

  return { items, count, subtotal, store };
}