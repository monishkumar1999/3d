import React from "react";
import { Upload, Box, Check, Plus } from "lucide-react";
import { motion } from "framer-motion";

export const MeshCard = ({ mesh, maskUrl, onUpload, onRemove, isPlaced }) => {
    return (
        <motion.div
            layoutId={mesh}
            className={`relative group bg-white border ${isPlaced ? 'border-indigo-100 shadow-lg' : 'border-zinc-200 shadow-sm hover:border-indigo-300'} rounded-2xl p-4 flex flex-col gap-3 transition-colors cursor-grab active:cursor-grabbing`}
            whileHover={{ y: -2 }}
            drag={!isPlaced}
            dragSnapToOrigin
            onClick={() => !isPlaced && onRemove(mesh)}
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
                            <img src={maskUrl} className="w-full h-full object-contain p-2 opacity-50" alt="" />
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
};

export default MeshCard;
