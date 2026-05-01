import React, { useState, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls, Center, ContactShadows } from "@react-three/drei";
import { Type, Palette, Upload, Download, Image as ImageIcon, ChevronLeft, X, Save, Camera, Eye, EyeOff, Settings, Sun, Cloud, Building2, Trees, Moon, Sunset, Layers, Sparkles, Scan } from "lucide-react";
import { useStore } from "../../store/useStore";

import DynamicModel from "./DynamicModel";
import PatternZone from "./PatternZone";
import api from "../../api/axios";
import { processWireframeToSolid } from "../utils/maskProcessor";

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

const TooltipButton = ({ icon: Icon, label, onClick, isActive }) => (
    <div className="relative group flex flex-col items-center">
        <button
            onClick={onClick}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'text-zinc-400 hover:bg-zinc-50 hover:text-indigo-600'}`}
        >
            <Icon size={22} />
        </button>
        <span className="absolute left-16 bg-zinc-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] uppercase tracking-widest shadow-xl">
            {label}
        </span>
    </div>
);

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

const DesignPhase = ({ glbUrl, meshConfig, meshTextures, baseTextures, globalMaterial, activeStickerUrl, setGlobalMaterial, setActiveStickerUrl, onBack, onUpdateTexture }) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [selectedMesh, setSelectedMesh] = useState(null);
    const [meshColors, setMeshColors] = useState({});

    // Material/Lighting State
    const [envPreset, setEnvPreset] = useState("studio");
    const [brightness, setBrightness] = useState(1);
    const [showWireframe, setShowWireframe] = useState(true);
    const [pbrTextures, setPbrTextures] = useState({
        normal: null,
        roughness: null,
        metalness: null,
        ao: null
    });

    // Store
    const { materialSettings, setMaterialSetting, saveMaterialConfiguration, productName, subcategory, setProductName, setSubcategory } = useStore();
    const [isSaving, setIsSaving] = useState(false);

    // Save Modal State
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    const [saveSnapshot, setSaveSnapshot] = useState(null);
    const [categories, setCategories] = useState([]);
    const [subCategories, setSubCategories] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [catRes, subRes] = await Promise.all([
                    api.get('/admin-category/view'),
                    api.get('/admin-subcategory')
                ]);
                setCategories(catRes.data.category || []);
                setSubCategories(subRes.data || []);
            } catch (err) {
                console.error("Failed to fetch categories", err);
            }
        };
        fetchData();
    }, []);

    // Bust cache once on mount to handle the empty file replacement
    const [hdrUrl] = useState(`/hdr/studio_soft.hdr?v=${Date.now()}`);

    const handleSaveClick = () => {
        // 1. Capture Screenshot
        try {
            const canvas = document.querySelector('canvas');
            if (canvas) {
                const dataUrl = canvas.toDataURL('image/png');
                setSaveSnapshot(dataUrl);
            }
        } catch (e) {
            console.error("Snapshot failed", e);
        }
        setIsSaveModalOpen(true);
    };

    const handleConfirmSave = async (formDataPayload) => {
        setIsSaving(true);
        try {
            const formData = new FormData();

            // Product Details
            formData.append('product_details[name]', formDataPayload.name);
            formData.append('product_details[category]', formDataPayload.categoryId);
            formData.append('product_details[subcategory]', formDataPayload.subcategoryId);
            formData.append('product_details[is_cloth]', formDataPayload.isCloth ? '1' : '0');

            // Update Store to reflect changes
            setProductName(formDataPayload.name);
            setSubcategory(formDataPayload.subcategoryId);

            // Image (Blob)
            if (formDataPayload.imageBlob) {
                formData.append('product_details[image]', formDataPayload.imageBlob, 'product_preview.png');
            }

            // 1. Fetch GLB Blob
            const glbRes = await fetch(glbUrl);
            const glbBlob = await glbRes.blob();
            formData.append('product_details[glb]', glbBlob, 'model.glb');

            // 2. Process Masks
            // Iterate over active masks and map them to indexed svgdetails
            let maskIndex = 0;
            const processingPromises = Object.entries(meshConfig)
                .filter(([_, cfg]) => cfg.maskUrl)
                .map(async ([meshName, cfg]) => {
                    try {
                        const currentIndex = maskIndex++; // Capture current index and increment

                        // Mesh Name
                        formData.append(`svgdetails[${currentIndex}][mesh_name]`, meshName);

                        // Processed White Mask
                        const solidDataUrl = await processWireframeToSolid(cfg.maskUrl);
                        const res = await fetch(solidDataUrl);
                        const blob = await res.blob();
                        formData.append(`svgdetails[${currentIndex}][white]`, blob, `${meshName}_white.png`);

                        // Original Wireframe
                        const origRes = await fetch(cfg.maskUrl);
                        const origBlob = await origRes.blob();
                        formData.append(`svgdetails[${currentIndex}][original]`, origBlob, `${meshName}_original.svg`);

                    } catch (err) {
                        console.error(`Failed to process mask for ${meshName}`, err);
                    }
                });

            await Promise.all(processingPromises);

            // 3. Send API Request
            await api.post('/product/create', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            alert('Product Saved Successfully!');
            setIsSaveModalOpen(false);

        } catch (error) {
            console.error("Save failed", error);
            alert("Failed to save product. Check console.");
        } finally {
            setIsSaving(false);
        }
    };


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
                        <div className="grid grid-cols-2 gap-3">
                            <label className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-zinc-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer group bg-zinc-50/50">
                                <Upload size={20} className="text-zinc-300 group-hover:text-indigo-500 mb-1 transition-colors" />
                                <span className="text-[10px] font-bold text-zinc-500 group-hover:text-indigo-600">Image</span>
                                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files[0]) setActiveStickerUrl(URL.createObjectURL(e.target.files[0])); }} className="hidden" />
                            </label>

                            <button 
                                onClick={() => setActiveStickerUrl('__TEXT_NODE__')}
                                className="flex flex-col items-center justify-center h-28 border-2 border-dashed border-zinc-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group bg-zinc-50/50"
                            >
                                <Type size={20} className="text-zinc-300 group-hover:text-indigo-500 mb-1 transition-colors" />
                                <span className="text-[10px] font-bold text-zinc-500 group-hover:text-indigo-600">Text</span>
                            </button>
                        </div>
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

                    {/* Advanced Material & PBR (Admin) */}
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">3D Material Engine</label>
                            <button onClick={saveMaterialConfiguration} className="text-indigo-600 hover:text-indigo-800 transition-colors" title="Save Preset">
                                <Save size={14} />
                            </button>
                        </div>
                        
                        <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm space-y-5">
                            {/* Environment Preset */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Environment</label>
                                <div className="grid grid-cols-4 gap-2">
                                    {[
                                        { id: 'studio', icon: Building2, label: 'Studio' },
                                        { id: 'city', icon: Building2, label: 'City' },
                                        { id: 'park', icon: Trees, label: 'Park' },
                                        { id: 'sunset', icon: Sunset, label: 'Sunset' },
                                    ].map(env => (
                                        <button
                                            key={env.id}
                                            onClick={() => setEnvPreset(env.id)}
                                            className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${envPreset === env.id ? 'bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm' : 'border-zinc-100 text-zinc-400 hover:bg-zinc-50'}`}
                                        >
                                            <env.icon size={16} />
                                            <span className="text-[8px] mt-1 font-bold uppercase">{env.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Brightness */}
                            <div className="space-y-1">
                                <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase">
                                    <span>Exposure / Brightness</span>
                                    <span className="text-indigo-600">{brightness.toFixed(1)}x</span>
                                </div>
                                <input
                                    type="range" min="0.1" max="2.5" step="0.1"
                                    value={brightness}
                                    onChange={(e) => setBrightness(Number(e.target.value))}
                                    className="w-full h-1 bg-zinc-100 rounded-lg appearance-none accent-indigo-600"
                                />
                            </div>

                            {/* Roughness */}
                            <div className="space-y-1 pt-4 border-t border-zinc-50">
                                <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase">
                                    <span>Roughness</span>
                                    <span>{materialSettings.roughness}</span>
                                </div>
                                <input
                                    type="range" min="0" max="1" step="0.01"
                                    value={materialSettings.roughness}
                                    onChange={(e) => setMaterialSetting("roughness", Number(e.target.value))}
                                    className="w-full h-1 bg-zinc-100 rounded-lg appearance-none accent-indigo-600"
                                />
                            </div>
                        </div>
                    </div>

                    {/* PBR Maps Section */}
                    <div className="space-y-4">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">PBR Surface Maps</label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { key: 'normal', label: 'Normal', hint: 'Detail' },
                                { key: 'roughness', label: 'Rough', hint: 'Gloss' },
                                { key: 'metalness', label: 'Metal', hint: 'Reflect' },
                                { key: 'ao', label: 'AO', hint: 'Shadow' },
                            ].map(map => (
                                <label key={map.key} className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-zinc-100 rounded-2xl bg-zinc-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer group">
                                    <Upload size={14} className="text-zinc-300 group-hover:text-indigo-500 mb-1" />
                                    <span className="text-[9px] font-bold text-zinc-500 group-hover:text-indigo-600 uppercase tracking-tighter">{map.label}</span>
                                    <input type="file" className="hidden" accept="image/*" onChange={(e) => {
                                        const file = e.target.files[0];
                                        if (file) setPbrTextures(prev => ({ ...prev, [map.key]: URL.createObjectURL(file) }));
                                    }} />
                                    {pbrTextures[map.key] && <div className="w-1 h-1 rounded-full bg-green-500 mt-1" />}
                                </label>
                            ))}
                        </div>
                    </div>



                </div>
            </div>

            {/* CENTER: WORKSPACE - Always full width minus the 20 sidebar */}
            <div className="flex-1 bg-[#f8f9fc] relative overflow-hidden ml-0">
                {/* Top Bar */}
                <div className="absolute top-8 left-8 z-10 pointer-events-none flex flex-col gap-3">
                    <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-white/50 pointer-events-auto inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                        <h1 className="font-bold text-zinc-800 text-xs">Editor Live <span className="text-zinc-300 mx-2">|</span> <span className="text-indigo-600">{productName || 'Untitled Project'}</span></h1>
                    </div>
                    
                    {/* View Controls */}
                    <div className="flex gap-2 pointer-events-auto">
                        <button 
                            onClick={() => setShowWireframe(!showWireframe)}
                            className={`p-2 rounded-xl border transition-all ${showWireframe ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-white text-zinc-400 border-zinc-200 hover:bg-zinc-50'}`}
                            title="Toggle UV Wireframe"
                        >
                            <Scan size={16} />
                        </button>
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
                                onStickerAdded={() => setActiveStickerUrl(null)}
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
                            {/* HDR Environment */}
                            <Environment preset={envPreset} background={false} />

                            {/* <Environment preset="city" /> */}

                            <React.Suspense fallback={<Loader />}>
                                <Center>
                                    <DynamicModel
                                        url={glbUrl}
                                        meshTextures={meshTextures}
                                        baseTextures={baseTextures}
                                        pbrTextures={pbrTextures}
                                        materialProps={{
                                            ...globalMaterial,
                                            toneMappingExposure: brightness
                                        }}
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
                            <Button
                                onClick={handleSaveClick}
                                disabled={isSaving}
                                variant="primary"
                                icon={isSaving ? undefined : Save}
                                className="w-full py-4 shadow-xl shadow-indigo-500/20"
                            >
                                {isSaving ? "Saving..." : "Save Product"}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
            {isSaveModalOpen && (
                <SaveProductModal
                    isOpen={isSaveModalOpen}
                    onClose={() => setIsSaveModalOpen(false)}
                    onConfirm={handleConfirmSave}
                    isSaving={isSaving}
                    initialName={productName}
                    initialSubcategoryId={subcategory}
                    snapshotUrl={saveSnapshot}
                    categories={categories}
                    subCategories={subCategories}
                />
            )}
        </div>
    );
};


const SaveProductModal = ({ isOpen, onClose, onConfirm, isSaving, initialName, initialSubcategoryId, snapshotUrl, categories, subCategories }) => {
    // Find initial category based on initial subcategory if possible
    const initialCatId = subCategories.find(s => s.id == initialSubcategoryId)?.categoryId || "";

    const [name, setName] = useState(initialName || "");
    const [categoryId, setCategoryId] = useState(initialCatId);
    const [subcategoryId, setSubcategoryId] = useState(initialSubcategoryId || "");
    const [isCloth, setIsCloth] = useState(false);
    const [imagePreview, setImagePreview] = useState(snapshotUrl);
    const [imageFile, setImageFile] = useState(null);

    // Update if props change
    useEffect(() => {
        if (isOpen) {
            setName(initialName || "");
            const derivedCatId = subCategories.find(s => s.id == initialSubcategoryId)?.categoryId || "";
            setCategoryId(derivedCatId);
            setSubcategoryId(initialSubcategoryId || "");
            setIsCloth(false);
            setImagePreview(snapshotUrl);
            setImageFile(null);
        }
    }, [isOpen, initialName, initialSubcategoryId, snapshotUrl, subCategories]);

    // Handle Image Upload
    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        let blob = imageFile;
        if (!blob && snapshotUrl && !imageFile) {
            try {
                const res = await fetch(snapshotUrl);
                blob = await res.blob();
            } catch (e) {
                console.error("Failed to convert snapshot to blob", e);
            }
        }

        onConfirm({
            name,
            categoryId,
            subcategoryId,
            isCloth,
            imageBlob: blob
        });
    };

    const filteredSubCategories = subCategories.filter(s => s.categoryId == categoryId);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h3 className="font-bold text-lg text-gray-800">Save Product</h3>
                    <button onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto space-y-5">
                    {/* Image Preview */}
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest">Product Image</label>
                        <div className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50 aspect-video flex items-center justify-center">
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                            ) : (
                                <div className="text-gray-300 flex flex-col items-center">
                                    <ImageIcon size={32} />
                                    <span className="text-xs mt-2">No Preview</span>
                                </div>
                            )}

                            <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                <div className="bg-white text-gray-800 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 shadow-lg">
                                    <Camera size={16} />
                                    Change Image
                                </div>
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                            </label>
                        </div>
                    </div>

                    {/* Name */}
                    <div className="space-y-1">
                        <label className="text-sm font-medium text-gray-700">Product Name</label>
                        <input
                            type="text"
                            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Summer Shirt Design"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Category */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Category</label>
                            <select
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all bg-white"
                                value={categoryId}
                                onChange={(e) => {
                                    setCategoryId(e.target.value);
                                    setSubcategoryId(""); // Reset sub when cat changes
                                }}
                            >
                                <option value="" disabled>Select Category</option>
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                                ))}
                            </select>
                        </div>

                        {/* Subcategory */}
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">Subcategory</label>
                            <select
                                className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-all bg-white"
                                value={subcategoryId}
                                onChange={(e) => setSubcategoryId(e.target.value)}
                                disabled={!categoryId}
                            >
                                <option value="" disabled>Select Subcategory</option>
                                {filteredSubCategories.map(sub => (
                                    <option key={sub.id} value={sub.id}>{sub.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Is Cloth Toggle */}
                    <div className="flex items-center justify-between p-3 border border-gray-200 rounded-xl bg-gray-50">
                        <span className="text-sm font-medium text-gray-700">Is this a Cloth?</span>
                        <button
                            onClick={() => setIsCloth(!isCloth)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${isCloth ? 'bg-indigo-600' : 'bg-gray-200'}`}
                        >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isCloth ? 'translate-x-6' : 'translate-x-1'}`} />
                        </button>
                    </div>
                </div>

                <div className="p-5 border-t border-gray-100 bg-gray-50/50 flex gap-3 justify-end">
                    <button
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-5 py-2.5 rounded-xl font-semibold text-gray-600 hover:bg-gray-200 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !name || !categoryId || !subcategoryId}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isSaving ? (
                            <>
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save size={18} />
                                Confirm Save
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DesignPhase;
