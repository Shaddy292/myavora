export const CURRENCY = "₦";

export function formatNGN(value) {
  const n = Math.round(Number(value) || 0);
  return `${CURRENCY}${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  });
}

export function timeAgo(value) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const mins = Math.max(0, Math.round(diff / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

export const ORDER_STATUS = {
  placed: { label: "New order", tone: "bg-[#FFF4E3] text-[#A95400] ring-[#FFE2BC]" },
  accepted: { label: "Accepted", tone: "bg-[#EEF1FF] text-[#2E3A9E] ring-[#D9DFFF]" },
  preparing: { label: "Preparing", tone: "bg-[#FDF0E4] text-[#B05C00] ring-[#F8DCBE]" },
  ready_for_pickup: { label: "Ready for pickup", tone: "bg-[#E9F6F0] text-[#166B45] ring-[#C9EBD9]" },
  rider_assigned: { label: "Rider assigned", tone: "bg-[#EFEAFB] text-[#4B2080] ring-[#DCCFF3]" },
  picked_up: { label: "On the way", tone: "bg-[#E8EEFB] text-[#1E4A9E] ring-[#CBD9F5]" },
  delivered: { label: "Delivered", tone: "bg-[#E7F6EC] text-[#15693F] ring-[#C6EAD3]" },
  cancelled: { label: "Cancelled", tone: "bg-[#FDECEC] text-[#A11D1D] ring-[#F7CDCD]" },
  failed: { label: "Failed", tone: "bg-[#FDECEC] text-[#A11D1D] ring-[#F7CDCD]" },
};

export const ACTIVE_STATUSES = ["placed", "accepted", "preparing", "ready_for_pickup", "rider_assigned", "picked_up"];

export const ROLE_PERMISSIONS = {
  admin: [
    "orders.view",
    "verification.manage",
    "finance.view",
    "finance.manage",
    "reports.view",
    "support.manage",
    "backup.run",
  ],
  ops: ["orders.view", "verification.manage", "support.manage"],
  finance: ["orders.view", "finance.view", "finance.manage"],
  support: ["orders.view", "support.manage"],
  customer: [],
};

export const ROLE_LABEL = {
  admin: "Administrator",
  ops: "Operations",
  finance: "Finance",
  rider: "Rider",
  support: "Support agent",
  vendor: "Vendor",
  customer: "Customer",
};

export const CATEGORIES = [
  { label: "Restaurants", emoji: "🍲", tint: "bg-[#FFF1EC]" },
  { label: "Groceries", emoji: "🛒", tint: "bg-[#EAF6EF]" },
  { label: "Drinks", emoji: "🥤", tint: "bg-[#EEF1FF]" },
  { label: "Pharmacy", emoji: "💊", tint: "bg-[#E9F6F8]" },
  { label: "Bakery", emoji: "🥐", tint: "bg-[#FDF3E3]" },
  { label: "Snacks", emoji: "🍫", tint: "bg-[#F6EEFB]" },
];