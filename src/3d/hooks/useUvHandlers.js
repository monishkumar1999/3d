import { useCallback } from "react";
import * as THREE from "three";
import { optimizeImage } from "../../utils/imageOptimizer";

export const useUvHandlers = (glbUrl, setGlbUrl, setMeshList, setMeshConfig, setMeshTextures) => {
  const handleGlb = useCallback((e) => {
    const file = e.target.files[0];
    if (file) {
      if (glbUrl) URL.revokeObjectURL(glbUrl);
      setGlbUrl(URL.createObjectURL(file));
      setMeshList([]);
      setMeshConfig({});
    }
  }, [glbUrl, setGlbUrl, setMeshList, setMeshConfig]);

  const handleMaskUpload = useCallback((meshName, e) => {
    const file = e.target.files[0];
    if (file) {
      optimizeImage(file, 2048, 0.9)
        .then(blob => {
          setMeshConfig(prev => ({ ...prev, [meshName]: { ...prev[meshName], maskUrl: URL.createObjectURL(blob) } }));
        })
        .catch(() => {
          setMeshConfig(prev => ({ ...prev, [meshName]: { ...prev[meshName], maskUrl: URL.createObjectURL(file) } }));
        });
    }
  }, [setMeshConfig]);

  const applyTexture = useCallback((meshName, dataOrCanvas) => {
    if (!dataOrCanvas) {
      setMeshTextures(prev => {
        const next = { ...prev };
        delete next[meshName];
        return next;
      });
      return;
    }

    if (dataOrCanvas instanceof HTMLCanvasElement || (typeof ImageBitmap !== 'undefined' && dataOrCanvas instanceof ImageBitmap)) {
      // Use THREE.Texture for both Canvas and ImageBitmap. It handles both natively.
      const tex = new THREE.Texture(dataOrCanvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.flipY = false;
      // High-quality filtering: mipmaps + anisotropy for crisp stickers at all angles
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = 16;
      tex.needsUpdate = true;
      setMeshTextures(prev => ({ ...prev, [meshName]: tex }));
    } else {
      const img = new Image();
      img.onload = () => {
        const tex = new THREE.Texture(img);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.flipY = false;
        // High-quality filtering: mipmaps + anisotropy for crisp stickers at all angles
        tex.generateMipmaps = true;
        tex.minFilter = THREE.LinearMipmapLinearFilter;
        tex.magFilter = THREE.LinearFilter;
        tex.anisotropy = 16;
        tex.needsUpdate = true;
        setMeshTextures(prev => ({ ...prev, [meshName]: tex }));
      };
      img.src = dataOrCanvas;
    }
  }, [setMeshTextures]);

  return { handleGlb, handleMaskUpload, applyTexture };
};
