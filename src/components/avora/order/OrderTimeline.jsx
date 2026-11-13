import { ORDER_STATUS } from "@/lib/avora";
import { formatDateTime } from "@/lib/avora";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["placed", "accepted", "preparing", "ready_for_pickup", "rider_assigned", "picked_up", "delivered"];

export default function OrderTimeline({ order }) {
  const events = order.timeline ?? [];
  const at = (status) => events.find((event) => event.status === status)?.at;
  const currentIndex = STEPS.indexOf(order.status);
  const stopped = ["cancelled", "failed"].includes(order.status);

  const steps = STEPS.map((status, index) => ({
    status,
    label: ORDER_STATUS[status]?.label ?? status,
    time: at(status),
    done: !stopped && currentIndex >= index,
  }));

  if (stopped) {
    steps.push({
      status: order.status,
      label: ORDER_STATUS[order.status]?.label ?? order.status,
      time: at(order.status) ?? order.updated_date,
      done: true,
      failed: true,
    });
  }

  return (
    <ol className="space-y-3">
      {steps.map((step) => (
        <li key={step.status} className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
              step.failed
                ? "bg-[#FDECEC] text-[#A11D1D]"
                : step.done
                  ? "bg-[#1F7A4C] text-white"
                  : "bg-[#F2EEF7] text-[#B5A7C2]"
            )}
          >
            {step.done && !step.failed ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : "•"}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "text-[13px] font-semibold",
                step.done ? "text-[#1B1024]" : "text-[#9A8CA8]"
              )}
            >
              {step.label}
            </p>
            <p className="text-[11.5px] text-[#9A8CA8]">
              {step.time ? formatDateTime(step.time) : step.done ? "In progress" : "Pending"}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}