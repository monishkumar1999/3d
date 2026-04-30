import { memo } from "react";
import { useProductConfigStore } from "../../../store/useProductConfigStore";

const TabsHeader = memo(({ activeTab, setActiveTab }) => {
    const meshCount = useProductConfigStore(state => state.meshes.length);
    return (
        <div className="flex border-b border-zinc-200 bg-zinc-50 flex-shrink-0">
            <button
                onClick={() => setActiveTab('configurator')}
                className={`flex-1 py-3.5 text-[11px] font-black uppercase tracking-wider transition-all ${
                    activeTab === 'configurator'
                        ? "text-indigo-600 bg-white border-b-[3px] border-indigo-600"
                        : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 border-b-[3px] border-transparent"
                }`}
            >
                Configurator
            </button>
            <button
                onClick={() => setActiveTab('meshes')}
                className={`flex-1 py-3.5 text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'meshes'
                        ? "text-indigo-600 bg-white border-b-[3px] border-indigo-600"
                        : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 border-b-[3px] border-transparent"
                }`}
            >
                Meshes
                {meshCount > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                        activeTab === 'meshes' 
                            ? 'bg-indigo-100 text-indigo-700' 
                            : 'bg-zinc-200 text-zinc-600'
                    }`}>
                        {meshCount}
                    </span>
                )}
            </button>
        </div>
    );
});

TabsHeader.displayName = "TabsHeader";
export default TabsHeader;
