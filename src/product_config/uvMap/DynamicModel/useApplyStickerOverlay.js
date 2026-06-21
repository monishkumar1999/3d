import { useEffect } from "react";
import * as THREE from "three";

export const useApplyStickerOverlay = ({
    clonedScene, meshTextures, meshMaterials = {}, globalMaterial, showOriginal
}) => {
    useEffect(() => {
        const overlayTag = '__stickerOverlay__';

        clonedScene.traverse(child => {
            if (!child.isMesh) return;
            if (child.userData[overlayTag]) return; // skip overlays themselves
            const meshName = child.name;

            const stickerTex = meshTextures[meshName];
            let overlay = child.children.find(c => c.userData[overlayTag]);

            if (stickerTex) {
                console.log("[StickerOverlay] Mesh:", meshName, "found sticker texture. Existing overlay:", !!overlay);
            }

            if (!stickerTex || showOriginal) {
                if (overlay) {
                    console.log("[StickerOverlay] Removing overlay for mesh:", meshName);
                    if (overlay.material) overlay.material.dispose();
                    child.remove(overlay);
                }
                return;
            }

            const meshMat = meshMaterials[meshName] || {};
            const currentRoughness = meshMat.roughness !== undefined ? meshMat.roughness : (globalMaterial?.roughness ?? 0.5);
            const currentMetalness = meshMat.metalness !== undefined ? meshMat.metalness : (globalMaterial?.metalness ?? 0);
            const currentOpacity = meshMat.opacity !== undefined ? Number(meshMat.opacity) : 1;

            if (overlay) {
                overlay.material.map = stickerTex;
                if (stickerTex) stickerTex.needsUpdate = true; // Force texture upload to GPU
                overlay.material.transparent = false; // Render in opaque pass so it shows through transmissive glass
                overlay.material.alphaTest = 0.05;
                overlay.material.depthWrite = true;
                overlay.material.roughness = currentRoughness;
                overlay.material.metalness = currentMetalness;
                overlay.material.transmission = 0; // Stickers are opaque graphics, not refractive glass
                overlay.material.opacity = currentOpacity;
                overlay.renderOrder = (child.renderOrder || 0) + 1; // Always render overlay after parent mesh
                overlay.material.needsUpdate = true;
            } else {
                console.log("[StickerOverlay] Creating NEW overlay mesh for parent:", meshName);
                const mat = new THREE.MeshPhysicalMaterial({
                    map: stickerTex,
                    transparent: false, // Render in opaque pass so it shows through transmissive glass
                    alphaTest: 0.05,
                    depthWrite: true,
                    polygonOffset: true,
                    polygonOffsetFactor: -4,
                    polygonOffsetUnits: -4,
                    side: THREE.DoubleSide,
                    roughness: currentRoughness,
                    metalness: currentMetalness,
                    transmission: 0, // Stickers are opaque graphics, not refractive glass
                    opacity: currentOpacity,
                    ior: 1.5,
                    thickness: 0.5,
                });

                overlay = new THREE.Mesh(child.geometry, mat);
                overlay.renderOrder = (child.renderOrder || 0) + 1; // Always render overlay after parent mesh
                overlay.userData[overlayTag] = true;
                child.add(overlay); 
            }
        });
    }, [clonedScene, meshTextures, meshMaterials, globalMaterial, showOriginal]);
};
