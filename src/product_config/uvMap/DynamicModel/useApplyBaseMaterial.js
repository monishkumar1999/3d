import { useEffect, useMemo } from "react";
import * as THREE from "three";

export const useApplyBaseMaterial = ({
    clonedScene, baseTextures, pbrTextures, meshMaterials = {}, materialProps, globalMaterial, showOriginal
}) => {
    const textureLoader = useMemo(() => new THREE.TextureLoader(), []);

    useEffect(() => {
        clonedScene.traverse((child) => {
            if (!child.isMesh) return;
            if (child.userData['__stickerOverlay__']) return; // skip sticker overlays

            if (showOriginal) {
                child.material = child.userData.originalMat;
                return;
            }

            if (!child.userData.workingMat) {
                const orig = child.userData.originalMat;
                const newMat = new THREE.MeshPhysicalMaterial();
                if (orig.color) newMat.color.copy(orig.color);
                if (orig.map) newMat.map = orig.map;
                if (orig.normalMap) newMat.normalMap = orig.normalMap;
                if (orig.roughnessMap) newMat.roughnessMap = orig.roughnessMap;
                if (orig.metalnessMap) newMat.metalnessMap = orig.metalnessMap;
                newMat.side = orig.side !== undefined ? orig.side : THREE.DoubleSide;
                newMat.transparent = orig.transparent;
                newMat.opacity = orig.opacity;
                child.userData.workingMat = newMat;
            }
            child.material = child.userData.workingMat;

            const mat = child.material;
            mat.side = THREE.DoubleSide;
            const meshMat = meshMaterials[child.name] || {};
            mat.roughness = meshMat.roughness !== undefined ? meshMat.roughness : (globalMaterial?.roughness ?? 0.5);
            mat.metalness = meshMat.metalness !== undefined ? meshMat.metalness : (globalMaterial?.metalness ?? 0);
            mat.transmission = meshMat.transmission !== undefined ? meshMat.transmission : 0;
            mat.ior = 1.5;
            mat.thickness = 0.5;
            
            if (mat.transmission > 0) mat.transparent = true;
            if (materialProps?.color) mat.color.set(materialProps.color);

            // Apply base textures from variants
            if (baseTextures && baseTextures[child.name]) {
                const bTex = baseTextures[child.name];
                mat.map = bTex.map || child.userData.originalMat.map || null;
                mat.normalMap = bTex.normalMap || child.userData.originalMat.normalMap || null;
                mat.roughnessMap = bTex.roughnessMap || child.userData.originalMat.roughnessMap || null;
                mat.metalnessMap = bTex.metalnessMap || child.userData.originalMat.metalnessMap || null;
                mat.aoMap = bTex.aoMap || child.userData.originalMat.aoMap || null;

                if (bTex.roughnessMap) mat.roughness = 1.0;
                if (bTex.metalnessMap) mat.metalness = 1.0;
                if (bTex.aoMap) mat.aoMapIntensity = 1.0;

                const repeatVal = bTex.textureRepeat !== undefined ? Number(bTex.textureRepeat) : 1;
                const applyRepeat = (tex) => {
                    if (tex) {
                        tex.wrapS = THREE.RepeatWrapping;
                        tex.wrapT = THREE.RepeatWrapping;
                        tex.repeat.set(repeatVal, repeatVal);
                        tex.needsUpdate = true;
                    }
                };

                applyRepeat(mat.map);
                applyRepeat(mat.normalMap);
                applyRepeat(mat.roughnessMap);
                applyRepeat(mat.metalnessMap);
                applyRepeat(mat.aoMap);

                const nInt = bTex.normalIntensity !== undefined ? Number(bTex.normalIntensity) : 1;
                if (mat.normalMap) {
                    mat.normalScale = new THREE.Vector2(nInt, nInt);
                    if (child.geometry && child.geometry.attributes.uv && !child.geometry.attributes.tangent) {
                        try { child.geometry.computeTangents(); } catch (e) {}
                    }
                } else {
                    mat.normalScale = new THREE.Vector2(0, 0);
                }

                if (mat.aoMap && child.geometry && child.geometry.attributes.uv && !child.geometry.attributes.uv2) {
                    child.geometry.setAttribute("uv2", child.geometry.attributes.uv);
                }
            } else {
                mat.map = child.userData.originalMat.map || null;
                mat.normalMap = child.userData.originalMat.normalMap || null;
                mat.roughnessMap = child.userData.originalMat.roughnessMap || null;
                mat.metalnessMap = child.userData.originalMat.metalnessMap || null;
                mat.aoMap = child.userData.originalMat.aoMap || null;
            }

            // PBR
            if (pbrTextures) {
                if (pbrTextures.normal) {
                    const tex = textureLoader.load(pbrTextures.normal);
                    tex.flipY = false;
                    mat.normalMap = tex;
                }
                if (pbrTextures.roughness) {
                    const tex = textureLoader.load(pbrTextures.roughness);
                    tex.flipY = false;
                    mat.roughnessMap = tex;
                }
                if (pbrTextures.metalness) {
                    const tex = textureLoader.load(pbrTextures.metalness);
                    tex.flipY = false;
                    mat.metalnessMap = tex;
                }
                if (pbrTextures.ao) {
                    const tex = textureLoader.load(pbrTextures.ao);
                    tex.flipY = false;
                    mat.aoMap = tex;
                }
            }
            mat.needsUpdate = true;
        });
    }, [clonedScene, baseTextures, pbrTextures, meshMaterials, materialProps, globalMaterial, showOriginal, textureLoader]);
};
