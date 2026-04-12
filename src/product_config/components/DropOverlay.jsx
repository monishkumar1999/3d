import { memo, useState, useCallback } from "react";
import { FileBox, Upload } from "lucide-react";

const DropOverlay = memo(({ onFile, fileInputRef }) => {
    const [dragging, setDragging] = useState(false);

    const onDragOver  = useCallback((e) => { e.preventDefault(); setDragging(true);  }, []);
    const onDragLeave = useCallback(() => setDragging(false), []);
    const onDrop      = useCallback((e) => {
        e.preventDefault();
        setDragging(false);
        onFile(e.dataTransfer.files[0]);
    }, [onFile]);

    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`absolute inset-0 z-20 flex flex-col items-center justify-center
                        cursor-pointer select-none transition-all duration-300
                        ${dragging ? "bg-indigo-50/80 backdrop-blur-md"
                                   : "bg-white/90 backdrop-blur-md hover:bg-white/95"}`}
        >
            <div className={`relative w-28 h-28 rounded-full flex items-center justify-center mb-7
                             transition-transform duration-300 ${dragging ? "scale-110" : "scale-100"}`}>
                <div className={`absolute inset-0 rounded-full border-2 border-dashed transition-colors
                                 ${dragging ? "border-indigo-400" : "border-zinc-200"}`} />
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all
                                 ${dragging ? "bg-indigo-500/10" : "bg-zinc-50"}`}>
                    <FileBox size={30} className={dragging ? "text-indigo-500" : "text-zinc-300"} />
                </div>
            </div>

            <p className={`text-xl font-black mb-2 transition-colors
                           ${dragging ? "text-indigo-600" : "text-zinc-500"}`}>
                {dragging ? "Release to load" : "Drop a GLB file"}
            </p>
            <p className="text-[11px] text-zinc-400 mb-7 tracking-wide font-bold uppercase">Only .glb format</p>

            <button
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl
                           bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold
                           shadow-xl shadow-indigo-100 transition-all active:scale-95
                           border border-indigo-400/30"
            >
                <Upload size={14} /> Browse files
            </button>
        </div>
    );
});

DropOverlay.displayName = "DropOverlay";
export default DropOverlay;
