import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { X, FolderHeart, RefreshCw, Layers, Sparkles, ExternalLink } from "lucide-react";
import api from "../../../api/axios";

export const SavedDesignsModal = ({ isOpen, onClose }) => {
    const navigate = useNavigate();
    const [designs, setDesigns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchSavedDesigns = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get("/product/saved-designs-list");
            if (res.data && res.data.designs) {
                setDesigns(res.data.designs);
            }
        } catch (err) {
            console.error("Failed to fetch saved designs list:", err);
            setError("Failed to load saved designs.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchSavedDesigns();
        }
    }, [isOpen]);

    const handleSelectDesign = (item) => {
        if (item.productId) {
            onClose();
            navigate(`/uvMap/${item.productId}?designId=${item.id}`);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl border border-zinc-100 w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                {/* Modal Header */}
                <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 bg-zinc-50/50">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
                            <FolderHeart size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-zinc-900 text-base">Saved Designs</h2>
                            <p className="text-xs text-zinc-500">Click a design below to open and edit in 3D studio</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={fetchSavedDesigns}
                            disabled={loading}
                            className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 rounded-xl transition-all"
                            title="Refresh List"
                        >
                            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-all"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Modal Body / List */}
                <div className="p-6 overflow-y-auto flex-1 space-y-3">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-3">
                            <RefreshCw size={24} className="animate-spin text-indigo-600" />
                            <span className="text-xs font-medium">Loading saved designs...</span>
                        </div>
                    ) : error ? (
                        <div className="text-center py-10 text-red-500 text-sm">
                            {error}
                        </div>
                    ) : designs.length === 0 ? (
                        <div className="text-center py-12 text-zinc-400 flex flex-col items-center gap-2">
                            <Sparkles size={28} className="text-zinc-300" />
                            <p className="text-sm font-semibold text-zinc-700">No Saved Designs Yet</p>
                            <p className="text-xs text-zinc-400">Save a custom design to see it listed here.</p>
                        </div>
                    ) : (
                        designs.map((item) => (
                            <div
                                key={item.id}
                                onClick={() => handleSelectDesign(item)}
                                className="flex items-center justify-between p-4 bg-zinc-50 hover:bg-indigo-50/50 border border-zinc-200/60 hover:border-indigo-200 rounded-2xl transition-all cursor-pointer group"
                            >
                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                                        <h3 className="font-bold text-zinc-900 text-sm group-hover:text-indigo-600 transition-colors">
                                            {item.designName}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                                        <Layers size={13} className="text-zinc-400" />
                                        <span>Model: <strong className="text-zinc-700 font-semibold">{item.modelName}</strong></span>
                                    </div>
                                </div>
                                <button className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-xl transition-all">
                                    <ExternalLink size={16} />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Modal Footer */}
                <div className="px-6 py-4 border-t border-zinc-100 bg-zinc-50/50 flex justify-between items-center text-xs text-zinc-400">
                    <span>Total Saved: <strong className="text-zinc-700">{designs.length}</strong></span>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white font-semibold rounded-xl text-xs transition-colors"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SavedDesignsModal;
