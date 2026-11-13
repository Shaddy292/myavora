import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import EmptyState from "@/components/avora/EmptyState";
import { formatNGN } from "@/lib/avora";

const COLORS = ["#4B2080", "#FF7A00", "#1F7A4C", "#1E4A9E", "#B05C00", "#8B7A9C"];

export default function RiderPayoutChart({ data }) {
  const months = data?.months ?? [];
  const series = data?.series ?? [];
  const hasPayouts = months.some((month) => month.total > 0);

  if (!series.length || !hasPayouts) {
    return (
      <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
        <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Courier spend by rider</h2>
        <div className="mt-3">
          <EmptyState
            title="No rider payouts yet"
            description="Monthly payouts per rider appear here as soon as delivered trips are settled."
          />
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-display text-[15px] font-bold text-[#1B1024]">Courier spend by rider</h2>
          <p className="text-[11.5px] text-[#9A8CA8]">
            Monthly rider payouts · last 6 months · {data.riderCount} rider{data.riderCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10.5px] uppercase tracking-[0.12em] text-[#A797B4]">Total</p>
          <p className="font-display text-[18px] font-extrabold text-[#2B0B4D]">{formatNGN(data.grandTotal)}</p>
        </div>
      </div>

      <div className="mt-3 h-[260px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={months} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1E9F7" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#9A8CA8" }} />
            <YAxis tick={{ fontSize: 10, fill: "#9A8CA8" }} />
            <Tooltip
              formatter={(value, name) => [formatNGN(value), name]}
              contentStyle={{ borderRadius: 12, border: "1px solid #EFE7F6", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            {series.map((item, index) => (
              <Bar
                key={item.key}
                dataKey={item.key}
                name={item.name}
                stackId="payouts"
                fill={COLORS[index % COLORS.length]}
                radius={index === series.length - 1 ? [5, 5, 0, 0] : 0}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[#8B7A9C]">
        {months.map((month) => (
          <span key={month.key}>
            {month.label}: <strong className="text-[#2B0B4D]">{formatNGN(month.total)}</strong>
          </span>
        ))}
      </div>
    </section>
  );
}