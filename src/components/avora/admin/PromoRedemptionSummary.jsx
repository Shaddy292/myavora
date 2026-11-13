export default function PromoRedemptionSummary({ codes }) {
  const live = codes.filter((code) => code.is_active !== false).length;
  const redemptions = codes.reduce((total, code) => total + (code.used_count || 0), 0);
  const capped = codes.filter((code) => Number(code.usage_limit) > 0);
  const capacity = capped.reduce((total, code) => total + Number(code.usage_limit), 0);
  const cappedUsed = capped.reduce((total, code) => total + (code.used_count || 0), 0);
  const rate = capacity ? Math.round((cappedUsed / capacity) * 100) : 0;

  const tiles = [
    { label: "Codes", value: String(codes.length), hint: `${live} live now` },
    { label: "Redemptions", value: String(redemptions), hint: "Across all codes" },
    { label: "Redemption rate", value: `${rate}%`, hint: capacity ? `of ${capacity} capped uses` : "No usage caps set" },
    { label: "Sold out", value: String(codes.filter((code) => Number(code.usage_limit) > 0 && (code.used_count || 0) >= Number(code.usage_limit)).length), hint: "Hit their limit" },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div key={tile.label} className="rounded-2xl bg-white p-4 ring-1 ring-[#EFE7F6]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#9A8CA8]">{tile.label}</p>
          <p className="mt-1.5 font-display text-[22px] font-extrabold tracking-[-0.02em] text-[#1B1024]">{tile.value}</p>
          <p className="mt-0.5 text-[11.5px] text-[#9A8CA8]">{tile.hint}</p>
        </div>
      ))}
    </div>
  );
}