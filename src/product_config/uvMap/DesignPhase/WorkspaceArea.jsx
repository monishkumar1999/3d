import React from "react";
import { Scan } from "lucide-react";
import PatternZone from "../PatternZone/PatternZone";

export const WorkspaceArea = ({
    productName, showWireframe, setShowWireframe, meshConfig,
    activeStickerUrl, onUpdateTexture, setActiveStickerUrl,
    meshColors, globalMaterial, selectedMesh, setSelectedMesh
}) => {
    const activeMeshes = Object.entries(meshConfig).filter(([_, cfg]) => cfg.maskUrl);

    return (
        <div className="flex-1 bg-[#f8f9fc] relative overflow-hidden ml-0 h-full">
            {/* Top Bar */}
            <div className="absolute top-8 left-8 z-10 pointer-events-none flex flex-col gap-3">
                <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-white/50 pointer-events-auto inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                    <h1 className="font-bold text-zinc-800 text-xs">
                        Editor Live <span className="text-zinc-300 mx-2">|</span> 
                        <span className="text-indigo-600">{productName || "Untitled Project"}</span>
                    </h1>
                </div>

                {/* View Controls */}
                <div className="flex gap-2 pointer-events-auto">
                    <button
                        onClick={() => setShowWireframe(!showWireframe)}
                        className={`p-2 rounded-xl border transition-all ${showWireframe ? "bg-indigo-600 text-white border-indigo-500" : "bg-white text-zinc-400 border-zinc-200 hover:bg-zinc-50"}`}
                        title="Toggle UV Wireframe"
                    >
                        <Scan size={16} />
                    </button>
                </div>
            </div>

            {/* Canvas Area */}
            <div className="w-full h-full overflow-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] bg-[length:32px_32px] p-12 pr-[480px]">
                <div className="min-h-full flex flex-wrap gap-10 items-start justify-center content-start pb-20 pt-10">
                    {activeMeshes.map(([meshName, cfg]) => (
                        <PatternZone
                            key={meshName}
                            meshName={meshName}
                            maskUrl={cfg.maskUrl}
                            stickerUrl={activeStickerUrl}
                            onUpdateTexture={onUpdateTexture}
                            onStickerAdded={() => setActiveStickerUrl(null)}
                            bgColor={meshColors[meshName] || globalMaterial.color || "#ffffff"}
                            isSelected={selectedMesh === meshName}
                            onClick={() => setSelectedMesh(meshName)}
                        />
                    ))}
                    {activeMeshes.length === 0 && (
                        <div className="text-center opacity-40 mt-20">
                            <h3 className="text-2xl font-bold text-zinc-800">No Active Patterns</h3>
                            <p>Go back to setup and assign SVG shapes to meshes.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WorkspaceArea;
