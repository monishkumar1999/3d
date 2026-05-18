import React, { useMemo, useEffect, useState } from "react";
import { useGLTF, Center } from "@react-three/drei";
import { useStore } from "../../store/useStore";
import * as THREE from "three";

const DynamicModel = React.memo(({ url, meshTextures, baseTextures, pbrTextures, meshMaterials = {}, materialProps, showOriginal = false, setMeshList, onMeshLoaded }) => {
    const { scene } = useGLTF(url);
    const [meshes, setMeshes] = useState([]);
    
    // We clone the scene once, but we'll manage materials and overlays separately
    const clonedScene = useMemo(() => {
        const s = scene.clone();
        s.traverse(child => {
            if (child.isMesh) {
                // Store original material
                if (!child.userData.originalMat) {
                    child.userData.originalMat = child.material.clone();
                }
            }
        });
        return s;
    }, [scene]);

    const textureLoader = useMemo(() => new THREE.TextureLoader(), []);
    const materialSettings = useStore(state => state.materialSettings);

    // Initial Mesh Discovery
    useEffect(() => {
        const meshNames = [];
        clonedScene.traverse((child) => {
            if (child.isMesh) {
                meshNames.push(child.name);
            }
        });
        setMeshes(meshNames);
        setMeshList((prev) => (prev.length === meshNames.length ? prev : [...new Set(meshNames)]));
        if (onMeshLoaded) onMeshLoaded(clonedScene);
    }, [clonedScene, setMeshList, onMeshLoaded]);

    // Update base materials
    useEffect(() => {
        clonedScene.traverse((child) => {
            if (!child.isMesh) return;
            if (child.userData['__stickerOverlay__']) return; // skip sticker overlays

            if (showOriginal) {
                child.material = child.userData.originalMat;
                return;
            }

            // Create or update a working material
            if (!child.userData.workingMat) {
                const orig = child.userData.originalMat;
                const newMat = new THREE.MeshPhysicalMaterial();
                
                // Manually copy only what we need to avoid missing Vector2 properties error
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
            mat.roughness = meshMat.roughness !== undefined ? meshMat.roughness : (materialSettings.roughness !== undefined ? materialSettings.roughness : 0.5);
            mat.metalness = meshMat.metalness !== undefined ? meshMat.metalness : (materialSettings.metalness !== undefined ? materialSettings.metalness : 0);
            mat.transmission = meshMat.transmission !== undefined ? meshMat.transmission : 0;
            mat.ior = 1.5;
            mat.thickness = 0.5;
            
            if (mat.transmission > 0) {
                mat.transparent = true;
            }
            
            if (materialProps.color) mat.color.set(materialProps.color);

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
                        try {
                            child.geometry.computeTangents();
                        } catch (e) {}
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
    }, [clonedScene, baseTextures, pbrTextures, meshMaterials, materialProps, materialSettings, showOriginal, textureLoader]);

    // Attach sticker overlay meshes directly inside the scene hierarchy
    // so they perfectly track each parentMesh without any Center misalignment.
    useEffect(() => {
        const overlayTag = '__stickerOverlay__';

        clonedScene.traverse(child => {
            if (!child.isMesh) return;
            if (child.userData[overlayTag]) return; // skip overlays themselves
            const meshName = child.name;

            const stickerTex = meshTextures[meshName];
            
            // Find existing overlay
            let overlay = child.children.find(c => c.userData[overlayTag]);

            if (!stickerTex || showOriginal) {
                if (overlay) {
                    if (overlay.material) overlay.material.dispose();
                    child.remove(overlay);
                }
                return;
            }

            const meshMat = meshMaterials[meshName] || {};
            const currentRoughness = meshMat.roughness !== undefined ? meshMat.roughness : (materialSettings.roughness ?? 0.5);
            const currentMetalness = meshMat.metalness !== undefined ? meshMat.metalness : (materialSettings.metalness ?? 0);
            const currentTransmission = meshMat.transmission !== undefined ? meshMat.transmission : 0;

            if (overlay) {
                // FAST PATH: Update existing material map to avoid synchronous shader recompilation freezes!
                overlay.material.map = stickerTex;
                overlay.material.roughness = currentRoughness;
                overlay.material.metalness = currentMetalness;
                overlay.material.transmission = currentTransmission;
                overlay.material.needsUpdate = true;
            } else {
                // SLOW PATH: First time creation (compiles shader once)
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
    }, [clonedScene, meshTextures, meshMaterials, materialSettings, showOriginal]);

    // Render the scene — overlays are now embedded in clonedScene hierarchy
    return (
        <Center>
            <primitive object={clonedScene} />
        </Center>
    );
});

export default DynamicModel;
