/**
 * GlbMeshInspector.jsx — main orchestrator
 * All state lives in useProductConfigStore.
 * This component is pure layout + file input wiring.
 */
import { useRef, useCallback, useEffect, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import { Sparkles, CheckCircle, RotateCcw, Upload } from "lucide-react";

import Loader         from "./components/Loader";
import GlbModelPbr    from "./components/GlbModelPbr";
import DropOverlay    from "./components/DropOverlay";
import PbrUploadPanel from "./components/PbrUploadPanel";
import { useProductConfigStore } from "./store/useProductConfigStore";

const CAMERA  = { position: [0, 0, 4.5], fov: 45 };
const GL_OPTS = { antialias: true, preserveDrawingBuffer: false };

export default function GlbMeshInspector() {
    // Only subscribe to the slices this component actually uses
    const glbUrl   = useProductConfigStore(s => s.glbUrl);
    const fileName = useProductConfigStore(s => s.fileName);
    const loadGlb  = useProductConfigStore(s => s.loadGlb);
    const resetGlb = useProductConfigStore(s => s.resetGlb);

    const fileInputRef = useRef(null);

    // Revoke blob URL on page-level unmount (store handles it internally too,
    // but this covers hot-reload / route unmount edge cases)
    useEffect(() => () => resetGlb(), [resetGlb]);

    const handleFile    = useCallback((file) => loadGlb(file), [loadGlb]);
    const onInputChange = useCallback((e)    => loadGlb(e.target.files[0]), [loadGlb]);

    return (
        <div className="h-screen bg-[#f8f9fc] text-zinc-900 font-sans flex flex-col overflow-hidden">

            {/* ── HEADER ── */}
            <header className="flex items-center justify-between px-7 py-4 flex-shrink-0
                               border-b border-zinc-200 bg-white">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600
                                    flex items-center justify-center shadow-lg shadow-indigo-100">
                        <Sparkles size={15} className="text-white" />
                    </div>
                    <div>
                        <h1 className="text-[13px] font-black tracking-wide leading-none text-zinc-800">
                            Product Configurator
                        </h1>
                        <p className="text-[9px] text-zinc-400 tracking-[0.15em] uppercase mt-0.5 font-bold">
                            GLB · Mesh Inspector · PBR Studio
                        </p>
                    </div>
                </div>

                {fileName && (
                    <div className="flex items-center gap-2 px-4 py-2 rounded-full
                                    bg-white border border-zinc-200 text-xs shadow-sm">
                        <CheckCircle size={11} className="text-emerald-500 flex-shrink-0" />
                        <span className="font-mono text-zinc-600 truncate max-w-[220px]">{fileName}</span>
                        <button onClick={resetGlb} title="Remove"
                            className="ml-1 text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0">
                            <RotateCcw size={10} />
                        </button>
                    </div>
                )}
            </header>

            {/* ── BODY ── */}
            <div className="flex flex-1 overflow-hidden min-h-0">

                {/* LEFT — 3-D Viewport (Canvas always mounted) */}
                <div className="flex-1 relative min-w-0">
                    <Canvas camera={CAMERA} gl={GL_OPTS} dpr={[1, 1.5]}
                            style={{ width: "100%", height: "100%" }}
                            frameloop={glbUrl ? "always" : "demand"}>
                        <ambientLight intensity={0.4} />
                        <directionalLight position={[5, 10, 5]} intensity={0.9} castShadow
                            shadow-mapSize={[1024, 1024]} />
                        <Environment preset="city" background={false} />
                        <Suspense fallback={<Loader />}>
                            {glbUrl && <GlbModelPbr url={glbUrl} />}
                            {glbUrl && (
                                <ContactShadows position={[0, -1.2, 0]}
                                    opacity={0.35} scale={10} blur={2.5} far={4} />
                            )}
                        </Suspense>
                        <OrbitControls enablePan={false} minDistance={1.5} maxDistance={14}
                            autoRotate={!!glbUrl} autoRotateSpeed={0.5} makeDefault />
                    </Canvas>

                    {!glbUrl && <DropOverlay onFile={handleFile} fileInputRef={fileInputRef} />}

                    <input ref={fileInputRef} type="file" accept=".glb"
                        className="hidden" onChange={onInputChange} />

                    {glbUrl && (
                        <div className="absolute top-4 right-4 z-10">
                            <label className="flex items-center gap-1.5 px-3 py-2 rounded-xl cursor-pointer
                                             bg-white border border-zinc-200 text-[11px]
                                             text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-all font-bold shadow-sm">
                                <Upload size={11} /> Replace
                                <input type="file" accept=".glb" className="hidden" onChange={onInputChange} />
                            </label>
                        </div>
                    )}
                </div>

                {/* RIGHT — Mesh list + PBR uploader (reads store internally) */}
                <PbrUploadPanel />
            </div>
        </div>
    );
}
