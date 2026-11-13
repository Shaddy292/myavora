import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";

/** One row of the category manager: order controls plus row actions. */
export default function CategoryRow({ category, index, total, onMove, onEdit, onDelete }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white p-3 ring-1 ring-[#EFE7F6]">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#F8F5FC] text-[18px]">
        {category.emoji || "🍽️"}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[13px] font-bold text-[#1B1024]">
          {category.name}
          {category.is_active === false && (
            <span className="rounded-full bg-[#F3ECF9] px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#8B7A9C]">
              Hidden
            </span>
          )}
        </p>
        <p className="truncate text-[11.5px] text-[#8B7A9C]">
          {category.description || "No description"} · position {index + 1}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={() => onMove(index, -1)}
          disabled={index === 0}
          aria-label={`Move ${category.name} up`}
          className="rounded-lg p-1.5 text-[#8B7A9C] transition hover:bg-[#F4EEFA] hover:text-[#2B0B4D] disabled:opacity-30"
        >
          <ArrowUp className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onMove(index, 1)}
          disabled={index === total - 1}
          aria-label={`Move ${category.name} down`}
          className="rounded-lg p-1.5 text-[#8B7A9C] transition hover:bg-[#F4EEFA] hover:text-[#2B0B4D] disabled:opacity-30"
        >
          <ArrowDown className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onEdit(category)}
          aria-label={`Edit ${category.name}`}
          className="rounded-lg p-1.5 text-[#8B7A9C] transition hover:bg-[#F4EEFA] hover:text-[#2B0B4D]"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(category)}
          aria-label={`Delete ${category.name}`}
          className="rounded-lg p-1.5 text-[#B5A7C2] transition hover:bg-[#FDECEC] hover:text-[#A11D1D]"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}