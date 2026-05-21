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

            if (!stickerTex || showOriginal) {
                if (overlay) {
                    if (overlay.material) overlay.material.dispose();
                    child.remove(overlay);
                }
                return;
            }

            const meshMat = meshMaterials[meshName] || {};
            const currentRoughness = meshMat.roughness !== undefined ? meshMat.roughness : (globalMaterial?.roughness ?? 0.5);
            const currentMetalness = meshMat.metalness !== undefined ? meshMat.metalness : (globalMaterial?.metalness ?? 0);
            const currentTransmission = meshMat.transmission !== undefined ? meshMat.transmission : 0;

            if (overlay) {
                overlay.material.map = stickerTex;
                overlay.material.roughness = currentRoughness;
                overlay.material.metalness = currentMetalness;
                overlay.material.transmission = currentTransmission;
                overlay.material.needsUpdate = true;
            } else {
                const mat = new THREE.MeshPhysicalMaterial({
                    map: stickerTex,
                    transparent: true,
                    depthWrite: false,
                    polygonOffset: true,
                    polygonOffsetFactor: -4,
                    polygonOffsetUnits: -4,
                    side: THREE.DoubleSide,
                    roughness: currentRoughness,
                    metalness: currentMetalness,
                    transmission: currentTransmission,
                    ior: 1.5,
                    thickness: 0.5,
                });

                overlay = new THREE.Mesh(child.geometry, mat);
                overlay.renderOrder = 10;
                overlay.userData[overlayTag] = true;
                child.add(overlay); 
            }
        });
    }, [clonedScene, meshTextures, meshMaterials, globalMaterial, showOriginal]);
};
