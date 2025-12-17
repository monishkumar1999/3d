import React, { useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Center, ContactShadows } from "@react-three/drei";
import { Type, Palette, Upload, Download, Image as ImageIcon, ChevronLeft, X, Save } from "lucide-react";
import { useStore } from "../../store/useStore";

import DynamicModel from "./DynamicModel";
import PatternZone from "./PatternZone";

// Helper Button
const Button = ({ children, onClick, variant = "primary", className = "", disabled = false, icon: Icon }) => {
    const baseStyle = "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
    const variants = {
        primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40",
        secondary: "bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 shadow-sm",
    };
    return (
        <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
            {Icon && <Icon size={18} />}
            {children}
        </button>
    );
};

// Simple Loading Screen
import { Html, useProgress } from "@react-three/drei";

const Loader = () => {
    const { progress } = useProgress();
    return (
        <Html center>
            <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-indigo-600">{progress.toFixed(0)}%</p>
            </div>
        </Html>
    );
};

const DesignPhase = ({ glbUrl, meshConfig, meshTextures, globalMaterial, activeStickerUrl, setGlobalMaterial, setActiveStickerUrl, onBack, onUpdateTexture }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false); // Closed by default for "removed" feel
    const [selectedMesh, setSelectedMesh] = useState(null); // Highlighting Logic
    const [meshColors, setMeshColors] = useState({}); // Per-mesh coloring

    // Store
    const { materialSettings, setMaterialSetting, saveMaterialConfiguration } = useStore();

    // Bust cache once on mount to handle the empty file replacement
    const [hdrUrl] = useState(`/hdr/studio_soft.hdr?v=${Date.now()}`);


    return (
        <div className="flex w-full h-full relative bg-[#f8f9fc] overflow-hidden">

            {/* LEFT SIDEBAR: STRIP ONLY */}
            <div className="w-20 bg-white border-r border-zinc-200 flex flex-col items-center py-6 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200 mb-8">
                    P
                </div>

                <div className="flex flex-col gap-6 w-full px-2">
                    <TooltipButton icon={ImageIcon} label="Assets" onClick={() => setSidebarOpen(prev => !prev)} isActive={sidebarOpen} />
                    <TooltipButton icon={Type} label="Text" />
                    <TooltipButton icon={Palette} label="Color" />
                </div>

                <div className="mt-auto">
                    <button onClick={onBack} className="w-10 h-10 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 transition-colors">
                        <ChevronLeft size={20} />
                    </button>
                </div>
            </div>

            {/* FLOATING DRAWER (ASSETS) - Absolute position so it doesn't shift layout */}
            <div className={`w-80 bg-white/90 backdrop-blur-3xl border-r border-zinc-200/50 flex flex-col z-40 absolute left-20 top-0 bottom-0 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 mb-1">Assets Library</h2>
                        <p className="text-xs text-zinc-400">Manage your visuals & materials</p>
                    </div>
                    <button onClick={() => setSidebarOpen(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
                </div>
                <div className="p-6 flex-1 overflow-y-auto space-y-8">

                    <div className="space-y-4">
                        <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Uploads</label>
                        <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-zinc-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer group bg-zinc-50/50">
                            <Upload size={24} className="text-zinc-300 group-hover:text-indigo-500 mb-2 transition-colors" />
                            <span className="text-xs font-bold text-zinc-500 group-hover:text-indigo-600">Upload Image</span>
                            <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) setActiveStickerUrl(URL.createObjectURL(e.target.files[0])); }} className="hidden" />
                        </label>
                    </div>

                    {/* Selected Part Color Control */}
                    {selectedMesh && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-300">
                            <label className="text-xs font-bold text-indigo-500 uppercase tracking-widest block">
                                Selected: {selectedMesh}
                            </label>
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 shadow-sm space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-bold text-indigo-900">Pattern Color</span>
                                    <div className="flex gap-2 items-center">
                                        <input
                                            type="color"
                                            value={meshColors[selectedMesh] || globalMaterial.color || "#ffffff"}
                                            onChange={(e) => setMeshColors(prev => ({ ...prev, [selectedMesh]: e.target.value }))}
                                            className="w-8 h-8 rounded-full border border-indigo-200 cursor-pointer overflow-hidden p-0 shadow-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Studio Settings (Admin)</label>
                            <button onClick={saveMaterialConfiguration} className="text-indigo-600 hover:text-indigo-800 transition-colors" title="Save Preset">
                                <Save size={14} />
                            </button>
                        </div>
                        <div className="bg-white border border-zinc-200 rounded-xl p-4 shadow-sm space-y-5">

                            {/* Roughness */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-zinc-400">
                                    <span>Roughness</span>
                                    <span>{materialSettings.roughness}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={materialSettings.roughness}
                                    onChange={(e) => setMaterialSetting("roughness", Number(e.target.value))}
                                    className="w-full h-1 bg-zinc-200 rounded-lg appearance-none accent-indigo-600"
                                />
                            </div>

                            {/* Sheen */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-zinc-400">
                                    <span>Sheen (Velvet)</span>
                                    <span>{materialSettings.sheen}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={materialSettings.sheen}
                                    onChange={(e) => setMaterialSetting("sheen", Number(e.target.value))}
                                    className="w-full h-1 bg-zinc-200 rounded-lg appearance-none accent-indigo-600"
                                />
                            </div>

                            {/* Sheen Roughness */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-zinc-400">
                                    <span>Sheen Spread</span>
                                    <span>{materialSettings.sheenRoughness}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={materialSettings.sheenRoughness}
                                    onChange={(e) => setMaterialSetting("sheenRoughness", Number(e.target.value))}
                                    className="w-full h-1 bg-zinc-200 rounded-lg appearance-none accent-indigo-600"
                                />
                            </div>

                            {/* Metalness (Optional Admin Override) */}
                            <div className="space-y-1 pt-4 border-t border-zinc-100">
                                <div className="flex justify-between text-xs text-zinc-400">
                                    <span>Metalness</span>
                                    <span>{materialSettings.metalness}</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.01"
                                    value={materialSettings.metalness}
                                    onChange={(e) => setMaterialSetting("metalness", Number(e.target.value))}
                                    className="w-full h-1 bg-zinc-200 rounded-lg appearance-none accent-indigo-600"
                                />
                            </div>

                        </div>
                    </div>



                </div>
            </div>

            {/* CENTER: WORKSPACE - Always full width minus the 20 sidebar */}
            <div className="flex-1 bg-[#f8f9fc] relative overflow-hidden ml-0">
                {/* Top Bar */}
                <div className="absolute top-8 left-8 z-10 pointer-events-none">
                    <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-white/50 pointer-events-auto inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <h1 className="font-bold text-zinc-800 text-xs">Editor Live <span className="text-zinc-300 mx-2">|</span> <span className="text-indigo-600">Project 01</span></h1>
                    </div>
                </div>

                {/* Canvas Area - Added lots of padding right to avoid 3D card overlap */}
                <div className="w-full h-full overflow-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] bg-[length:32px_32px] p-12 pr-[480px]">
                    <div className="min-h-full flex flex-wrap gap-10 items-start justify-center content-start pb-20 pt-10">
                        {Object.entries(meshConfig).filter(([_, cfg]) => cfg.maskUrl).map(([meshName, cfg]) => (
                            <PatternZone
                                key={meshName}
                                meshName={meshName}
                                maskUrl={cfg.maskUrl}
                                stickerUrl={activeStickerUrl}
                                onUpdateTexture={onUpdateTexture}
                                bgColor={meshColors[meshName] || globalMaterial.color || "#ffffff"}
                                isSelected={selectedMesh === meshName}
                                onClick={() => setSelectedMesh(meshName)}
                            />
                        ))}
                        {Object.entries(meshConfig).filter(([_, cfg]) => cfg.maskUrl).length === 0 && (
                            <div className="text-center opacity-40 mt-20">
                                <h3 className="text-2xl font-bold text-zinc-800">No Active Patterns</h3>
                                <p>Go back to setup and assign SVG shapes to meshes.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* RIGHT: FLOATING 3D CARD - Fixed width, anchored right */}
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
                            dpr={[1, 1.5]}
                        >
                            <ambientLight intensity={0.3} />
                            <directionalLight
                                position={[5, 10, 5]}
                                intensity={0.8}
                                castShadow
                                shadow-mapSize={[1024, 1024]}
                            />
                            {/* HDR Environment - Cache busted once on mount */}
                            <Environment files={hdrUrl} background={false} />

                            {/* <Environment preset="city" /> */}

                            <React.Suspense fallback={<Loader />}>
                                <Center>
                                    <DynamicModel
                                        url={glbUrl}
                                        meshTextures={meshTextures}
                                        materialProps={globalMaterial}
                                        setMeshList={() => { }}
                                    />
                                </Center>
                                <ContactShadows
                                    position={[0, -1.1, 0]}
                                    opacity={0.45}
                                    scale={10}
                                    blur={2}
                                />
                            </React.Suspense>
                            <OrbitControls minDistance={2} maxDistance={8} enablePan={false} />
                        </Canvas>
                    </div>

                    {/* Bottom Action Bar */}
                    <div className="p-6 bg-white/60 backdrop-blur-md border-t border-white/50 flex flex-col gap-3">
                        <div className="flex gap-4">
                            <Button variant="secondary" className="flex-1 py-4 text-xs">
                                Share Mockup
                            </Button>
                            <Button variant="primary" icon={Download} className="flex-[2] py-4 shadow-xl shadow-indigo-500/20">
                                Export GLB
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Internal Tooltip Button
const TooltipButton = ({ icon: Icon, onClick, isActive }) => (
    <div className="group relative flex justify-center">
        <button onClick={onClick} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600'}`}>
            <Icon size={22} />
        </button>
    </div>
);

export default DesignPhase;
