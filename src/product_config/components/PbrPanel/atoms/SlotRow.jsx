import { memo } from "react";
import { Trash2, Check, Upload } from "lucide-react";

const SlotRow = memo(({ slot, hasTexture, onUpload, onClear }) => (
    <div
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all
                    ${hasTexture ? "bg-emerald-50/30 border-emerald-100" : "bg-zinc-50 border-zinc-100 hover:border-indigo-200"}`}
    >
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasTexture ? "bg-emerald-500 ring-4 ring-emerald-500/20" : "bg-zinc-200"}`} />
        <span className={`flex-1 text-[11px] font-bold truncate ${hasTexture ? "text-emerald-700" : "text-zinc-500"}`}>{slot.label}</span>
        {hasTexture && (
            <button
                type="button"
                onClick={onClear}
                title="Remove"
                className="p-1 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all"
            >
                <Trash2 size={11} />
            </button>
        )}
        <label
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer text-[10px]
                           font-black transition-all active:scale-95 shadow-sm border
                           ${hasTexture
                    ? "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600"
                    : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300"}`}
        >
            {hasTexture ? <Check size={10} /> : <Upload size={10} />}
            {hasTexture ? "Loaded" : "Upload"}
            <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) onUpload(files);
                    e.target.value = "";
                }}
            />
        </label>
    </div>
));

SlotRow.displayName = "SlotRow";
export default SlotRow;
