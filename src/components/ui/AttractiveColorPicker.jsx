import React, { useState, useEffect } from "react";
import { HexColorPicker, HexColorInput } from "react-colorful";
import { Hash } from "lucide-react";

/**
 * A modern, attractive color picker component using react-colorful.
 * styled for the dark/modern theme of the 3D editor.
 */
const AttractiveColorPicker = ({ color, onChange, className = "" }) => {
    return (
        <div className={`attractive-color-picker flex flex-col gap-3 p-3 bg-[#1e1e1e] border border-zinc-700/50 rounded-2xl shadow-2xl ${className}`}>
            <div className="custom-color-picker-wrapper">
                <HexColorPicker color={color} onChange={onChange} />
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-xl transition-all focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20">
                <Hash size={14} className="text-zinc-500" />
                <HexColorInput
                    color={color}
                    onChange={onChange}
                    prefixed
                    className="bg-transparent text-xs font-mono text-zinc-200 outline-none w-full uppercase"
                />
            </div>

            <style>{`
        .attractive-color-picker .react-colorful {
          width: 100%;
          height: 160px;
          border-radius: 12px;
        }
        .attractive-color-picker .react-colorful__saturation {
          border-bottom: none;
          border-radius: 12px 12px 0 0;
        }
        .attractive-color-picker .react-colorful__hue {
          height: 12px;
          border-radius: 0 0 12px 12px;
          margin-top: 8px;
        }
        .attractive-color-picker .react-colorful__pointer {
          width: 16px;
          height: 16px;
        }
      `}</style>
        </div>
    );
};

export default AttractiveColorPicker;
