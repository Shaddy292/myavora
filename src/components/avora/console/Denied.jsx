import { ShieldAlert } from "lucide-react";

export default function Denied() {
  return (
    <div className="mx-auto max-w-md rounded-2xl bg-white p-8 text-center ring-1 ring-[#EFE7F6]">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDECEC] text-[#A11D1D]">
        <ShieldAlert className="h-6 w-6" />
      </span>
      <h2 className="font-display mt-3 text-[18px] font-bold text-[#1B1024]">Restricted area</h2>
      <p className="mt-1 text-[13px] leading-relaxed text-[#8B7A9C]">
        Your account doesn't have permission for this console. Ask an administrator to grant you the right role.
      </p>
    </div>
  );
}