import React, { useMemo, useEffect } from "react";
import { useGLTF, Center } from "@react-three/drei";
import { useStore } from "../../store/useStore";
import * as THREE from "three";

const DynamicModel = React.memo(({ url, meshTextures, materialProps, setMeshList, onMeshLoaded }) => {
    const { scene } = useGLTF(url);
    const clonedScene = useMemo(() => scene.clone(), [scene]);

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
    const materialSettings = useStore(state => state.materialSettings);

    useEffect(() => {
        clonedScene.traverse((child) => {
            if (child.isMesh) {
                // 1. Handle Texture Map
                if (meshTextures[child.name]) {
                    const newMap = meshTextures[child.name];

                    // Only clone/replace material if the MAP actually changes significantly
                    // or if we haven't set up our custom material yet.
                    // However, to be safe and responsive, we can just update the map on the existing material
                    // if it's already a clone, or clone it once.

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
                        child.material.map.anisotropy = 16;
                        child.material.map.generateMipmaps = true;
                        child.material.needsUpdate = true;
                    }
                } else {
                    // No texture? Revert to original? 
                    // For now, keep as is or ensure specific behavior.
                    if (child.userData.originalMat && child.userData.isCloned) {
                        // Optional: Revert to original if that's the desired flow, 
                        // but usually we just clear the map.
                        child.material.map = null;
                        child.material.needsUpdate = true;
                    }
                }

                // 2. Upgrade to MeshPhysicalMaterial if needed (for Sheen support)
                if (child.material.type !== "MeshPhysicalMaterial") {
                    const newMat = new THREE.MeshPhysicalMaterial();
                    THREE.MeshPhysicalMaterial.prototype.copy.call(newMat, child.material);
                    child.material = newMat;
                    child.userData.isCloned = true;
                }

                // 3. Always Apply Material Properties (Admin Config)
                const mat = child.material;
                mat.side = THREE.DoubleSide;

                // Dynamic Admin Controls
                mat.roughness = materialSettings.roughness;
                mat.metalness = materialSettings.metalness;
                mat.sheen = materialSettings.sheen;
                mat.sheenRoughness = materialSettings.sheenRoughness;

                mat.flatShading = false;
                mat.clearcoat = 0; // Keeping clearcoat off for now as requested

                if (materialProps.color) mat.color.set(materialProps.color);

                mat.needsUpdate = true;
            }
        });
    }, [clonedScene, meshTextures, materialProps, materialSettings]);

    return (
        <Center>
            <primitive object={clonedScene} />
        </Center>
    );
});

export default DynamicModel;
