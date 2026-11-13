export const LAGOS_CENTER = [6.5244, 3.3792];

export const LAGOS_AREAS = {
  yaba: [6.5095, 3.3711],
  surulere: [6.4969, 3.3481],
  ebute: [6.4867, 3.3842],
  "ebute metta": [6.4867, 3.3842],
  ikeja: [6.6018, 3.3515],
  "victoria island": [6.4281, 3.4219],
  "vi": [6.4281, 3.4219],
  ikoyi: [6.4541, 3.4348],
  lekki: [6.4474, 3.4739],
  ajah: [6.4692, 3.5652],
  apapa: [6.4489, 3.3598],
  gbagada: [6.5558, 3.3867],
  maryland: [6.5716, 3.3665],
  oshodi: [6.5539, 3.3256],
  agege: [6.6152, 3.3211],
  ojota: [6.5786, 3.3817],
  ketu: [6.5904, 3.3843],
  magodo: [6.6217, 3.3786],
  oniru: [6.436, 3.465],
  "festac": [6.4667, 3.2833],
  "mainland": [6.52, 3.37],
};

export function coordsFor(area, fallback = LAGOS_CENTER) {
  const key = String(area || "").toLowerCase().trim();
  if (!key) return fallback;
  if (LAGOS_AREAS[key]) return LAGOS_AREAS[key];
  const match = Object.keys(LAGOS_AREAS).find((name) => key.includes(name));
  return match ? LAGOS_AREAS[match] : fallback;
}

const hash = (value) => {
  let h = 0;
  for (let i = 0; i < String(value).length; i += 1) {
    h = (h * 31 + String(value).charCodeAt(i)) % 100000;
  }
  return h;
};

/** Small deterministic offset so two places in the same area don't overlap on the map. */
export function nudge(point, seed, spread = 0.014) {
  const a = (hash(seed) % 360) * (Math.PI / 180);
  const r = ((hash(`${seed}-r`) % 100) / 100) * spread;
  return [point[0] + Math.sin(a) * r, point[1] + Math.cos(a) * r];
}

export const RIDER_PROGRESS = {
  placed: 0,
  accepted: 0.05,
  preparing: 0.12,
  ready_for_pickup: 0.2,
  rider_assigned: 0.3,
  picked_up: 0.65,
  delivered: 1,
  cancelled: 0,
  failed: 0.5,
};

export function pointBetween(from, to, ratio) {
  const t = Math.min(1, Math.max(0, ratio));
  return [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t];
}