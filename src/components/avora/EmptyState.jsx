export default function EmptyState({ title, description, action }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#E4D9EE] bg-white/60 px-6 py-10 text-center">
      <p className="font-display text-[15px] font-bold text-[#1B1024]">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-[12.5px] leading-relaxed text-[#8B7A9C]">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}