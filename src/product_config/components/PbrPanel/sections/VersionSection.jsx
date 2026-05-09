import { memo, useState, useRef, useEffect } from "react";
import { Plus, Package, Pencil, Check } from "lucide-react";
import { useProductConfigStore } from "../../../store/useProductConfigStore";
import VersionButton from "../atoms/VersionButton";
import { getSetName } from "../pbrUtils";

const VersionSection = memo(({ sets, activeSetId }) => {
    const addPbrSet = useProductConfigStore((state) => state.addPbrSet);
    const selectPbrSet = useProductConfigStore((state) => state.selectPbrSet);
    const updatePbrSet = useProductConfigStore((state) => state.updatePbrSet);

    // Inline rename state
    const [editingSetId, setEditingSetId] = useState(null);
    const [editName, setEditName] = useState("");
    const inputRef = useRef(null);

    // Focus the input when editing starts
    useEffect(() => {
        if (editingSetId && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingSetId]);

    const startRename = (pbrSet, index) => {
        setEditingSetId(pbrSet.id);
        setEditName(getSetName(pbrSet, index));
    };

    const commitRename = () => {
        if (editingSetId && editName.trim()) {
            updatePbrSet(null, editingSetId, { name: editName.trim() });
        }
        setEditingSetId(null);
        setEditName("");
    };

    const cancelRename = () => {
        setEditingSetId(null);
        setEditName("");
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") commitRename();
        if (e.key === "Escape") cancelRename();
    };

    // Find the active set's index for display
    const activeSet = sets.find(s => s.id === activeSetId);
    const activeIndex = sets.findIndex(s => s.id === activeSetId);

    return (
        <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                    <Package size={11} className="text-indigo-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Design Versions </span>
                </div>
                <button
                    type="button"
                    onClick={() => addPbrSet(null)}
                    className="flex items-center gap-1 rounded-lg border border-indigo-100 bg-white px-2 py-1 text-[10px] font-black text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                    <Plus size={10} />
                    Add version
                </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {sets.map((pbrSet, index) => (
                    <VersionButton
                        key={index}
                        pbrSet={pbrSet}
                        index={index}
                        isSelected={activeSetId === pbrSet.id}
                        onSelect={() => selectPbrSet(null, pbrSet.id)}
                        onDoubleClick={() => startRename(pbrSet, index)}
                    />
                ))}
            </div>

            {/* Inline rename for active version */}
            {activeSet && (
                <div className="flex items-center gap-2">
                    {editingSetId === activeSetId ? (
                        <div className="flex items-center gap-1.5 flex-1">
                            <input
                                ref={inputRef}
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={commitRename}
                                className="h-7 flex-1 rounded-lg border border-indigo-300 bg-white px-2.5 
                                           text-[11px] font-bold text-zinc-700 outline-none 
                                           ring-2 ring-indigo-100 transition-all"
                                placeholder="Version name…"
                            />
                            <button
                                type="button"
                                onMouseDown={(e) => { e.preventDefault(); commitRename(); }}
                                className="flex items-center justify-center w-7 h-7 rounded-lg 
                                           bg-indigo-500 text-white hover:bg-indigo-600 
                                           transition-colors active:scale-95"
                                title="Save name"
                            >
                                <Check size={12} />
                            </button>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => startRename(activeSet, activeIndex)}
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg 
                                       border border-zinc-200 bg-white text-[10px] font-bold 
                                       text-zinc-500 hover:text-indigo-600 hover:border-indigo-200 
                                       hover:bg-indigo-50 transition-all w-full"
                        >
                            <Pencil size={10} className="flex-shrink-0" />
                            <span className="truncate">{getSetName(activeSet, activeIndex)}</span>
                            <span className="text-zinc-300 ml-auto text-[9px]">click to rename</span>
                        </button>
                    )}
                </div>
            )}

            <p className="text-[10px] font-medium text-zinc-400">
                Versions apply to the WHOLE GLB. Select a mesh above to manage its specific textures.
            </p>
        </div>
    );
});

VersionSection.displayName = "VersionSection";
export default VersionSection;
