import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/auth-middleware";

// Where this signed-in person belongs: staff → their console, store owner → vendor,
// rider → rider portal, everyone else → the customer dashboard.
export const resolveLandingRoute = createServerFn({ method: "GET" })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const db = context.getDb().asServiceRole;
    const email = context.user.email;
    if (context.user.role === "admin") return { path: "/admin", role: "admin" };

    const [staff, stores, riders] = await Promise.all([
      db.entities.StaffMember.filter({ email, is_active: true }),
      db.entities.Store.filter({ owner_email: email }),
      db.entities.RiderProfile.filter({ user_email: email }),
    ]);

    const staffRole = staff[0]?.role;
    if (staffRole) return { path: staffRole === "support" ? "/support-tickets" : "/admin", role: staffRole };
    if (stores.length) return { path: "/vendor", role: "vendor" };
    if (riders.length) return { path: "/rider", role: "rider" };
    return { path: "/dashboard", role: "customer" };
  });