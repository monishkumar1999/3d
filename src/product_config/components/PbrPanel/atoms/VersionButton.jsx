import { memo } from "react";
import { Package } from "lucide-react";
import { getSetName } from "../pbrUtils";

const VersionButton = memo(({ pbrSet, index, isSelected, onSelect }) => {
    const loadedCount = Object.values(pbrSet.maps ?? {}).filter(Boolean).length;

    return (
        <button
            type="button"
            onClick={onSelect}
            className={`min-w-0 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-black transition-all
                        ${isSelected
                    ? "border-indigo-200 bg-indigo-50 text-indigo-800 shadow-sm"
                    : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50"}`}
        >
            <Package size={11} className={isSelected ? "text-indigo-500" : "text-zinc-300"} />
            <span className="truncate max-w-[82px]">{getSetName(pbrSet, index)}</span>
            {loadedCount > 0 && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-black text-emerald-700">
                    {loadedCount}
                </span>
            )}
        </button>
    );
});

VersionButton.displayName = "VersionButton";
export default VersionButton;
