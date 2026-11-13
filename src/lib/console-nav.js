// Navigation order mirrors how each team actually works through the day:
// admin = live orders → verification → catalog → money → people → insight → safety.
export const ADMIN_NAV = [
  { key: "overview", label: "Overview", to: "/admin" },
  { key: "orders", label: "Orders", to: "/admin/orders" },
  { key: "verification", label: "Verification", to: "/admin/verification" },
  { key: "vendors", label: "Vendors", to: "/admin-vendors" },
  { key: "riderChecks", label: "Rider checks", to: "/admin-rider-verification" },
  { key: "banners", label: "Banners", to: "/admin-banners" },
  { key: "inventory", label: "Catalog", to: "/admin-inventory" },
  { key: "categories", label: "Categories", to: "/admin-categories" },
  { key: "finance", label: "Finance", to: "/admin/finance" },
  { key: "refunds", label: "Refunds", to: "/admin-refunds" },
  { key: "promos", label: "Promo codes", to: "/promo-codes" },
  { key: "tickets", label: "Tickets", to: "/support-tickets" },
  { key: "reviews", label: "Store reviews", to: "/store-reviews" },
  { key: "users", label: "Users", to: "/admin-users" },
  { key: "staff", label: "Staff", to: "/admin-staff" },
  { key: "analytics", label: "Analytics", to: "/admin-analytics" },
  { key: "dispatch", label: "Rider dispatch", to: "/admin-dispatch" },
  { key: "fleet", label: "Delivery map", to: "/delivery-map" },
  { key: "zones", label: "Delivery areas", to: "/delivery-zones" },
  { key: "payouts", label: "Rider payouts", to: "/rider-payouts" },
  { key: "reports", label: "Reports", to: "/admin/reports" },
  { key: "content", label: "Content", to: "/admin-content" },
  { key: "settings", label: "Settings", to: "/admin-settings" },
  { key: "logs", label: "Activity log", to: "/admin-audit-logs" },
];

export const SUPPORT_NAV = [
  { key: "support", label: "Dashboard", to: "/support-dashboard" },
  { key: "queue", label: "Ticket queue", to: "/support-tickets" },
  { key: "help", label: "Help centre", to: "/help-center" },
];

export const VENDOR_NAV = [
  { key: "home", label: "Store dashboard", to: "/store-dashboard" },
  { key: "board", label: "Order board", to: "/vendor" },
  { key: "menu", label: "Menu & stock", to: "/vendor/menu" },
  { key: "menuEditor", label: "Menu editor", to: "/vendor-menu-editor" },
  { key: "products", label: "Inventory", to: "/vendor-products" },
  { key: "reviews", label: "Reviews", to: "/product-reviews" },
  { key: "analytics", label: "Analytics", to: "/vendor-dashboard" },
  { key: "monthly", label: "Monthly sales", to: "/vendor-analytics" },
  { key: "performance", label: "Performance", to: "/vendor-performance" },
  { key: "settlements", label: "Settlements", to: "/vendor/settlements" },
  { key: "payouts", label: "Payouts", to: "/vendor-payouts" },
  { key: "payoutHistory", label: "Payout history", to: "/payout-history" },
  { key: "bank", label: "Bank details", to: "/bank-settings" },
  { key: "storefront", label: "Store profile", to: "/vendor-profile" },
  { key: "storeSettings", label: "Store settings", to: "/vendor-store-settings" },
  { key: "gallery", label: "Product photos", to: "/product-gallery" },
];

export const RIDER_NAV = [
  { key: "riderHome", label: "Dashboard", to: "/rider-dashboard" },
  { key: "deliveries", label: "Deliveries", to: "/rider" },
  { key: "assignments", label: "Assignments", to: "/rider-assignments" },
  { key: "tracking", label: "Route", to: "/rider-tracking" },
  { key: "schedule", label: "Schedule", to: "/rider-schedule" },
  { key: "earnings", label: "Earnings", to: "/rider/earnings" },
  { key: "riderSettlements", label: "Settlements", to: "/rider-settlements" },
  { key: "riderPayoutHistory", label: "Payout history", to: "/payout-history" },
  { key: "riderBank", label: "Bank details", to: "/bank-settings" },
  { key: "profile", label: "Verification", to: "/rider-profile" },
];

// Customer area — ordered as a shopper moves: dashboard → browse → offers → orders → money → profile.
export const CUSTOMER_NAV = [
  { key: "dashboard", label: "Dashboard", to: "/dashboard" },
  { key: "browse", label: "Browse", to: "/store-directory" },
  { key: "offers", label: "Offers", to: "/promotions" },
  { key: "orders", label: "Orders", to: "/order-history" },
  { key: "track", label: "Tracking", to: "/order-tracking" },
  { key: "payments", label: "Payments", to: "/payment-history" },
  { key: "support", label: "Support", to: "/support-center" },
  { key: "profile", label: "Profile", to: "/profile" },
];