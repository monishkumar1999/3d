import React from "react";
import { Image as ImageIcon, Type, Palette, ChevronLeft } from "lucide-react";

const TooltipButton = ({ icon: Icon, label, onClick, isActive }) => (
    <div className="relative group flex flex-col items-center">
        <button
            onClick={onClick}
            className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${isActive ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30" : "text-zinc-400 hover:bg-zinc-50 hover:text-indigo-600"}`}
        >
            <Icon size={22} />
        </button>
        <span className="absolute left-16 bg-zinc-900 text-white text-[10px] font-bold px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-[100] uppercase tracking-widest shadow-xl">
            {label}
        </span>
    </div>
);

export const SidebarStrip = ({ sidebarOpen, setSidebarOpen, onBack }) => {
    return (
        <div className="w-20 bg-white border-r border-zinc-200 flex flex-col items-center py-6 z-50 shadow-[4px_0_24px_rgba(0,0,0,0.02)] h-full">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-lg shadow-indigo-200 mb-8">
                P
            </div>

            <div className="flex flex-col gap-6 w-full px-2">
                <TooltipButton
                    icon={ImageIcon}
                    label="Assets"
                    onClick={() => setSidebarOpen(prev => !prev)}
                    isActive={sidebarOpen}
                />
                <TooltipButton icon={Type} label="Text" />
                <TooltipButton icon={Palette} label="Color" />
            </div>

            <div className="mt-auto">
                <button
                    onClick={onBack}
                    className="w-10 h-10 rounded-full hover:bg-zinc-100 flex items-center justify-center text-zinc-400 transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
            </div>
        </div>
    );
};

export default SidebarStrip;
