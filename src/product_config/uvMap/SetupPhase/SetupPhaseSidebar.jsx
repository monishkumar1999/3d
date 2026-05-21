import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { Box, Check } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { setProductName, setSubcategory } from "../../../store/redux/uvMapSlice";
import MeshCard from "./MeshCard";
import api from "../../../api/axios";

export const SetupPhaseSidebar = ({ glbUrl, handleGlb, unplacedMeshes, meshConfig, handlePlace, setGlbUrl }) => {
    const dispatch = useDispatch();
    const productName = useSelector(state => state.uvMap.productName);
    const subcategory = useSelector(state => state.uvMap.subcategory);

    const [availableSubcategories, setAvailableSubcategories] = useState([]);
    const [loadingSubs, setLoadingSubs] = useState(false);

    useEffect(() => {
        const fetchSubcategories = async () => {
            setLoadingSubs(true);
            try {
                const response = await api.get('/admin-subcategory');
                const categories = response.data.categories || response.data || [];
                setAvailableSubcategories(Array.isArray(categories) ? categories : []);
            } catch (error) {
                console.error("Failed to fetch subcategories", error);
            } finally {
                setLoadingSubs(false);
            }
        };

        if (glbUrl) fetchSubcategories();
    }, [glbUrl]);

    return (
        <div className="w-80 bg-white border-r border-zinc-200 z-20 flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
            <div className="p-6 border-b border-zinc-100">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2">Step 1</div>
                <h2 className="text-2xl font-black text-zinc-900">Arrange</h2>
                <p className="text-zinc-400 text-xs mt-1">Drag detected mesh parts onto the board to configure them.</p>
            </div>

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
                    <div className="space-y-3 mb-6 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-1">Products Info</h3>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Product Name</label>
                            <input
                                type="text" value={productName} onChange={(e) => dispatch(setProductName(e.target.value))}
                                placeholder="e.g. Heavyweight Tee"
                                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-500 uppercase">Subcategory</label>
                            <select
                                value={subcategory} onChange={(e) => dispatch(setSubcategory(e.target.value))} disabled={loadingSubs}
                                className="w-full px-3 py-2 bg-white border border-zinc-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500 transition-colors appearance-none disabled:opacity-50"
                            >
                                <option value="">{loadingSubs ? "Loading..." : "Select Category..."}</option>
                                {availableSubcategories.map(sub => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest pl-2 mb-2">Available Parts ({unplacedMeshes.length})</h3>
                    <AnimatePresence>
                        {unplacedMeshes.map(mesh => (
                            <MeshCard key={mesh} mesh={mesh} maskUrl={meshConfig[mesh]?.maskUrl} onRemove={() => handlePlace(mesh)} isPlaced={false} />
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

            <div className="p-6 border-t border-zinc-100 bg-zinc-50/50">
                <button onClick={() => setGlbUrl(null)} className="w-full text-xs py-3 h-auto flex items-center justify-center gap-2 px-6 rounded-xl font-semibold text-zinc-700 border border-zinc-200 bg-white hover:bg-zinc-50 transition-all active:scale-95">
                    Reset Project
                </button>
            </div>
        </div>
    );
};

export default SetupPhaseSidebar;
