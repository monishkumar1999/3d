import React from 'react';
import { Check } from 'lucide-react';

export const FONTS = [
    { name: "Inter", family: "Inter" },
    { name: "Roboto", family: "Roboto" },
    { name: "Lato", family: "Lato" },
    { name: "Montserrat", family: "Montserrat" },
    { name: "Poppins", family: "Poppins" },
    { name: "Open Sans", family: "Open Sans" },
    { name: "Oswald", family: "Oswald" },
    { name: "Playfair", family: "Playfair Display" },
    { name: "Merriweather", family: "Merriweather" },
    { name: "Lora", family: "Lora" },
    { name: "Cinzel", family: "Cinzel" },
    { name: "Bebas Neue", family: "Bebas Neue" },
    { name: "Anton", family: "Anton" },
    { name: "Righteous", family: "Righteous" },
    { name: "Lobster", family: "Lobster" },
    { name: "Pacifico", family: "Pacifico" },
    { name: "Dancing Script", family: "Dancing Script" },
    { name: "Satisfaction", family: "Satisfy" },
    { name: "Caveat", family: "Caveat" },
    { name: "Indie Flower", family: "Indie Flower" },
    { name: "Sacramento", family: "Sacramento" },
    { name: "Permanent Marker", family: "Permanent Marker" },
    { name: "Inconsolata", family: "Inconsolata" },
];

export const FontSelector = ({ activeFamily, onSelect }) => {
    return (
        <div className="absolute top-full left-0 mt-2 w-48 max-h-60 overflow-y-auto bg-[#1e1e1e] border border-zinc-700/50 rounded-xl shadow-xl p-1 z-[200] custom-scrollbar">
            {FONTS.map(font => (
                <button
                    key={font.family}
                    onClick={() => onSelect(font.family)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between ${activeFamily === font.family ? 'bg-indigo-600 text-white' : 'text-zinc-300 hover:bg-zinc-800'}`}
                >
                    <span style={{ fontFamily: font.family }}>{font.name}</span>
                    {activeFamily === font.family && <Check size={10} />}
                </button>
            ))}
        </div>
    );
};
