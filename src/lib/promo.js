// Shared promo-code maths. Kept free of side effects so the checkout preview and
// the order placement recalculate the discount exactly the same way.

export function promoDiscount(promo, subtotal) {
  if (!promo) return 0;
  const value = Number(promo.value) || 0;
  const raw = promo.discount_type === "fixed" ? value : Math.round((subtotal * value) / 100);
  const capped = Number(promo.max_discount) > 0 ? Math.min(raw, Number(promo.max_discount)) : raw;
  return Math.max(0, Math.min(Math.round(capped), subtotal));
}

export function promoProblem(promo, subtotal, storeId) {
  if (!promo || promo.is_active === false) return "That promo code isn't valid.";
  if (promo.expires_at && new Date(promo.expires_at).getTime() < Date.now()) return "That promo code has expired.";
  if (Number(promo.usage_limit) > 0 && (promo.used_count || 0) >= Number(promo.usage_limit)) {
    return "That promo code has been fully redeemed.";
  }
  if (Number(promo.min_order) > 0 && subtotal < Number(promo.min_order)) {
    return "Your basket is below the minimum spend for this code.";
  }
  if (promo.store_id && storeId && promo.store_id !== storeId) return "This code doesn't apply to this store.";
  return null;
}