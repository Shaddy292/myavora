import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import ConsoleShell from "@/components/avora/console/ConsoleShell";
import RiderApply from "@/components/avora/console/RiderApply";
import EmptyState from "@/components/avora/EmptyState";
import { RIDER_NAV } from "@/lib/console-nav";
import { getConsoleContext } from "@/lib/avora-fns";
import { addRiderShift, removeRiderShift, riderShifts } from "@/lib/insight-fns";
import { cn } from "@/lib/utils";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authed/rider-schedule")({
  loader: async () => {
    const context = await getConsoleContext();
    const data = context.rider ? await riderShifts() : { shifts: [], rider: null };
    return { context, ...data };
  },
  head: () => ({ meta: [{ title: "Rider schedule · AVORA" }] }),
  component: RiderSchedule,
});

const isoDay = (date) => date.toISOString().slice(0, 10);

function startOfWeek(offset) {
  const date = new Date();
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday + offset * 7);
  date.setHours(12, 0, 0, 0);
  return date;
}

function RiderSchedule() {
  const { context, shifts, rider } = Route.useLoaderData();
  const router = useRouter();
  const add = useServerFn(addRiderShift);
  const remove = useServerFn(removeRiderShift);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ date: isoDay(new Date()), start_time: "09:00", end_time: "13:00", zone: "", note: "" });

  const week = useMemo(() => {
    const start = startOfWeek(offset);
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      const key = isoDay(day);
      return {
        key,
        label: day.toLocaleDateString("en-GB", { weekday: "short" }),
        date: day.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        shifts: shifts.filter((shift) => shift.date === key),
      };
    });
  }, [offset, shifts]);

  const hours = shifts.reduce((total, shift) => {
    const [startH, startM] = shift.start_time.split(":").map(Number);
    const [endH, endM] = shift.end_time.split(":").map(Number);
    return total + Math.max(0, endH * 60 + endM - (startH * 60 + startM)) / 60;
  }, 0);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await add({ data: form });
      toast.success("Shift added to your week");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not add that shift");
    } finally {
      setBusy(false);
    }
  };

  const drop = async (id) => {
    try {
      await remove({ data: { id } });
      toast.success("Shift removed");
      await router.invalidate();
    } catch (error) {
      toast.error(error?.message || "Could not remove that shift");
    }
  };

  if (!rider) {
    return (
      <ConsoleShell nav={RIDER_NAV} active="schedule" badge="Rider console" title="Schedule" role={context.role}>
        <div className="mx-auto max-w-2xl">
          <RiderApply />
        </div>
      </ConsoleShell>
    );
  }

  return (
    <ConsoleShell
      nav={RIDER_NAV}
      active="schedule"
      badge="Rider console"
      title="Shift schedule"
      subtitle={`${shifts.length} shifts · ${Math.round(hours * 10) / 10} hours planned`}
      role={context.role}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOffset(offset - 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#5B4A6B] ring-1 ring-[#EDE5F4]"
          aria-label="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="font-display text-[14px] font-bold text-[#1B1024]">
          {week[0].date} — {week[6].date}
          {offset === 0 ? " · this week" : ""}
        </p>
        <button
          type="button"
          onClick={() => setOffset(offset + 1)}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#5B4A6B] ring-1 ring-[#EDE5F4]"
          aria-label="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {week.map((day) => (
          <div key={day.key} className={cn("rounded-2xl bg-white p-2.5 ring-1", day.key === isoDay(new Date()) ? "ring-2 ring-[#FF7A00]" : "ring-[#EDE5F4]")}>
            <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[#A797B4]">{day.label}</p>
            <p className="text-[12.5px] font-bold text-[#1B1024]">{day.date}</p>
            <div className="mt-1.5 space-y-1">
              {day.shifts.length === 0 ? (
                <p className="text-[11px] text-[#B8AAC6]">Free</p>
              ) : (
                day.shifts.map((shift) => (
                  <div key={shift.id} className="rounded-lg bg-[#F3ECFB] px-1.5 py-1 text-[11px] font-semibold text-[#3B0A66]">
                    {shift.start_time}–{shift.end_time}
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <form onSubmit={submit} className="h-fit rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display flex items-center gap-2 text-[15px] font-bold text-[#1B1024]">
            <CalendarDays className="h-4 w-4 text-[#4B2080]" /> Set availability
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className={LABEL}>Date</span>
              <input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={INPUT} />
            </label>
            <label className="block">
              <span className={LABEL}>Zone</span>
              <input value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} placeholder={rider.zone || "Yaba"} className={INPUT} />
            </label>
            <label className="block">
              <span className={LABEL}>Start</span>
              <input required type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} className={INPUT} />
            </label>
            <label className="block">
              <span className={LABEL}>End</span>
              <input required type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} className={INPUT} />
            </label>
            <label className="block sm:col-span-2">
              <span className={LABEL}>Note</span>
              <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optional — e.g. university run" className={INPUT} />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-[#FF7A00] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[#F06E00] disabled:opacity-60"
          >
            {busy ? "Adding…" : "Add shift block"}
          </button>
        </form>

        <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Upcoming shifts</h2>
          {shifts.length === 0 ? (
            <div className="mt-3">
              <EmptyState title="No shifts planned" description="Add your availability so dispatch knows when to send jobs." />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {shifts.map((shift) => (
                <li key={shift.id} className="flex items-center gap-3 rounded-xl bg-[#FBF8F3] px-3 py-2.5">
                  <Clock className="h-4 w-4 shrink-0 text-[#A797B4]" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-semibold text-[#1B1024]">
                      {shift.date} · {shift.start_time}–{shift.end_time}
                    </p>
                    <p className="text-[11px] text-[#9A8CA8]">
                      {shift.zone || "No zone set"}
                      {shift.note ? ` · ${shift.note}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => drop(shift.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-[#A797B4] ring-1 ring-[#EDE5F4] transition hover:text-[#A11D1D]"
                    aria-label="Remove shift"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </ConsoleShell>
  );
}

const LABEL = "text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8B7A9C]";
const INPUT =
  "mt-1 w-full rounded-xl border border-[#E4D9EE] bg-[#FBF8F3] px-3 py-2.5 text-[13px] text-[#1B1024] outline-none focus:border-[#4B2080]";