import React from "react";
import { X, Upload, Type, Save, Building2, Trees, Sunset } from "lucide-react";

export const AssetsLibrary = ({
    sidebarOpen, setSidebarOpen, setActiveStickerUrl, selectedMesh,
    meshMaterials, setMeshMaterials, envPreset, setEnvPreset,
    brightness, setBrightness, pbrTextures, setPbrTextures
}) => {
    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setActiveStickerUrl(URL.createObjectURL(file));
            e.target.value = "";
        }
    };

    const handlePbrChange = (key, e) => {
        const file = e.target.files[0];
        if (file) {
            setPbrTextures(prev => ({ ...prev, [key]: URL.createObjectURL(file) }));
        }
    };

    const envs = [
        { id: "studio", icon: Building2, label: "Studio" },
        { id: "city", icon: Building2, label: "City" },
        { id: "park", icon: Trees, label: "Park" },
        { id: "sunset", icon: Sunset, label: "Sunset" }
    ];

    return (
        <div className={`w-80 bg-white/90 backdrop-blur-3xl border-r border-zinc-200/50 flex flex-col z-40 absolute left-20 top-0 bottom-0 shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1.0)] ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-zinc-900 mb-1">Assets Library</h2>
                    <p className="text-xs text-zinc-400">Manage your visuals & materials</p>
                </div>
                <button onClick={() => setSidebarOpen(false)} className="text-zinc-400 hover:text-zinc-600"><X size={20} /></button>
            </div>
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
                <div className="space-y-3">
                    <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Uploads</label>
                    <div className="grid grid-cols-2 gap-3">
                        <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-zinc-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all cursor-pointer group bg-zinc-50/50">
                            <Upload size={20} className="text-zinc-300 group-hover:text-indigo-500 mb-1 transition-colors" />
                            <span className="text-[10px] font-bold text-zinc-500 group-hover:text-indigo-600">Image</span>
                            <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                        </label>
                        <button onClick={() => setActiveStickerUrl("__TEXT_NODE__")} className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-zinc-200 rounded-2xl hover:border-indigo-400 hover:bg-indigo-50/50 transition-all group bg-zinc-50/50">
                            <Type size={20} className="text-zinc-300 group-hover:text-indigo-500 mb-1 transition-colors" />
                            <span className="text-[10px] font-bold text-zinc-500 group-hover:text-indigo-600">Text</span>
                        </button>
                    </div>
                </div>

                {selectedMesh && (
                    <div className="space-y-2 animate-in fade-in slide-in-from-left-4 duration-300">
                        <label className="text-xs font-bold text-indigo-500 uppercase tracking-widest block">Selected: {selectedMesh}</label>
                        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 shadow-sm">
                            <div className="flex justify-between text-[10px] font-bold text-indigo-800 uppercase mb-1">
                                <span>Transmission (Glass)</span>
                                <span>{meshMaterials[selectedMesh]?.transmission ?? 0}</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.01" value={meshMaterials[selectedMesh]?.transmission ?? 0} onChange={(e) => setMeshMaterials(prev => ({ ...prev, [selectedMesh]: { ...prev[selectedMesh], transmission: Number(e.target.value) } }))} className="w-full h-1 bg-indigo-200 rounded-lg appearance-none accent-indigo-600" />

                            <div className="flex justify-between text-[10px] font-bold text-indigo-800 uppercase mb-1 mt-3">
                                <span>Opacity</span>
                                <span>{meshMaterials[selectedMesh]?.opacity ?? 1}</span>
                            </div>
                            <input type="range" min="0" max="1" step="0.01" value={meshMaterials[selectedMesh]?.opacity ?? 1} onChange={(e) => setMeshMaterials(prev => ({ ...prev, [selectedMesh]: { ...prev[selectedMesh], opacity: Number(e.target.value) } }))} className="w-full h-1 bg-indigo-200 rounded-lg appearance-none accent-indigo-600" />
                        </div>
                    </div>
                )}

                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">3D Material Engine</label>
                        <button onClick={() => alert("Preset Saved!")} className="text-indigo-600 hover:text-indigo-800 transition-colors" title="Save Preset"><Save size={14} /></button>
                    </div>
                    <div className="bg-white border border-zinc-200 rounded-2xl p-4 shadow-sm space-y-4">
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Environment</label>
                            <div className="grid grid-cols-4 gap-2">
                                {envs.map(env => (
                                    <button key={env.id} onClick={() => setEnvPreset(env.id)} className={`flex flex-col items-center justify-center p-2 rounded-xl border transition-all ${envPreset === env.id ? "bg-indigo-50 border-indigo-200 text-indigo-600 shadow-sm" : "border-zinc-100 text-zinc-400 hover:bg-zinc-50"}`}>
                                        <env.icon size={16} />
                                        <span className="text-[8px] mt-1 font-bold uppercase">{env.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px] font-bold text-zinc-400 uppercase">
                                <span>Exposure / Brightness</span>
                                <span className="text-indigo-600">{brightness.toFixed(1)}x</span>
                            </div>
                            <input type="range" min="0.1" max="2.5" step="0.1" value={brightness} onChange={(e) => setBrightness(Number(e.target.value))} className="w-full h-1 bg-zinc-100 rounded-lg appearance-none accent-indigo-600" />
                        </div>
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">PBR Surface Maps</label>
                    <div className="grid grid-cols-2 gap-3">
                        {[{ key: "normal", label: "Normal" }, { key: "metalness", label: "Metal" }, { key: "ao", label: "AO" }].map(map => (
                            <label key={map.key} className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-zinc-100 rounded-2xl bg-zinc-50/50 hover:bg-indigo-50 hover:border-indigo-200 transition-all cursor-pointer group">
                                <Upload size={14} className="text-zinc-300 group-hover:text-indigo-500 mb-1" />
                                <span className="text-[9px] font-bold text-zinc-500 group-hover:text-indigo-600 uppercase tracking-tighter">{map.label}</span>
                                <input type="file" className="hidden" accept="image/*" onChange={(e) => handlePbrChange(map.key, e)} />
                                {pbrTextures[map.key] && <div className="w-1.5 h-1.5 rounded-full bg-green-500 mt-1" />}
                            </label>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetsLibrary;
