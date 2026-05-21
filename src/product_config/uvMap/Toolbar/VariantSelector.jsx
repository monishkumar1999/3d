import React from "react";

export const VariantSelector = ({ productId, variants, selectedVariantId, setSelectedVariantId, loadingTextures }) => {
  if (!productId || !variants || variants.length === 0) return null;

  return (
    <div className="absolute top-4 right-4 z-30 flex items-center gap-2 bg-white/95 backdrop-blur-md shadow-xl rounded-2xl px-4 py-2.5 border border-zinc-200">
      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mr-1">Variant</span>
      <div className="flex gap-1.5 flex-wrap">
        {variants.map(v => (
          <button
            key={v.id}
            onClick={() => setSelectedVariantId(v.id)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              selectedVariantId === v.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-300'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
            }`}
          >
            {v.name}
          </button>
        ))}
      </div>
      {loadingTextures && (
        <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin ml-1" />
      )}
    </div>
  );
};
