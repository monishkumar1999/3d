import React, { useState, useCallback, useEffect } from "react";
import { useParams } from "react-router-dom";
import * as THREE from "three";
import SetupPhase from "./components/SetupPhase";
import DesignPhase from "./components/DesignPhase";

import { optimizeImage } from "../utils/imageOptimizer";
import { getProductDetails } from "../api/productConfigApi";

/* =========================================================
   MAIN APP ORCHESTRATOR
   ========================================================= */
export default function ProTShirtStudio() {
  const { productId } = useParams();
  const [phase, setPhase] = useState('setup'); // 'setup' | 'design'

  // -- Project Data --
  const [glbUrl, setGlbUrl] = useState(null);
  const [meshList, setMeshList] = useState([]);
  const [meshConfig, setMeshConfig] = useState({}); // { meshName: { maskUrl } }

  // -- Editor State --
  const [meshTextures, setMeshTextures] = useState({});     // sticker/design overlays
  const [variantTextures, setVariantTextures] = useState({}); // base diffuse from variants
  const [globalMaterial, setGlobalMaterial] = useState({ color: "#ffffff", roughness: 0.5, metalness: 0, wireframe: false });
  const [activeStickerUrl, setActiveStickerUrl] = useState(null);

  // -- Product / Variant State --
  const [productData, setProductData] = useState(null);
  const [selectedVariantId, setSelectedVariantId] = useState(null);
  const [loadingTextures, setLoadingTextures] = useState(false);

  // -- Auto-load product when productId is present --
  useEffect(() => {
    if (!productId) return;

    const loadProduct = async () => {
      try {
        const res = await getProductDetails(productId);
        if (!res.data?.success) return;

        const product = res.data.product;
        setProductData(product);

        // Set GLB URL from backend (already signed)
        if (product.base_model_url) {
          setGlbUrl(product.base_model_url);
        }

        // Pre-populate meshConfig with UV mask URLs from backend meshes
        if (product.meshes && Array.isArray(product.meshes)) {
          const config = {};
          product.meshes.forEach(mesh => {
            if (mesh.whiteMaskPath) {
              config[mesh.meshName] = { maskUrl: mesh.whiteMaskPath };
            }
          });
          if (Object.keys(config).length > 0) {
            setMeshConfig(config);
          }
        }

        // Auto-select first variant if available
        if (product.variants && product.variants.length > 0) {
          setSelectedVariantId(product.variants[0].id);
        }
      } catch (err) {
        console.error("Failed to load product for UvMap:", err);
      }
    };

    loadProduct();
  }, [productId]);

  // -- Load variant textures when selectedVariantId changes --
  useEffect(() => {
    if (!productData || !selectedVariantId) return;

    const variant = productData.variants?.find(v => v.id === selectedVariantId);
    if (!variant || !variant.textures || variant.textures.length === 0) {
      setVariantTextures({});
      return;
    }

    setLoadingTextures(true);

    const loadVariantTextures = async () => {
      const textures = {};
      for (const tex of variant.textures) {
        const meshName = tex.meshName;
        const diffuseUrl = tex.map; // already signed from backend
        if (!meshName || !diffuseUrl) continue;

        try {
          const texture = await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = () => {
              const t = new THREE.Texture(img);
              t.colorSpace = THREE.SRGBColorSpace;
              t.flipY = false;
              t.needsUpdate = true;
              resolve(t);
            };
            img.onerror = () => reject(new Error("Failed to load texture"));
            img.src = diffuseUrl;
          });
          textures[meshName] = texture;
        } catch (e) {
          console.warn(`Failed to load texture for mesh "${meshName}"`, e);
        }
      }
      setVariantTextures(textures);
      setLoadingTextures(false);
    };

    loadVariantTextures();
  }, [productData, selectedVariantId]);

  // --- Handlers ---
  const handleGlb = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (glbUrl) URL.revokeObjectURL(glbUrl);
      setGlbUrl(URL.createObjectURL(file));
      setMeshList([]);
      setMeshConfig({});
    }
  };

  const handleMaskUpload = (meshName, e) => {
    const file = e.target.files[0];
    if (file) {
      optimizeImage(file, 1024, 0.8)
        .then(blob => {
          const optimizedUrl = URL.createObjectURL(blob);
          setMeshConfig(prev => ({
            ...prev,
            [meshName]: { ...prev[meshName], maskUrl: optimizedUrl }
          }));
        })
        .catch(err => {
          console.error("Optimization failed, falling back to original", err);
          setMeshConfig(prev => ({
            ...prev,
            [meshName]: { ...prev[meshName], maskUrl: URL.createObjectURL(file) }
          }));
        });
    }
  };

  const applyTexture = useCallback((meshName, dataUrl) => {
    if (!dataUrl) {
      setMeshTextures(prev => {
        const next = { ...prev };
        delete next[meshName];
        return next;
      });
      return;
    }

    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      tex.needsUpdate = true;
      setMeshTextures(prev => ({ ...prev, [meshName]: tex }));
    };
    img.src = dataUrl;
  }, []);

  // -- Variant selector UI (floating bar) --
  const variants = productData?.variants || [];
  const variantSelector = productId && variants.length > 0 ? (
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
  ) : null;

  return (
    <div className="w-full h-screen bg-[#f8f9fc] text-zinc-900 font-sans overflow-hidden relative">
      {variantSelector}
      {phase === 'setup' ? (
        <SetupPhase
          glbUrl={glbUrl}
          meshList={meshList}
          meshConfig={meshConfig}
          globalMaterial={globalMaterial}
          setGlbUrl={setGlbUrl}
          handleGlb={handleGlb}
          handleMaskUpload={handleMaskUpload}
          setMeshList={setMeshList}
          onLaunch={() => setPhase('design')}
          baseTextures={variantTextures}
          autoPlaceMeshes={!!productId}
        />
      ) : (
        <DesignPhase
          glbUrl={glbUrl}
          meshConfig={meshConfig}
          meshTextures={meshTextures}
          baseTextures={variantTextures}
          globalMaterial={globalMaterial}
          activeStickerUrl={activeStickerUrl}
          setGlobalMaterial={setGlobalMaterial}
          setActiveStickerUrl={setActiveStickerUrl}
          onBack={() => setPhase('setup')}
          onUpdateTexture={applyTexture}
        />
      )}
    </div>
  );
}
