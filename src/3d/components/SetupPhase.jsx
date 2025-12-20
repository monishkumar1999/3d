import React, { useState, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Environment, OrbitControls } from "@react-three/drei";
import { Upload, Box, MousePointer2, GripVertical, Check, Plus, LayoutGrid, AlertCircle } from "lucide-react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import DynamicModel from "./DynamicModel";
import useStore from "../../store/useStore";
import api from "../../api/axios";

// Helper Button (same style)
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

// Draggable Card Component
const MeshCard = ({ mesh, maskUrl, onUpload, onRemove, isPlaced }) => {
    return (
        <motion.div
            layoutId={mesh}
            className={`relative group bg-white border ${isPlaced ? 'border-indigo-100 shadow-lg' : 'border-zinc-200 shadow-sm hover:border-indigo-300'} rounded-2xl p-4 flex flex-col gap-3 transition-colors cursor-grab active:cursor-grabbing`}
            whileHover={{ y: -2 }}
            drag={!isPlaced}
            dragSnapToOrigin
            onDragEnd={(e, info) => {
                if (!isPlaced && info.offset.x > 100) {
                    // Trigger placement if dragged far enough right
                    // This is handled by parent usually, but for now we rely on click-to-move or drag-simulation visuals
                }
            }}
            onClick={() => !isPlaced && onRemove(mesh)} // Just clicking also moves it for accessibility/ease
        >
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${maskUrl ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                        {maskUrl ? <Check size={18} /> : <Box size={18} />}
                    </div>
                    <div>
                        <h4 className="font-bold text-zinc-800 text-sm truncate max-w-[120px]" title={mesh}>{mesh}</h4>
                        <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">{isPlaced ? "Placed" : "Available"}</span>
                    </div>
                </div>
                {isPlaced && (
                    <button onClick={(e) => { e.stopPropagation(); onRemove(mesh); }} className="text-zinc-300 hover:text-red-500 transition-colors">
                        <Plus size={18} className="rotate-45" />
                    </button>
                )}
            </div>

            {isPlaced && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="pt-2 border-t border-zinc-50">
                    {maskUrl ? (
                        <div className="relative w-full h-24 bg-zinc-100 rounded-lg overflow-hidden border border-zinc-200 group-hover:border-indigo-200 transition-colors">
                            <img src={maskUrl} className="w-full h-full object-contain p-2 opacity-50" />
                            <label className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/5 transition-colors cursor-pointer text-xs font-bold text-transparent hover:text-zinc-600">
                                Change
                                <input type="file" accept="image/*" onChange={(e) => onUpload(mesh, e)} className="hidden" />
                            </label>
                        </div>
                    ) : (
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-zinc-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer text-zinc-400 hover:text-indigo-600">
                            <Upload size={20} className="mb-1" />
                            <span className="text-[10px] font-bold uppercase">Upload Pattern</span>
                            <input type="file" accept="image/*" onChange={(e) => onUpload(mesh, e)} className="hidden" />
                        </label>
                    )}
                </motion.div>
            )}

            {!isPlaced && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-white/80 backdrop-blur-sm rounded-2xl transition-opacity pointer-events-none">
                    <span className="text-indigo-600 font-bold text-sm">Add to Board +</span>
                </div>
            )}
        </motion.div>
    );
}

const SetupPhase = ({ glbUrl, meshList, meshConfig, globalMaterial, setGlbUrl, handleGlb, handleMaskUpload, setMeshList, onLaunch }) => {

    const [placedMeshes, setPlacedMeshes] = useState([]);
    const { productName, setProductName, subcategory, setSubcategory } = useStore();
    const [availableSubcategories, setAvailableSubcategories] = useState([]);
    const [loadingSubs, setLoadingSubs] = useState(false);

    // Fetch Subcategories
    useEffect(() => {
        const fetchSubcategories = async () => {
            setLoadingSubs(true);
            try {
                const response = await api.get('/admin-subcategory');
                // Handle potentially different response structures
                const categories = response.data.categories || response.data || [];
                setAvailableSubcategories(Array.isArray(categories) ? categories : []);
            } catch (error) {
                console.error("Failed to fetch subcategories", error);
            } finally {
                setLoadingSubs(false);
            }
        };

        if (glbUrl) {
            fetchSubcategories();
        }
    }, [glbUrl]);

    // When meshes are detected, reset placement
    useEffect(() => {
        setPlacedMeshes([]);
    }, [meshList]);

    const handlePlace = (mesh) => {
        if (placedMeshes.includes(mesh)) return;
        setPlacedMeshes(prev => [...prev, mesh]);
    };

    const handleUnplace = (mesh) => {
        setPlacedMeshes(prev => prev.filter(m => m !== mesh));
    };

    const unplacedMeshes = meshList.filter(m => !placedMeshes.includes(m));
    const allPlacedWithConfig = placedMeshes.every(m => meshConfig[m]?.maskUrl); // Check if all placed items have uploads

    return (
        <LayoutGroup>
            <div className="w-full h-full flex bg-[#f8f9fc] text-zinc-900 font-sans overflow-hidden">

                {/* LEFT SIDEBAR: PARTS LIBRARY */}
                <div className="w-80 bg-white border-r border-zinc-200 z-20 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
                    <div className="p-6 border-b border-zinc-100">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2">
                            Step 1
                        </div>
                        <h2 className="text-2xl font-black text-zinc-900">Arrange</h2>
                        <p className="text-zinc-400 text-xs mt-1">Drag detected mesh parts onto the board to configure them.</p>
                    </div>

                    {/* Dropzone for File if none */}
                    {!glbUrl ? (
                        <div className="p-6 flex-1 flex flex-col justify-center">
                            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-zinc-200 rounded-3xl hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group relative overflow-hidden text-center p-4">
                                <div className="w-12 h-12 bg-zinc-100 rounded-xl flex items-center justify-center mb-3 group-hover:scale-110 transition-transform text-zinc-400 group-hover:text-indigo-600">
                                    <Box size={24} />
                                </div>
                                <span className="font-bold text-zinc-700 text-sm">Upload GLB</span>
                                <span className="text-zinc-400 text-xs mt-1">Drop your 3D model specific file here</span>
                                <input type="file" accept=".glb" onChange={handleGlb} className="hidden" />
                            </label>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">

                            {/* Product Details Section */}
                            <div className="space-y-3 mb-6 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">Product Info</h3>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Product Name</label>
                                    <input
                                        type="text"
                                        value={productName}
                                        onChange={(e) => setProductName(e.target.value)}
                                        placeholder="e.g. Heavyweight Tee"
                                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-bold text-zinc-500 uppercase">Subcategory</label>
                                    <select
                                        value={subcategory}
                                        onChange={(e) => setSubcategory(e.target.value)}
                                        disabled={loadingSubs}
                                        className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none disabled:opacity-50"
                                    >
                                        <option value="">{loadingSubs ? "Loading..." : "Select Category..."}</option>
                                        {availableSubcategories.map(sub => (
                                            <option key={sub.id} value={sub.id}>{sub.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-2 mb-2">Available Parts ({unplacedMeshes.length})</h3>
                            <AnimatePresence>
                                {unplacedMeshes.map(mesh => (
                                    <MeshCard
                                        key={mesh}
                                        mesh={mesh}
                                        maskUrl={meshConfig[mesh]?.maskUrl}
                                        onRemove={() => handlePlace(mesh)} // Clicking adds to board
                                        isPlaced={false}
                                    />
                                ))}
                            </AnimatePresence>
                            {unplacedMeshes.length === 0 && (
                                <div className="py-10 text-center opacity-40 px-6">
                                    <Check size={32} className="mx-auto mb-2 text-emerald-500" />
                                    <p className="text-sm font-bold">All parts placed!</p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Footer Action */}
                    <div className="p-6 border-t border-zinc-100 bg-zinc-50/50">
                        <Button onClick={() => setGlbUrl(null)} variant="secondary" className="w-full text-xs py-3 h-auto">
                            Reset Project
                        </Button>
                    </div>
                </div>

                {/* MAIN CANVAS: LAYOUT BOARD */}
                <div className="flex-1 relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] bg-[length:32px_32px] overflow-hidden flex flex-col">

                    {/* Top Bar */}
                    <div className="h-20 px-8 flex items-center justify-between pointer-events-none">
                        {glbUrl && (
                            <div className="bg-white/90 backdrop-blur-md px-6 py-2 rounded-full shadow-sm border border-white/50 pointer-events-auto">
                                <h1 className="font-bold text-zinc-800 text-sm">Layout Mode <span className="text-zinc-300 mx-2">|</span> <span className="text-indigo-600">{placedMeshes.length} Active Parts</span></h1>
                            </div>
                        )}
                        <div className="pointer-events-auto">
                            <Button
                                onClick={onLaunch}
                                disabled={placedMeshes.length === 0 || !allPlacedWithConfig || !productName || !subcategory} // Require name and category
                                variant="primary"
                                className="shadow-xl"
                            >
                                Confirm & Start Design
                            </Button>
                        </div>
                    </div>

                    {/* Drop Area */}
                    <div className="flex-1 p-12 overflow-y-auto">
                        {glbUrl && (
                            <div className="min-h-full grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-8 content-start">
                                <AnimatePresence>
                                    {placedMeshes.map(mesh => (
                                        <MeshCard
                                            key={mesh}
                                            mesh={mesh}
                                            maskUrl={meshConfig[mesh]?.maskUrl}
                                            onUpload={handleMaskUpload}
                                            onRemove={handleUnplace}
                                            isPlaced={true}
                                        />
                                    ))}
                                </AnimatePresence>

                                {/* Ghost / Prompt */}
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

                    {/* 3D Preview (Mini) */}
                    {glbUrl && (
                        <div className="absolute bottom-6 right-6 w-64 h-64 bg-white rounded-3xl shadow-2xl border border-white overflow-hidden z-30">
                            <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
                                <ambientLight intensity={0.7} />
                                <Environment preset="studio" />
                                <DynamicModel
                                    url={glbUrl}
                                    meshTextures={{}}
                                    materialProps={globalMaterial}
                                    setMeshList={setMeshList}
                                />
                                <OrbitControls autoRotate autoRotateSpeed={2} enableZoom={false} />
                            </Canvas>
                            <div className="absolute top-3 left-3">
                                <span className="text-[10px] font-bold text-zinc-500 bg-white/90 px-2 py-1 rounded-md shadow-sm border border-zinc-100">
                                    Reference
                                </span>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </LayoutGroup>
    );
};

export default SetupPhase;
