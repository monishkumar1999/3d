import { memo, useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Layers, Search, X, Hash, Box, Copy, Check } from "lucide-react";
import MeshRow from "./MeshRow";

/* ── Copy-all button ── */
const CopyAllButton = memo(({ names }) => {
    const [copied, setCopied] = useState(false);
    const timerRef = useRef(null);
    useEffect(() => () => clearTimeout(timerRef.current), []);

    const handle = useCallback(() => {
        navigator.clipboard.writeText(names.join("\n")).then(() => {
            setCopied(true);
            clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => setCopied(false), 2000);
        });
    }, [names]);

    return (
        <button onClick={handle}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
                       bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20
                       hover:border-violet-500/40 text-violet-300 text-xs font-bold
                       transition-all active:scale-[0.98]">
            {copied
                ? <><Check size={12} className="text-green-400" />Copied!</>
                : <><Copy size={12} />Copy all names</>}
        </button>
    );
});
CopyAllButton.displayName = "CopyAllButton";

/* ── Panel ── */
const MeshPanel = memo(({ meshNames, hasFile }) => {
    const [query, setQuery] = useState("");
    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        return q ? meshNames.filter(n => n.toLowerCase().includes(q)) : meshNames;
    }, [meshNames, query]);

    const onClear = useCallback(() => setQuery(""), []);

    return (
        <aside className="w-[320px] flex-shrink-0 flex flex-col bg-white/[0.025] border-l border-white/[0.06]">
            {/* Header */}
            <div className="px-5 pt-5 pb-4 border-b border-white/[0.06] space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center">
                            <Layers size={12} className="text-violet-400" />
                        </div>
                        <span className="text-[13px] font-black text-white/90">Mesh Names</span>
                    </div>
                    {meshNames.length > 0 && (
                        <div className="flex items-center gap-1 px-2 py-1 rounded-full
                                        bg-violet-500/15 border border-violet-500/25">
                            <Hash size={9} className="text-violet-400" />
                            <span className="text-[10px] font-black text-violet-300">{meshNames.length}</span>
                        </div>
                    )}
                </div>

                {meshNames.length > 0 && (
                    <div className="relative">
                        <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25" />
                        <input value={query} onChange={e => setQuery(e.target.value)}
                            placeholder="Filter meshes…"
                            className="w-full pl-8 pr-8 py-2 rounded-lg text-[12px] font-mono
                                       bg-white/5 border border-white/8 text-white/70
                                       placeholder:text-white/20 outline-none
                                       focus:border-violet-500/40 focus:bg-white/8 transition-all" />
                        {query && (
                            <button onClick={onClear}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50">
                                <X size={11} />
                            </button>
                        )}
                    </div>
                )}

                <p className="text-[10px] text-white/25">
                    {!hasFile && "Upload a GLB to inspect its mesh structure"}
                    {hasFile && meshNames.length === 0 && "Parsing model…"}
                    {hasFile && meshNames.length > 0 && !query && `${meshNames.length} mesh${meshNames.length !== 1 ? "es" : ""} found`}
                    {hasFile && meshNames.length > 0 &&  query && `${filtered.length} of ${meshNames.length} match`}
                </p>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
                {filtered.length > 0
                    ? filtered.map(name => (
                        <MeshRow key={name} name={name} index={meshNames.indexOf(name)} />
                    ))
                    : (
                        <div className="flex flex-col items-center justify-center h-full gap-3 py-16 opacity-40">
                            <Box size={22} className="text-white/20" />
                            <p className="text-xs text-white/30 text-center">
                                {hasFile ? (query ? "No matches" : "Loading…") : "No file loaded"}
                            </p>
                        </div>
                    )}
            </div>

            {meshNames.length > 0 && (
                <div className="p-4 border-t border-white/[0.06]">
                    <CopyAllButton names={meshNames} />
                </div>
            )}
        </aside>
    );
});
MeshPanel.displayName = "MeshPanel";
export default MeshPanel;
