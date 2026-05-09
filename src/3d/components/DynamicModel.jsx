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
                mat.map = baseTextures[child.name];
            } else {
                mat.map = child.userData.originalMat.map;
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

    // Render the scene and portals for overlays
    return (
        <Center>
            <primitive object={clonedScene} />
            
            {/* Render Overlays as distinct React components for better sync */}
            {!showOriginal && meshes.map(meshName => {
                const stickerTex = meshTextures[meshName];
                if (!stickerTex) return null;

                const parentMesh = clonedScene.getObjectByName(meshName);
                if (!parentMesh) return null;

                const meshMat = meshMaterials[meshName] || {};
                const currentRoughness = meshMat.roughness !== undefined ? meshMat.roughness : (materialSettings.roughness !== undefined ? materialSettings.roughness : 0.5);
                const currentMetalness = meshMat.metalness !== undefined ? meshMat.metalness : (materialSettings.metalness !== undefined ? materialSettings.metalness : 0);
                const currentTransmission = meshMat.transmission !== undefined ? meshMat.transmission : 0;

                return (
                    <mesh 
                        key={`overlay-${meshName}`}
                        geometry={parentMesh.geometry}
                        position={parentMesh.getWorldPosition(new THREE.Vector3())}
                        quaternion={parentMesh.getWorldQuaternion(new THREE.Quaternion())}
                        scale={parentMesh.getWorldScale(new THREE.Vector3())}
                        renderOrder={10}
                    >
                        <meshPhysicalMaterial 
                            map={stickerTex} 
                            transparent={true} 
                            depthWrite={false}
                            polygonOffset={true}
                            polygonOffsetFactor={-4}
                            polygonOffsetUnits={-4}
                            side={THREE.DoubleSide}
                            roughness={currentRoughness}
                            metalness={currentMetalness}
                            transmission={currentTransmission}
                            ior={1.5}
                            thickness={0.5}
                        />
                    </mesh>
                );
            })}
        </Center>
    );
});

export default DynamicModel;
