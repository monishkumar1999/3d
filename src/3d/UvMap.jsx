import React, { useState } from "react";
import { useParams } from "react-router-dom";
import SetupPhase from "./components/SetupPhase";
import DesignPhase from "./components/DesignPhase";
import { useProductLoader } from "./hooks/useProductLoader";
import { useVariantTextures } from "./hooks/useVariantTextures";
import { useUvHandlers } from "./hooks/useUvHandlers";
import { VariantSelector } from "./components/VariantSelector";

export default function ProTShirtStudio() {
  const { productId } = useParams();
  const [phase, setPhase] = useState('setup');
  const [meshList, setMeshList] = useState([]);
  const [meshTextures, setMeshTextures] = useState({});
  const [globalMaterial, setGlobalMaterial] = useState({ color: "#ffffff", roughness: 0.5, metalness: 0, wireframe: false });
  const [activeStickerUrl, setActiveStickerUrl] = useState(null);

  const { productData, glbUrl, setGlbUrl, meshConfig, setMeshConfig, selectedVariantId, setSelectedVariantId } = useProductLoader(productId);
  const { variantTextures, loadingTextures } = useVariantTextures(productData, selectedVariantId);
  const { handleGlb, handleMaskUpload, applyTexture } = useUvHandlers(glbUrl, setGlbUrl, setMeshList, setMeshConfig, setMeshTextures);

  return (
    <div className="w-full h-screen bg-[#f8f9fc] text-zinc-900 font-sans overflow-hidden relative">
      <VariantSelector productId={productId} variants={productData?.variants} selectedVariantId={selectedVariantId} setSelectedVariantId={setSelectedVariantId} loadingTextures={loadingTextures} />
      
      {phase === 'setup' ? (
        <SetupPhase 
          glbUrl={glbUrl} meshList={meshList} meshConfig={meshConfig} globalMaterial={globalMaterial} 
          setGlbUrl={setGlbUrl} handleGlb={handleGlb} handleMaskUpload={handleMaskUpload} 
          setMeshList={setMeshList} onLaunch={() => setPhase('design')} 
          baseTextures={variantTextures} autoPlaceMeshes={!!productId} 
        />
      ) : (
        <DesignPhase 
          productId={productId} glbUrl={glbUrl} meshConfig={meshConfig} 
          meshTextures={meshTextures} baseTextures={variantTextures} 
          globalMaterial={globalMaterial} activeStickerUrl={activeStickerUrl} 
          setGlobalMaterial={setGlobalMaterial} setActiveStickerUrl={setActiveStickerUrl} 
          onBack={() => setPhase('setup')} onUpdateTexture={applyTexture} 
        />
      )}
    </div>
  );
}
