import { memo } from "react";
import { Layers, Hash } from "lucide-react";
import { useProductConfigStore } from "../../../store/useProductConfigStore";
import { hasMeshSetData } from "../pbrUtils";
import MeshRow from "../atoms/MeshRow";

const MeshSection = memo(() => {
    const meshes = useProductConfigStore((state) => state.meshes);
    const selectedMeshId = useProductConfigStore((state) => state.selectedMeshId);
    const pbrSets = useProductConfigStore((state) => state.pbrSets);

    return (
        <div className="flex flex-col h-full bg-white">
            <div className="px-5 pt-4 pb-3 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                    <Layers size={12} className="text-indigo-600" />
                    <span className="text-[12px] font-black text-zinc-800 uppercase tracking-tight">Meshes</span>
                </div>
                {meshes.length > 0 && (
                    <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-100">
                        <Hash size={8} className="text-indigo-600" />
                        <span className="text-[9px] font-black text-indigo-700">{meshes.length}</span>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5 custom-scrollbar">
                {meshes.length === 0 ? (
                    <p className="text-[11px] text-zinc-400 text-center pt-8 font-medium">Upload a GLB to see meshes</p>
                ) : (
                    meshes.map((mesh, index) => (
                        <MeshRow
                            key={mesh.id}
                            meshId={mesh.id}
                            name={mesh.label}
                            index={index}
                            isSelected={selectedMeshId === mesh.id}
                            hasPbr={hasMeshSetData(pbrSets[mesh.id])}
                        />
                    ))
                )}
            </div>
        </div>
    );
});

MeshSection.displayName = "MeshSection";
export default MeshSection;
