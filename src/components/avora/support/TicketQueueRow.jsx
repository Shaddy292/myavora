import { Link } from "@tanstack/react-router";
import { ChevronRight, Flame, UserRound } from "lucide-react";
import { formatDateTime } from "@/lib/avora";
import { cn } from "@/lib/utils";

const PRIORITY_STYLE = {
  urgent: "bg-[#FDECEC] text-[#A11D1D]",
  high: "bg-[#FFF1E4] text-[#B05C00]",
  normal: "bg-[#F2EEF7] text-[#5B4A6B]"
};

/** One open support request in the support dashboard queue. */
export default function TicketQueueRow({ ticket }) {
  const priority = ticket.priority ?? "normal";
  return (
    <li>
      <Link
        to="/support-tickets"
        className="flex flex-wrap items-center gap-3 px-4 py-3 transition hover:bg-[#FBF8F3]"
      >
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[13px] font-bold text-[#1B1024]">
            {priority === "urgent" && <Flame className="h-3.5 w-3.5 text-[#A11D1D]" />}
            {ticket.topic || "Support request"}
          </p>
          <p className="truncate text-[11.5px] text-[#8B7A9C]">
            {ticket.customer_email}
            {ticket.order_code ? ` · ${ticket.order_code}` : ""}
          </p>
          <p className="flex items-center gap-1 text-[11px] text-[#A797B4]">
            {ticket.assigned_to ? (
              <>
                <UserRound className="h-3 w-3" /> {ticket.assigned_to}
              </>
            ) : (
              "Unassigned"
            )}
            {" · "}
            {formatDateTime(ticket.created_date)}
          </p>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em]",
            PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.normal
          )}
        >
          {priority}
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-[#C9BCD7]" />
      </Link>
    </li>
  );
}
