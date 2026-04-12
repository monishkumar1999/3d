import { memo, useState, useRef, useEffect, useCallback } from "react";
import { Box, Copy, Check } from "lucide-react";

const MeshRow = memo(({ name, index }) => {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef(null);

    useEffect(() => () => clearTimeout(timerRef.current), []);

    const handleCopy = useCallback(() => {
        navigator.clipboard.writeText(name).then(() => {
            setCopied(true);
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setCopied(false), 1800);
        });
    }, [name]);

    return (
        <div className="group flex items-center gap-3 px-4 py-2.5 rounded-xl
                        border border-transparent hover:border-violet-500/20
                        hover:bg-violet-500/8 transition-all duration-150 cursor-default">
            <span className="min-w-[26px] h-6 flex items-center justify-center rounded-md
                             bg-violet-500/15 text-violet-400 text-[9px] font-black flex-shrink-0">
                {String(index + 1).padStart(2, "0")}
            </span>
            <Box size={12} className="text-white/20 group-hover:text-violet-400/60
                                      transition-colors flex-shrink-0" />
            <span className="flex-1 text-[13px] font-mono font-semibold text-white/75
                             truncate group-hover:text-white transition-colors">
                {name}
            </span>
            <button
                onClick={handleCopy}
                title="Copy name"
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg
                           hover:bg-violet-500/20 text-white/30 hover:text-violet-300
                           transition-all flex-shrink-0"
            >
                {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
            </button>
        </div>
    );
});

MeshRow.displayName = "MeshRow";
export default MeshRow;
