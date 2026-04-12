import React, { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Center } from "@react-three/drei";
import { ChevronRight, LayoutGrid, ChevronLeft } from "lucide-react";
import UnifiedPatternBoard from "./UnifiedPatternBoard";
import DynamicModel from "./DynamicModel";
import useStore from "../../store/useStore";

const LayoutPhase = () => {
    const setPhase = useStore(s => s.setPhase);
    const meshConfig = useStore(s => s.meshConfig);

    const activeMeshCount = Object.keys(meshConfig).filter(k => meshConfig[k].maskUrl).length;

    return (
        <div className="w-full h-full flex bg-[#f8f9fc]">
            {/* Sidebar / Instructions */}
            <div className="w-80 bg-white border-r border-zinc-200 z-20 flex flex-col shadow-xl">
                <div className="p-6 border-b border-zinc-100">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2">
                        Step 2
                    </div>
                    <h2 className="text-2xl font-black text-zinc-900">Configure Layout</h2>
                    <p className="text-zinc-400 text-xs mt-1">
                        Arrange the visible pattern parts on the canvas to create your texture atlas.
                        <br /><br />
                        <strong className="text-zinc-600">Why?</strong> This locks the UV positions so you can draw freely later without glitches.
                    </p>
                </div>

                <div className="p-6 flex-1 bg-zinc-50/50">
                    <div className="bg-white p-4 rounded-xl border border-zinc-200 shadow-sm">
                        <h4 className="font-bold text-sm text-zinc-800 mb-2">Instructions</h4>
                        <ul className="text-xs text-zinc-500 space-y-2 list-disc pl-4">
                            <li>Drag the visible pattern shapes to arrange them.</li>
                            <li>Ensure they don't overlap.</li>
                            <li>Resize logic is automatic for now.</li>
                            <li>When ready, click "Start Design".</li>
                        </ul>
                    </div>
                </div>

                <div className="p-6 border-t border-zinc-100 bg-white">
                    <div className="flex gap-2">
                        <button onClick={() => setPhase('setup')} className="w-12 h-12 rounded-xl border border-zinc-200 flex items-center justify-center text-zinc-400 hover:bg-zinc-50 transition-colors">
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() => setPhase('design')}
                            disabled={activeMeshCount === 0}
                            className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                        >
                            Start Designing <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Area: Layout Board */}
            <div className="flex-1 relative bg-[#1a1a1a]">
                <UnifiedPatternBoard mode="layout" />

                {/* Floating 3D Preview (Mini) */}
                <div className="absolute bottom-6 right-6 w-64 h-64 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl overflow-hidden shadow-2xl pointer-events-none">
                    <Canvas camera={{ position: [0, 0, 3.5] }}>
                        <ambientLight intensity={0.8} />
                        <Environment preset="city" />
                        <Center>
                            <DynamicModel />
                        </Center>
                        <OrbitControls autoRotate enableZoom={false} />
                    </Canvas>
                </div>
            </div>
        </div>
    );
};

export default LayoutPhase;
