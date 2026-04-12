import React, { useState, useCallback, useRef } from "react";
import * as THREE from "three";
import SetupPhase from "./components/SetupPhase";
import DesignPhase from "./components/DesignPhase";

import { optimizeImage } from "../utils/imageOptimizer";

/* =========================================================
   MAIN APP ORCHESTRATOR
   ========================================================= */
export default function ProTShirtStudio() {
  const [phase, setPhase] = useState('setup'); // 'setup' | 'design'

  // -- Project Data --
  const [glbUrl, setGlbUrl] = useState(null);
  const [meshList, setMeshList] = useState([]);
  const [meshConfig, setMeshConfig] = useState({}); // { meshName: { maskUrl } }

  // -- Editor State --
  const [meshTextures, setMeshTextures] = useState({});
  const [globalMaterial, setGlobalMaterial] = useState({ color: "#ffffff", roughness: 0.5, metalness: 0, wireframe: false });
  const [activeStickerUrl, setActiveStickerUrl] = useState(null);

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
      // Optimize the image before using it
      // Reduces 7MB -> ~100KB by resizing to max 1024px
      optimizeImage(file, 1024, 0.8) // Max 1024px
        .then(blob => {
          const optimizedUrl = URL.createObjectURL(blob);
          setMeshConfig(prev => ({
            ...prev,
            [meshName]: { ...prev[meshName], maskUrl: optimizedUrl }
          }));
        })
        .catch(err => {
          console.error("Optimization failed, falling back to original", err);
          // Fallback
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

    // Wait for the image to fully load before creating the texture.
    // This avoids a race condition where Three.js tries to upload the texture
    // before the image data is available, causing the 3D model to not update.
    const img = new Image();
    img.onload = () => {
      const tex = new THREE.Texture(img);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      tex.needsUpdate = true; // Image is ready — Three.js can upload immediately
      setMeshTextures(prev => ({ ...prev, [meshName]: tex }));
    };
    img.src = dataUrl;
  }, []);

  return (
    <div className="w-full h-screen bg-[#f8f9fc] text-zinc-900 font-sans overflow-hidden">
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
        />
      ) : (
        <DesignPhase
          glbUrl={glbUrl}
          meshConfig={meshConfig}
          meshTextures={meshTextures}
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
