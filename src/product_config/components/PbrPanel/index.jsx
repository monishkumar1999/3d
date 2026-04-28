import { memo, useCallback, useMemo } from "react";
import { Upload } from "lucide-react";
import { DEFAULT_PBR_SETTINGS, useProductConfigStore } from "../../store/useProductConfigStore";
import { getActiveSetState, hasSetData } from "./pbrUtils";

import MeshSection from "./sections/MeshSection";
import VersionSection from "./sections/VersionSection";
import TextureSection from "./sections/TextureSection";
import SettingsSection from "./sections/SettingsSection";

const PbrPanel = memo(() => {
    const meshes = useProductConfigStore((state) => state.meshes);
    const selectedMeshId = useProductConfigStore((state) => state.selectedMeshId);
    const pbrSets = useProductConfigStore((state) => state.pbrSets);
    const updatePbrSet = useProductConfigStore((state) => state.updatePbrSet);
    const applyMap = useProductConfigStore((state) => state.applyMap);
    const updatePbrSettings = useProductConfigStore((state) => state.updatePbrSettings);
    const getGlobalSetState = useProductConfigStore((state) => state.getGlobalSetState);

    const selectedMesh = useMemo(() => meshes.find(m => m.id === selectedMeshId) ?? null, [meshes, selectedMeshId]);
    const selectedSetState = selectedMeshId ? pbrSets[selectedMeshId] : null;
    const globalSetState = useMemo(() => getGlobalSetState(), [getGlobalSetState, pbrSets]);

    const { sets, activeSet, activeSetId } = useMemo(
        () => getActiveSetState(selectedMeshId ? selectedSetState : globalSetState),
        [selectedMeshId, selectedSetState, globalSetState]
    );

    const selectedSettings = useMemo(() => ({ ...DEFAULT_PBR_SETTINGS, ...(activeSet?.settings ?? {}) }), [activeSet]);
    const activeMaps = activeSet?.maps ?? {};
    const activeSetHasData = hasSetData(activeSet);

    const onUpload = useCallback((slot, files) => applyMap(selectedMeshId, activeSetId, slot, files), [activeSetId, applyMap, selectedMeshId]);
    const onClear = useCallback((slot) => applyMap(selectedMeshId, activeSetId, slot, null), [activeSetId, applyMap, selectedMeshId]);
    const onSettingChange = useCallback((patch) => updatePbrSettings(selectedMeshId, activeSetId, patch), [activeSetId, selectedMeshId, updatePbrSettings]);
    const onSetNameChange = useCallback((name) => updatePbrSet(selectedMeshId, activeSetId, { name }), [activeSetId, selectedMeshId, updatePbrSet]);

    return (
        <aside className="w-[340px] flex-shrink-0 flex flex-col bg-white border-l border-zinc-200">
            <MeshSection />

            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-5 pt-4 pb-3 border-b border-zinc-100 flex items-center justify-between flex-shrink-0">
                    <div>
                        <span className="text-[12px] font-black text-zinc-800 uppercase tracking-tight">Global Configurator</span>
                        <p className="text-[10px] text-indigo-600 mt-0.5 font-bold">
                            {selectedMesh ? `Editing: ${selectedMesh.label}` : "Design Versions Only"}
                        </p>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 custom-scrollbar">
                    {meshes.length === 0 ? (
                        <p className="text-[11px] text-zinc-400 text-center pt-8 font-medium">Upload a GLB to begin designing</p>
                    ) : (
                        <>
                            <VersionSection sets={sets} activeSetId={activeSetId} />

                            {!selectedMesh ? (
                                <div className="py-12 px-6 text-center border-2 border-dashed border-zinc-100 rounded-2xl">
                                    <Upload size={24} className="mx-auto text-zinc-200 mb-3" />
                                    <p className="text-[11px] font-medium text-zinc-400 leading-relaxed">
                                        Select a mesh from the list above to apply textures and adjust settings.
                                    </p>
                                </div>
                            ) : !activeSet ? (
                                <p className="text-[11px] text-zinc-400 text-center pt-8 font-medium">Initializing mesh state...</p>
                            ) : (
                                <>
                                    <TextureSection 
                                        selectedMeshId={selectedMeshId}
                                        activeSet={activeSet}
                                        activeSetId={activeSetId}
                                        activeMaps={activeMaps}
                                        activeSetHasData={activeSetHasData}
                                        sets={sets}
                                        onSetNameChange={onSetNameChange}
                                        onUpload={onUpload}
                                        onClear={onClear}
                                    />
                                    <SettingsSection selectedSettings={selectedSettings} onSettingChange={onSettingChange} />
                                </>
                            )}
                        </>
                    )}
                </div>
            </div>
        </aside>
    );
});

PbrPanel.displayName = "PbrPanel";
export default PbrPanel;
