import { memo } from "react";
import { Plus, Package } from "lucide-react";
import { useProductConfigStore } from "../../../store/useProductConfigStore";
import VersionButton from "../atoms/VersionButton";

const VersionSection = memo(({ sets, activeSetId }) => {
    const addPbrSet = useProductConfigStore((state) => state.addPbrSet);
    const selectPbrSet = useProductConfigStore((state) => state.selectPbrSet);

    return (
        <div className="space-y-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1.5">
                    <Package size={11} className="text-indigo-500" />
                    <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-500">Design Versions</span>
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
                    />
                ))}
            </div>
            <p className="text-[10px] font-medium text-zinc-400">
                Versions apply to the WHOLE GLB. Select a mesh above to manage its specific textures.
            </p>
        </div>
    );
});

VersionSection.displayName = "VersionSection";
export default VersionSection;
