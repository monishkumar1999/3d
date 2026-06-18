import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Center, ContactShadows } from "@react-three/drei";
import { Save } from "lucide-react";
import DynamicModel from "../DynamicModel/DynamicModel";
import Loader from "./Loader";

export const ThreeDCanvas = ({
    glbUrl, meshTextures, baseTextures, pbrTextures,
    meshMaterials, globalMaterial, brightness, envPreset,
    handleSaveClick, isSaving, selectedMesh
}) => {
    const materialProps = useMemo(() => ({
        ...globalMaterial,
        toneMappingExposure: brightness
    }), [globalMaterial, brightness]);

    return (
        <div className="absolute top-6 right-6 bottom-6 w-[450px] pointer-events-none flex flex-col justify-center z-40">
            <div className="bg-white/70 backdrop-blur-2xl border border-white/50 shadow-[0_30px_60px_rgba(0,0,0,0.1)] rounded-[2.5rem] overflow-hidden pointer-events-auto flex flex-col h-[700px] relative transition-all hover:shadow-[0_40px_80px_rgba(0,0,0,0.15)]">
                {/* 3D Header */}
                <div className="absolute top-6 left-6 z-10">
                    <span className="bg-white/80 backdrop-blur-xl px-3 py-1 rounded-lg text-[10px] font-black tracking-widest text-zinc-900 border border-white/50 shadow-sm uppercase">
                        Live Render
                    </span>
                </div>

                {/* Canvas */}
                <div className="flex-1 bg-gradient-to-br from-indigo-50/40 via-purple-50/20 to-white/50">
                    <Canvas
                        shadows
                        camera={{ position: [0, 0, 4.5], fov: 45 }}
                        gl={{
                            preserveDrawingBuffer: true,
                            antialias: true,
                            toneMapping: 3, // THREE.ACESFilmicToneMapping
                            toneMappingExposure: 1
                        }}
                        dpr={[1, 2]}
                    >
                        <ambientLight intensity={0.3} />
                        <directionalLight
                            position={[5, 10, 5]}
                            intensity={0.8}
                            castShadow
                            shadow-mapSize={[1024, 1024]}
                        />
                        <Environment preset={envPreset} background={false} />

                        <Suspense fallback={<Loader />}>
                            <Center>
                                <DynamicModel
                                    url={glbUrl}
                                    meshTextures={meshTextures}
                                    baseTextures={baseTextures}
                                    pbrTextures={pbrTextures}
                                    meshMaterials={meshMaterials}
                                    materialProps={materialProps}
                                    setMeshList={() => {}}
                                    selectedMesh={selectedMesh}
                                />
                            </Center>
                            <ContactShadows
                                position={[0, -1.1, 0]}
                                opacity={0.45}
                                scale={10}
                                blur={2}
                            />
                        </Suspense>
                        <OrbitControls minDistance={2} maxDistance={8} enablePan={false} />
                    </Canvas>
                </div>

                {/* Bottom Action Bar */}
                <div className="p-6 bg-white/60 backdrop-blur-md border-t border-white/50 flex flex-col gap-3">
                    <button
                        onClick={handleSaveClick}
                        disabled={isSaving}
                        className="flex items-center justify-center gap-2 w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:pointer-events-none text-white rounded-xl font-semibold text-sm transition-all active:scale-95 shadow-xl shadow-indigo-500/20"
                    >
                        {!isSaving && <Save size={18} />}
                        {isSaving ? "Saving..." : "Save Product"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ThreeDCanvas;
