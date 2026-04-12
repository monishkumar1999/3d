/**
 * PbrUploadPanel.jsx
 * Right panel — reads everything from the store. Zero props needed.
 */
import { memo, useCallback } from "react";
import { Layers, Box, Hash, Upload, Trash2, Check, ChevronRight } from "lucide-react";
import { useProductConfigStore, PBR_SLOTS } from "../store/useProductConfigStore";

/* ── Mesh list row ───────────────────────────────────────────── */
const MeshListRow = memo(({ name, index, isSelected, hasPbr }) => {
    const selectMesh = useProductConfigStore(s => s.selectMesh);
    return (
        <button onClick={() => selectMesh(name)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-left border
                        transition-all duration-150
                        ${isSelected
                            ? "bg-indigo-50 border-indigo-200 text-indigo-900 shadow-sm"
                            : "border-transparent hover:border-zinc-200 hover:bg-zinc-50 text-zinc-600"}`}>
            <span className={`min-w-[24px] h-6 flex items-center justify-center rounded-md text-[9px] font-black flex-shrink-0
                             ${isSelected ? 'bg-indigo-200 text-indigo-700' : 'bg-zinc-100 text-zinc-500'}`}>
                {String(index + 1).padStart(2, "0")}
            </span>
            <Box size={11} className={`flex-shrink-0 ${isSelected ? 'text-indigo-400' : 'text-zinc-300'}`} />
            <span className={`flex-1 text-[12px] font-mono font-semibold truncate ${isSelected ? 'text-indigo-900' : ''}`}>{name}</span>
            {hasPbr && <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />}
            {isSelected && <ChevronRight size={12} className="text-indigo-400 flex-shrink-0" />}
        </button>
    );
});
MeshListRow.displayName = "MeshListRow";

/* ── Single PBR slot row ─────────────────────────────────────── */
const SlotRow = memo(({ slot, hasTexture, onUpload, onClear }) => (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all
                    ${hasTexture ? 'bg-emerald-50/30 border-emerald-100' : 'bg-zinc-50 border-zinc-100 hover:border-indigo-200'}`}>
        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${hasTexture ? "bg-emerald-500 ring-4 ring-emerald-500/20" : "bg-zinc-200"}`} />
        <span className={`flex-1 text-[11px] font-bold truncate ${hasTexture ? 'text-emerald-700' : 'text-zinc-500'}`}>{slot.label}</span>
        {hasTexture && (
            <button onClick={onClear} title="Remove"
                className="p-1 rounded-lg text-zinc-300 hover:text-red-500 hover:bg-red-50 transition-all">
                <Trash2 size={11} />
            </button>
        )}
        <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg cursor-pointer text-[10px]
                           font-black transition-all active:scale-95 shadow-sm border
                           ${hasTexture
                               ? "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600"
                               : "bg-white text-zinc-700 border-zinc-200 hover:bg-zinc-50 hover:border-zinc-300"}`}>
            {hasTexture ? <Check size={10} /> : <Upload size={10} />}
            {hasTexture ? "Loaded" : "Upload"}
            <input type="file" accept="image/*" className="hidden"
                onChange={e => onUpload(e.target.files[0])} />
        </label>
    </div>
));
SlotRow.displayName = "SlotRow";

/* ── Main panel ──────────────────────────────────────────────── */
const PbrUploadPanel = memo(() => {
    const meshNames    = useProductConfigStore(s => s.meshNames);
    const selectedMesh = useProductConfigStore(s => s.selectedMesh);
    const pbrMap       = useProductConfigStore(s => s.pbrMap);
    const applyMap     = useProductConfigStore(s => s.applyMap);
    const clearMeshPbr = useProductConfigStore(s => s.clearMeshPbr);

    const onUpload = useCallback((slot, file) => applyMap(selectedMesh, slot, file), [applyMap, selectedMesh]);
    const onClear  = useCallback((slot)       => applyMap(selectedMesh, slot, null), [applyMap, selectedMesh]);

    return (
        <aside className="w-[340px] flex-shrink-0 flex flex-col bg-white border-l border-zinc-200">

            {/* Top: Mesh list */}
            <div className="flex flex-col border-b border-zinc-200" style={{ height: "45%" }}>
                <div className="px-5 pt-4 pb-3 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Layers size={12} className="text-indigo-600" />
                        <span className="text-[12px] font-black text-zinc-800">Meshes</span>
                    </div>
                    {meshNames.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100">
                            <Hash size={8} className="text-indigo-600" />
                            <span className="text-[9px] font-black text-indigo-700">{meshNames.length}</span>
                        </div>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 custom-scrollbar">
                    {meshNames.length === 0
                        ? <p className="text-[11px] text-zinc-400 text-center pt-8 font-medium">Upload a GLB to see meshes</p>
                        : meshNames.map((name, i) => (
                            <MeshListRow key={name} name={name} index={i}
                                isSelected={selectedMesh === name}
                                hasPbr={!!(pbrMap[name] && Object.values(pbrMap[name]).some(Boolean))} />
                        ))
                    }
                </div>
            </div>

            {/* Bottom: PBR slots */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-5 pt-4 pb-3 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
                    <div>
                        <span className="text-[12px] font-black text-zinc-800">PBR Maps</span>
                        {selectedMesh && (
                            <p className="text-[10px] text-indigo-600 font-mono mt-0.5 truncate max-w-[200px] font-bold">
                                → {selectedMesh}
                            </p>
                        )}
                    </div>
                    {selectedMesh && pbrMap[selectedMesh] && (
                        <button onClick={() => clearMeshPbr(selectedMesh)}
                            className="text-[10px] text-red-500 hover:text-red-600 transition-colors font-bold">
                            Clear all
                        </button>
                    )}
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scrollbar">
                    {!selectedMesh
                        ? <p className="text-[11px] text-zinc-400 text-center pt-8 font-medium">Select a mesh to apply textures</p>
                        : PBR_SLOTS.map(slot => (
                            <SlotRow key={slot.key} slot={slot}
                                hasTexture={!!(pbrMap[selectedMesh]?.[slot.key])}
                                onUpload={file => onUpload(slot, file)}
                                onClear={() => onClear(slot)} />
                        ))
                    }
                </div>
            </div>
        </aside>
    );
});

PbrUploadPanel.displayName = "PbrUploadPanel";
export default PbrUploadPanel;
