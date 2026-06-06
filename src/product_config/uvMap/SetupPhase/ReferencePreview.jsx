import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import DynamicModel from "../DynamicModel/DynamicModel";
import Loader from "../DesignPhase/Loader";

export const ReferencePreview = ({ glbUrl, baseTextures, globalMaterial, setMeshList }) => {
    if (!glbUrl) return null;

    return (
        <div className="absolute bottom-6 right-6 w-64 h-64 bg-white rounded-3xl shadow-2xl border border-white overflow-hidden z-30">
            <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
                <ambientLight intensity={0.7} />
                <Environment preset="studio" />
                <Suspense fallback={<Loader />}>
                    <DynamicModel
                        url={glbUrl}
                        meshTextures={{}}
                        baseTextures={baseTextures}
                        materialProps={globalMaterial}
                        setMeshList={setMeshList}
                    />
                </Suspense>
                <OrbitControls autoRotate autoRotateSpeed={2} enableZoom={false} />
            </Canvas>
            <div className="absolute top-3 left-3">
                <span className="text-[10px] font-bold text-zinc-500 bg-white/90 px-2 py-1 rounded-md shadow-sm border border-zinc-100">
                    Reference
                </span>
            </div>
        </div>
    );
};

export default ReferencePreview;
