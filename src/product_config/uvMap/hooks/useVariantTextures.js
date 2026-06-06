import { useState, useEffect } from "react";
import * as THREE from "three";
import { store as reduxStore } from "../../../store/redux/store";
import { startLoading, stopLoading, updateProgress, updateMessage } from "../../../store/redux/loaderSlice";

export const useVariantTextures = (productData, selectedVariantId) => {
  const [variantTextures, setVariantTextures] = useState({});
  const [loadingTextures, setLoadingTextures] = useState(false);

  useEffect(() => {
    if (!productData || !selectedVariantId) return;
    const variant = productData.variants?.find(v => v.id === selectedVariantId);
    if (!variant || !variant.textures || variant.textures.length === 0) {
      setVariantTextures({});
      return;
    }

    setLoadingTextures(true);
    const loadVariantTextures = async () => {
      reduxStore.dispatch(startLoading({
          title: "Loading Product Textures",
          message: `Loading texture maps...`,
          type: "texture",
          progress: 10
      }));

      const textures = {};
      const loadTex = (url, isColorSpace = false) => {
        if (!url) return Promise.resolve(null);
        return new Promise((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            const t = new THREE.Texture(img);
            t.colorSpace = isColorSpace ? THREE.SRGBColorSpace : THREE.NoColorSpace;
            t.flipY = false;
            t.needsUpdate = true;
            resolve(t);
          };
          img.onerror = () => resolve(null);
          img.src = url;
        });
      };

      let loadedCount = 0;
      const totalTextures = variant.textures.length;

      for (const tex of variant.textures) {
        if (!tex.meshName) continue;
        const [map, normalMap, roughnessMap, metalnessMap, aoMap] = await Promise.all([
          loadTex(tex.map, true), loadTex(tex.normalMap, false),
          loadTex(tex.roughnessMap, false), loadTex(tex.metalnessMap, false), loadTex(tex.aoMap, false)
        ]);

        if (map || normalMap || roughnessMap || metalnessMap || aoMap) {
          textures[tex.meshName] = {
            map, normalMap, roughnessMap, metalnessMap, aoMap,
            textureRepeat: tex.textureRepeat !== undefined ? tex.textureRepeat : 1,
            normalIntensity: tex.normalIntensity !== undefined ? tex.normalIntensity : 1
          };
        }
        
        loadedCount++;
        const percent = 10 + Math.round((loadedCount / totalTextures) * 80);
        reduxStore.dispatch(updateProgress(percent));
        reduxStore.dispatch(updateMessage(`Loaded ${loadedCount} of ${totalTextures} texture groups...`));
      }

      setVariantTextures(textures);
      setLoadingTextures(false);
      
      reduxStore.dispatch(updateProgress(100));
      setTimeout(() => reduxStore.dispatch(stopLoading()), 300);
    };
    loadVariantTextures();
  }, [productData, selectedVariantId]);

  return { variantTextures, loadingTextures };
};
