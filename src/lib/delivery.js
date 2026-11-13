const KEY = "avora:delivery-address";
const EVENT = "avora:delivery";

// The delivery address picked from the home header, remembered on this device.
export const readDeliveryAddress = () => {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const saveDeliveryAddress = (address) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(address));
  } catch {
    // Storage can be unavailable inside some WebViews; the pick still applies for this session.
  }
  window.dispatchEvent(new Event(EVENT));
};

export const formatAddress = (address) =>
  address ? [address.label, address.area].filter(Boolean).join(" · ") || address.line1 : "";