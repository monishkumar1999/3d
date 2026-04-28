/**
 * GlbMeshInspector.jsx — main orchestrator
 * All state lives in useProductConfigStore.
 * This component is pure layout + file input wiring.
 */
import { useRef, useCallback, useEffect, Suspense, useState } from "react";
import { useParams } from "react-router-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei";
import {
    Sparkles, CheckCircle, RotateCcw, Upload,
    Save, Loader2, AlertCircle, Tag,
} from "lucide-react";

import Loader         from "./components/Loader";
import GlbModelPbr    from "./components/GlbModelPbr";
import DropOverlay    from "./components/DropOverlay";
import PbrUploadPanel from "./components/PbrUploadPanel";
import { useProductConfigStore } from "./store/useProductConfigStore";

const CAMERA  = { position: [0, 0, 4.5], fov: 45 };
const GL_OPTS = { antialias: true, preserveDrawingBuffer: false };

export default function GlbMeshInspector() {
    const { productId: urlProductId } = useParams();

    // Product name — only used when there's no URL productId (first-time create)
    const [productName, setProductName] = useState("");

    // Store slices
    const glbUrl         = useProductConfigStore(s => s.glbUrl);
    const fileName       = useProductConfigStore(s => s.fileName);
    const loadGlb        = useProductConfigStore(s => s.loadGlb);
    const resetGlb       = useProductConfigStore(s => s.resetGlb);
    const saveConfig     = useProductConfigStore(s => s.saveConfig);
    const isSaving       = useProductConfigStore(s => s.isSaving);
    const saveError      = useProductConfigStore(s => s.saveError);
    const saveSuccess    = useProductConfigStore(s => s.saveSuccess);
    const createdProductId = useProductConfigStore(s => s.createdProductId);

    // After first-time create, subsequent saves reuse the returned product id
    const effectiveProductId = urlProductId || createdProductId || null;

    const handleSave = useCallback(() => {
        if (effectiveProductId) {
            // UPDATE — product already exists (either from URL or previous create)
            saveConfig({ productId: effectiveProductId });
        } else {
            // CREATE — first-time save, send product_name
            saveConfig({ productName });
        }
    }, [saveConfig, effectiveProductId, productName]);

    const fileInputRef  = useRef(null);

    useEffect(() => () => resetGlb(), [resetGlb]);

    const handleFile    = useCallback((file) => loadGlb(file), [loadGlb]);
    const onInputChange = useCallback((e)    => loadGlb(e.target.files[0]), [loadGlb]);

    // Save button disabled when: saving, OR glb not loaded, OR (no product bound AND name is empty)
    const saveDisabled =
        isSaving ||
        !glbUrl  ||
        (!effectiveProductId && !productName.trim());

    const saveTitle = !glbUrl
        ? "Load a GLB model first"
        : (!effectiveProductId && !productName.trim())
            ? "Enter a product name first"
            : "Save configuration";

    return (
        <div className="h-screen bg-[#f8f9fc] text-zinc-900 font-sans flex flex-col overflow-hidden">

            {/* ── HEADER ── */}
            <header className="flex items-center justify-between px-7 py-4 flex-shrink-0
                               border-b border-zinc-200 bg-white gap-3 flex-wrap">

                {/* Left — branding */}
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

                {/* Right — controls */}
                <div className="flex items-center gap-3 flex-wrap">

                    {/* ── Product name input (first-time create, no URL productId) ── */}
                    {!urlProductId && !createdProductId && (
                        <div className="flex items-center gap-2 px-3 h-9 rounded-xl
                                        border border-zinc-200 bg-white shadow-sm
                                        focus-within:border-indigo-400 focus-within:ring-2
                                        focus-within:ring-indigo-100 transition-all">
                            <Tag size={11} className="text-indigo-500 flex-shrink-0" />
                            <input
                                type="text"
                                placeholder="Product name…"
                                value={productName}
                                onChange={(e) => setProductName(e.target.value)}
                                className="bg-transparent text-[11px] font-bold text-zinc-700
                                           outline-none w-40 placeholder:text-zinc-300"
                            />
                        </div>
                    )}

                    {/* Badge shown after first create (product now exists) */}
                    {!urlProductId && createdProductId && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                        bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                            <CheckCircle size={11} />
                            Product created
                        </div>
                    )}

                    {/* Badge shown when productId came from URL */}
                    {urlProductId && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                        bg-indigo-50 border border-indigo-100 text-indigo-700 text-[11px] font-bold">
                            <Tag size={11} />
                            Product linked
                        </div>
                    )}

                    {/* File badge */}
                    {fileName && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full
                                        bg-white border border-zinc-200 text-xs shadow-sm">
                            <CheckCircle size={11} className="text-emerald-500 flex-shrink-0" />
                            <span className="font-mono text-zinc-600 truncate max-w-[180px]">{fileName}</span>
                            <button onClick={resetGlb} title="Remove model"
                                className="ml-1 text-zinc-300 hover:text-red-500 transition-colors flex-shrink-0">
                                <RotateCcw size={10} />
                            </button>
                        </div>
                    )}

                    {/* Status messages */}
                    {saveError && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                        bg-red-50 border border-red-200 text-red-600 text-[11px] font-bold">
                            <AlertCircle size={11} />
                            {saveError}
                        </div>
                    )}
                    {saveSuccess && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                                        bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                            <CheckCircle size={11} />
                            Saved successfully!
                        </div>
                    )}

                    {/* Save button */}
                    <button
                        onClick={handleSave}
                        disabled={saveDisabled}
                        title={saveTitle}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-black
                                   shadow-md transition-all active:scale-[0.97]
                                   disabled:opacity-50 disabled:cursor-not-allowed
                                   bg-gradient-to-r from-indigo-500 to-violet-600 text-white
                                   hover:from-indigo-600 hover:to-violet-700 shadow-indigo-200"
                    >
                        {isSaving
                            ? <><Loader2 size={13} className="animate-spin" /> Saving…</>
                            : <><Save size={13} /> Save{effectiveProductId ? "" : " & Create"}</>}
                    </button>
                </div>
            </header>

            {/* ── BODY ── */}
            <div className="flex flex-1 overflow-hidden min-h-0">

                {/* LEFT — 3-D Viewport */}
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
                                             text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50 transition-all
                                             font-bold shadow-sm">
                                <Upload size={11} /> Replace
                                <input type="file" accept=".glb" className="hidden" onChange={onInputChange} />
                            </label>
                        </div>
                    )}
                </div>

                {/* RIGHT — Mesh list + PBR uploader */}
                <PbrUploadPanel />
            </div>
        </div>
    );
}
