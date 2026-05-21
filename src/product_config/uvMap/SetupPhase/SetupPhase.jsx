import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { LayoutGrid, Check } from "lucide-react";
import { AnimatePresence, LayoutGroup } from "framer-motion";
import SetupPhaseSidebar from "./SetupPhaseSidebar";
import MeshCard from "./MeshCard";
import ReferencePreview from "./ReferencePreview";

export const SetupPhase = ({
    glbUrl, meshList, meshConfig, globalMaterial, setGlbUrl, handleGlb, handleMaskUpload, setMeshList, onLaunch, baseTextures, autoPlaceMeshes
}) => {
    const [placedMeshes, setPlacedMeshes] = useState([]);
    const productName = useSelector(state => state.uvMap.productName);
    const subcategory = useSelector(state => state.uvMap.subcategory);

    useEffect(() => {
        setPlacedMeshes([]);
    }, [meshList, autoPlaceMeshes]);

    const handlePlace = (mesh) => {
        if (placedMeshes.includes(mesh)) return;
        setPlacedMeshes(prev => [...prev, mesh]);
    };

    const handleUnplace = (mesh) => {
        setPlacedMeshes(prev => prev.filter(m => m !== mesh));
    };

    const unplacedMeshes = meshList.filter(m => !placedMeshes.includes(m));
    const allPlacedWithConfig = placedMeshes.every(m => meshConfig[m]?.maskUrl);

    return (
        <LayoutGroup>
            <div className="w-full h-full flex bg-[#f8f9fc] text-zinc-900 font-sans overflow-hidden">
                <SetupPhaseSidebar
                    glbUrl={glbUrl} handleGlb={handleGlb} unplacedMeshes={unplacedMeshes}
                    meshConfig={meshConfig} handlePlace={handlePlace} setGlbUrl={setGlbUrl}
                />

                <div className="flex-1 relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[length:32px_32px] overflow-hidden flex flex-col">
                    <div className="h-20 px-8 flex items-center justify-between pointer-events-none">
                        {glbUrl && (
                            <div className="bg-white/90 backdrop-blur-md px-6 py-2 rounded-full shadow-sm border border-white/50 pointer-events-auto">
                                <h1 className="font-bold text-zinc-800 text-sm">
                                    Layout Mode <span className="text-zinc-300 mx-2">|</span>
                                    <span className="text-indigo-600">{placedMeshes.length} Active Parts</span>
                                </h1>
                            </div>
                        )}
                    </div>

                    <div className="absolute bottom-[300px] right-8 z-40 pointer-events-auto">
                        <button
                            onClick={onLaunch}
                            disabled={placedMeshes.length === 0 || (!autoPlaceMeshes && (!allPlacedWithConfig || !productName || !subcategory))}
                            className="flex items-center justify-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-300 disabled:text-zinc-500 disabled:pointer-events-none text-white rounded-xl font-semibold text-base shadow-2xl transition-all active:scale-95"
                        >
                            Confirm & Start Design →
                        </button>
                    </div>

                    <div className="flex-1 p-12 overflow-y-auto">
                        {glbUrl && (
                            <div className="min-h-full grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-8 content-start">
                                <AnimatePresence>
                                    {placedMeshes.map(mesh => (
                                        <MeshCard key={mesh} mesh={mesh} maskUrl={meshConfig[mesh]?.maskUrl} onUpload={handleMaskUpload} onRemove={handleUnplace} isPlaced={true} />
                                    ))}
                                </AnimatePresence>

                                {placedMeshes.length === 0 && (
                                    <div className="col-span-full h-96 border-4 border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center text-zinc-300">
                                        <LayoutGrid size={64} className="mb-4 text-zinc-200" />
                                        <h3 className="text-2xl font-black text-zinc-200">Canvas Empty</h3>
                                        <p className="font-medium">Drag or click parts from the sidebar to arrange them here.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    <ReferencePreview glbUrl={glbUrl} baseTextures={baseTextures} globalMaterial={globalMaterial} setMeshList={setMeshList} />
                </div>
            </div>
        </LayoutGroup>
    );
};

export default SetupPhase;
