import { memo } from "react";
import { Box, ChevronRight } from "lucide-react";
import { useProductConfigStore } from "../../../store/useProductConfigStore";

const MeshRow = memo(({ meshId, name, index, isSelected, hasPbr }) => {
    const selectMesh = useProductConfigStore((state) => state.selectMesh);

    return (
        <button
            type="button"
            onClick={() => selectMesh(meshId)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left border
                        transition-all duration-150
                        ${isSelected
                    ? "bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm"
                    : "border-transparent hover:border-zinc-200 hover:bg-zinc-50 text-zinc-600"}`}
        >
            <span
                className={`min-w-[24px] h-6 flex items-center justify-center rounded-md text-[9px] font-black flex-shrink-0
                             ${isSelected ? "bg-indigo-200 text-indigo-700" : "bg-zinc-100 text-zinc-500"}`}
            >
                {String(index + 1).padStart(2, "0")}
            </span>
            <Box size={11} className={`flex-shrink-0 ${isSelected ? "text-indigo-400" : "text-zinc-300"}`} />
            <span className={`flex-1 text-[12px] font-mono font-semibold truncate ${isSelected ? "text-indigo-900" : ""}`}>
                {name}
            </span>
            {hasPbr && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
            {isSelected && <ChevronRight size={12} className="text-indigo-400 flex-shrink-0" />}
        </button>
    );
});

MeshRow.displayName = "MeshRow";
export default MeshRow;
