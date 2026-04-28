import { memo } from "react";
import { X, Trash2 } from "lucide-react";
import { PBR_SLOTS, useProductConfigStore } from "../../../store/useProductConfigStore";
import SlotRow from "../atoms/SlotRow";

const TextureSection = memo(({ 
    selectedMeshId, 
    activeSet, 
    activeSetId, 
    activeMaps, 
    activeSetHasData, 
    sets,
    onSetNameChange,
    onUpload,
    onClear 
}) => {
    const clearPbrSet = useProductConfigStore((state) => state.clearPbrSet);
    const removePbrSet = useProductConfigStore((state) => state.removePbrSet);

    return (
        <>
            <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
                <label className="block min-w-0">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-zinc-500">Version name</span>
                    <input
                        type="text"
                        value={activeSet.name}
                        onChange={(e) => onSetNameChange(e.target.value)}
                        className="h-9 w-full rounded-lg border border-zinc-200 bg-white px-3 text-[11px] font-bold text-zinc-700 outline-none transition-colors focus:border-indigo-300"
                    />
                </label>

                {(activeSetHasData || sets.length > 1) && (
                    <div className="flex gap-2">
                        {activeSetHasData && (
                            <button
                                type="button"
                                onClick={() => clearPbrSet(selectedMeshId, activeSetId)}
                                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[10px] font-black text-zinc-500 hover:bg-zinc-50 transition-colors"
                            >
                                <X size={10} />
                                Clear maps
                            </button>
                        )}
                        {sets.length > 1 && (
                            <button
                                type="button"
                                onClick={() => removePbrSet(null, activeSetId)}
                                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-red-100 bg-white px-2 py-1.5 text-[10px] font-black text-red-500 hover:bg-red-50 transition-colors"
                            >
                                <Trash2 size={10} />
                                Delete version
                            </button>
                        )}
                    </div>
                )}
            </div>

            {PBR_SLOTS.map((slot) => (
                <SlotRow
                    key={slot.key}
                    slot={slot}
                    hasTexture={!!activeMaps[slot.key]}
                    onUpload={(files) => onUpload(slot, files)}
                    onClear={() => onClear(slot)}
                />
            ))}
        </>
    );
});

TextureSection.displayName = "TextureSection";
export default TextureSection;
