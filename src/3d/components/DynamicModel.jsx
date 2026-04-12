import React, { useMemo, useEffect } from "react";
import { useGLTF, Center } from "@react-three/drei";
import { useStore } from "../../store/useStore";
import * as THREE from "three";

const DynamicModel = React.memo(({ url, meshTextures, materialProps, showOriginal = false, setMeshList, onMeshLoaded }) => {
    const { scene } = useGLTF(url);
    const clonedScene = useMemo(() => scene.clone(), [scene]);

    // Initial Mesh Discovery
    useEffect(() => {
        const meshes = [];
        clonedScene.traverse((child) => {
            if (child.isMesh) {
                meshes.push(child.name);
                // Store original material for Show Original toggle
                if (!child.userData.originalMat) child.userData.originalMat = child.material.clone();
            }
        });
        setMeshList((prev) => (prev.length === meshes.length ? prev : [...new Set(meshes)]));
        if (onMeshLoaded) onMeshLoaded(clonedScene);
    }, [clonedScene, setMeshList, onMeshLoaded]);

    // ----- OVERLAY MESH MANAGEMENT -----
    // For each mesh with a sticker texture, we keep the ORIGINAL material untouched
    // and add a transparent child mesh that renders only the sticker on top.
    const materialSettings = useStore(state => state.materialSettings);

    useEffect(() => {
        clonedScene.traverse((child) => {
            if (!child.isMesh) return;

            // 1. Always restore original material (so base texture never changes)
            if (child.userData.originalMat && !showOriginal) {
                // Restore to original if we placed an overlay on it previously
                child.material = child.userData.originalMat.clone();
                child.userData.isCloned = true;
            }

            // ShowOriginal mode: strict restore, no overlays
            if (showOriginal) {
                if (child.userData.originalMat) {
                    child.material = child.userData.originalMat.clone();
                    child.userData.isCloned = false;
                }
                // Remove any overlay child
                const oldOverlay = child.getObjectByName(`__overlay__${child.name}`);
                if (oldOverlay) child.remove(oldOverlay);
                return;
            }

            // 2. Apply admin material settings to the BASE mesh (roughness, metalness etc.)
            const mat = child.material;
            mat.side = THREE.DoubleSide;
            mat.roughness = materialSettings.roughness;
            mat.metalness = materialSettings.metalness;
            mat.sheen = materialSettings.sheen;
            mat.sheenRoughness = materialSettings.sheenRoughness;
            mat.flatShading = false;
            mat.clearcoat = 0;
            if (materialProps.color) mat.color.set(materialProps.color);
            mat.needsUpdate = true;

            // 3. Sticker Overlay
            const stickerTex = meshTextures[child.name];
            const existingOverlay = child.getObjectByName(`__overlay__${child.name}`);

            if (stickerTex) {
                if (existingOverlay) {
                    // Update texture on existing overlay
                    existingOverlay.material.map = stickerTex;
                    existingOverlay.material.needsUpdate = true;
                } else {
                    // Create a new transparent overlay mesh using the same geometry
                    const overlayMat = new THREE.MeshBasicMaterial({
                        map: stickerTex,
                        transparent: true,
                        depthWrite: false,
                        blending: THREE.NormalBlending,
                        polygonOffset: true,
                        polygonOffsetFactor: -1,
                        polygonOffsetUnits: -1,
                        side: THREE.DoubleSide,
                    });
                    const overlayMesh = new THREE.Mesh(child.geometry, overlayMat);
                    overlayMesh.name = `__overlay__${child.name}`;
                    overlayMesh.renderOrder = 1;
                    child.add(overlayMesh);
                }
            } else {
                // No sticker — remove overlay if it exists
                if (existingOverlay) child.remove(existingOverlay);
            }
        });
    }, [clonedScene, meshTextures, materialProps, materialSettings, showOriginal]);

    return (
        <Center>
            <primitive object={clonedScene} />
        </Center>
    );
});

export default DynamicModel;
