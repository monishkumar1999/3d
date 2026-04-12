import React, { useMemo, useEffect } from "react";
import { useGLTF, Center } from "@react-three/drei";
import { useStore } from "../../store/useStore";
import * as THREE from "three";
import { generateFabricNormalMap } from "../utils/textureUtils";

const DynamicModel = React.memo(React.forwardRef(({ url, meshTextures, meshNormals, meshColors, materialProps, setMeshList, onMeshLoaded, isMobile }, ref) => {
    const { scene } = useGLTF(url);
    const clonedScene = useMemo(() => scene.clone(), [scene]);

    // Expose scene via ref
    React.useImperativeHandle(ref, () => ({
        scene: clonedScene
    }), [clonedScene]);

    // Memoize loader to prevent recreation
    const textureLoader = useMemo(() => new THREE.TextureLoader(), []);

    // Generate Fabric Normal Map once
    const materialSettings = useStore(state => state.materialSettings);
    const fabricMapUrl = useMemo(() => {
        // Default to 'plain' if not set
        const type = materialSettings.fabricType || 'plain';
        return generateFabricNormalMap(512, 512, 8, type);
    }, [materialSettings.fabricType]);
    // Load it as a texture
    // using raw THREE loader for manual control or useLoader if consistent
    // Since it's a data URL, we can load it directly. 
    // Ideally useLoader(THREE.TextureLoader, fabricMapUrl) but useMemo manual load is fine for Data URIs to avoid suspense jitter on re-gen
    const [fabricTexture, setFabricTexture] = React.useState(null);

    useEffect(() => {
        if (fabricMapUrl) {
            new THREE.TextureLoader().load(fabricMapUrl, (tex) => {
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.repeat.set(4, 4); // Repeat 4 times
                setFabricTexture(tex);
            });
        }
    }, [fabricMapUrl]);


    // Initial Mesh Discovery
    useEffect(() => {
        const meshes = [];
        clonedScene.traverse((child) => {
            if (child.isMesh) {
                meshes.push(child.name);
                if (!child.userData.originalMat) child.userData.originalMat = child.material.clone();
            }
        });
        setMeshList((prev) => (prev.length === meshes.length ? prev : [...new Set(meshes)]));
        if (onMeshLoaded) onMeshLoaded(clonedScene);
    }, [clonedScene, setMeshList, onMeshLoaded]);

    // Texture & Material Updates
    // materialSettings is already declared at the top

    useEffect(() => {
        clonedScene.traverse((child) => {
            if (child.isMesh) {
                // Debug Log
                if (meshColors && meshColors[child.name]) {
                    // console.log(`DynamicModel: Applying color ${meshColors[child.name]} to mesh ${child.name}`);
                }

                // CHECK: Enable Fabric Toggle
                if (materialSettings.enableFabric === false) {
                    // Logic: Restore original material, apply upgrades (color/texture) ONLY.
                    if (child.userData.originalMat) {
                        // We always clone to avoid mutating the source of truth
                        if (Array.isArray(child.userData.originalMat)) {
                            child.material = child.userData.originalMat.map(m => m.clone());
                        } else {
                            child.material = child.userData.originalMat.clone();
                        }
                    }

                    // Apply Material Properties (Roughness, etc.) - ALLOW USER CONTROL
                    const applyProps = (mat) => {
                        mat.roughness = materialSettings.roughness;
                        mat.metalness = materialSettings.metalness;
                        mat.sheen = materialSettings.sheen;
                        mat.sheenRoughness = materialSettings.sheenRoughness;
                        mat.side = THREE.DoubleSide; // Consistent side rendering
                        mat.needsUpdate = true;
                    };

                    if (Array.isArray(child.material)) {
                        child.material.forEach(applyProps);
                    } else {
                        applyProps(child.material);
                    }

                    // Apply Custom Texture if present
                    if (meshTextures[child.name]) {
                        const newMap = meshTextures[child.name];
                        const applyMap = (mat) => {
                            if (mat.map?.uuid !== newMap.uuid) {
                                mat.map = newMap;
                                mat.map.flipY = false;
                                mat.map.colorSpace = THREE.SRGBColorSpace;
                                mat.map.generateMipmaps = true;
                                mat.needsUpdate = true;
                                mat.color.set('#ffffff'); // Reset color for texture
                            }
                        };
                        if (Array.isArray(child.material)) {
                            child.material.forEach(applyMap);
                        } else {
                            applyMap(child.material);
                        }
                    }

                    // Apply Custom Color if present (and no texture, usually)
                    // Apply Custom or Global Color
                    const colorToApply = (meshColors && meshColors[child.name]) || materialProps.color;

                    if (colorToApply) {
                        const applyColor = (mat) => {
                            if (!meshTextures[child.name]) {
                                mat.color.set(colorToApply);
                            }
                        };
                        if (Array.isArray(child.material)) {
                            child.material.forEach(applyColor);
                        } else {
                            applyColor(child.material);
                        }
                    }

                    // Skip the rest of the loop (Fabric Logic)
                    return;
                }

                // --- FABRIC ENABLED LOGIC BELOW ---

                // 1. Handle Texture Map
                if (meshTextures[child.name]) {
                    const newMap = meshTextures[child.name];

                    // Only clone/replace material if the MAP actually changes significantly
                    // or if we haven't set up our custom material yet.

                    // Simplified: Ensure we are working on a clone
                    if (!child.userData.isCloned) {
                        child.material = child.userData.originalMat ? child.userData.originalMat.clone() : child.material.clone();
                        child.userData.isCloned = true;
                    }
                    // Update Map if different
                    if (child.material.map?.uuid !== newMap.uuid) {
                        child.material.map = newMap;
                        child.material.map.flipY = false;
                        child.material.map.colorSpace = THREE.SRGBColorSpace;
                        child.material.map.minFilter = THREE.LinearMipMapLinearFilter;
                        child.material.map.magFilter = THREE.LinearFilter;
                        child.material.map.anisotropy = isMobile ? 4 : 16; // Reduce anisotropy on mobile
                        child.material.map.generateMipmaps = true;
                        child.material.needsUpdate = true;
                    }
                } else {
                    // If original had map, we usually clear it for "Fabric Mode" if we are applying fabric?
                    // Actually, if we are in Fabric Mode, we might want to KEEP original texture if no custom texture is selected?
                    // Logic at end of file (lines 148-152) handled this via "NUCLEAR CLEANUP".

                    if (child.userData.originalMat && child.userData.isCloned) {
                        // Optional: Revert to original if that's the desired flow, 
                        // but usually we just clear the map.
                        // child.material.map = null;
                        // child.material.needsUpdate = true;
                    }
                }

                // 2. Upgrade to MeshPhysicalMaterial if needed (for Sheen support)
                if (child.material.type !== "MeshPhysicalMaterial") {
                    const newMat = new THREE.MeshPhysicalMaterial();
                    const source = child.material;

                    // Copy basic properties safely
                    newMat.name = source.name;
                    if (source.color) newMat.color.copy(source.color);
                    if (source.map) newMat.map = source.map;
                    if (source.opacity !== undefined) newMat.opacity = source.opacity;
                    if (source.transparent !== undefined) newMat.transparent = source.transparent;
                    if (source.alphaTest !== undefined) newMat.alphaTest = source.alphaTest;
                    if (source.side !== undefined) newMat.side = source.side;

                    child.material = newMat;
                    child.userData.isCloned = true;
                }

                const applyToMaterial = (mat) => {
                    // Removed: enableFabric check (moved to top)

                    mat.side = THREE.DoubleSide;
                    mat.roughness = materialSettings.roughness;
                    mat.metalness = materialSettings.metalness;
                    mat.sheen = materialSettings.sheen;
                    mat.sheenRoughness = materialSettings.sheenRoughness;

                    // Normals logic (simplified for brevity, relying on existing closures)
                    if (meshNormals && meshNormals[child.name]) {
                        textureLoader.load(meshNormals[child.name], (normMap) => {
                            normMap.flipY = false;
                            mat.normalMap = normMap;
                            mat.normalScale.set(materialSettings.fabricStrength, materialSettings.fabricStrength);
                            mat.needsUpdate = true;
                        });
                    } else if (fabricTexture && materialSettings.fabricStrength > 0) {
                        mat.normalMap = fabricTexture;
                        mat.normalScale = new THREE.Vector2(materialSettings.fabricStrength, materialSettings.fabricStrength);
                    } else {
                        // Keep nuclear cleanup consistent
                        mat.normalMap = null;
                    }

                    mat.flatShading = false;
                    mat.vertexColors = false;
                    mat.clearcoat = 0;

                    // Color / Texture Application
                    if (meshTextures[child.name]) {
                        // Texture is present
                        mat.color.set('#ffffff');
                        // Ensure map is assigned if it was cleared previously?
                        // The loop above logic for 'newMap' handles assignment. 
                    } else {
                        // NUCLEAR CLEANUP
                        mat.map = null;
                        mat.aoMap = null;
                        mat.metalnessMap = null;
                        mat.roughnessMap = null;
                        mat.emissiveMap = null;
                        mat.lightMap = null;

                        mat.metalness = 0;
                        mat.roughness = 0.8;
                        mat.emissive.setHex(0x000000);
                        mat.envMapIntensity = 1;

                        if (meshColors && meshColors[child.name]) {
                            // console.log(`Setting Color ${meshColors[child.name]} on ${child.name}`);
                            mat.color.set(meshColors[child.name]);
                        } else if (materialProps.color) {
                            mat.color.set(materialProps.color);
                        } else {
                            mat.color.set('#ffffff');
                        }
                    }
                    mat.needsUpdate = true;
                };

                // Array Handling
                if (Array.isArray(child.material)) {
                    // console.log(`DynamicModel: Mesh ${child.name} has MULTIPLE materials. Applying to all.`);
                    child.material.forEach(m => applyToMaterial(m));
                } else {
                    applyToMaterial(child.material);
                }
            } // Close if (child.isMesh)
        });
    }, [clonedScene, meshTextures, meshNormals, meshColors, materialProps, materialSettings, fabricTexture]);

    return (
        <Center>
            <primitive object={clonedScene} />
        </Center>
    );
}));

export default DynamicModel;
