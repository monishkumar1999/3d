/**
 * GlbModelPbr.jsx - inside <Canvas>
 * Reads PBR sets, selectedMeshId, and mesh registration helpers from the store.
 */
import { memo, useEffect, useMemo } from "react";
import { Center, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { DEFAULT_PBR_SETTINGS, useProductConfigStore } from "../store/useProductConfigStore";

const HIGHLIGHT_COLOR = new THREE.Color(0x4f46e5);
const DEFAULT_NORMAL_SCALE = new THREE.Vector2(1, 1);
const TEXTURE_KEYS = ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap", "alphaMap", "bumpMap"];

function cloneTexture(texture) {
    if (!texture?.isTexture) return texture ?? null;

    const next = texture.clone();
    next.needsUpdate = true;
    return next;
}

function cloneMaterialTextures(material) {
    TEXTURE_KEYS.forEach((key) => {
        if (material[key]) {
            material[key] = cloneTexture(material[key]);
        }
    });
}

function cloneMaterial(material) {
    if (Array.isArray(material)) return material.map(cloneMaterial);

    if (!material?.isMaterial) return new THREE.MeshStandardMaterial();

    const next = material.clone();
    cloneMaterialTextures(next);
    return next;
}

function toMaterialArray(material) {
    return Array.isArray(material) ? material : [material];
}

function ensureStandardMaterial(material) {
    if (material instanceof THREE.MeshStandardMaterial) return material;

    const next = new THREE.MeshStandardMaterial();

    if (material?.color) next.color.copy(material.color);
    if (material?.map) next.map = material.map;
    if (material?.normalMap) next.normalMap = material.normalMap;
    if (material?.roughnessMap) next.roughnessMap = material.roughnessMap;
    if (material?.metalnessMap) next.metalnessMap = material.metalnessMap;
    if (material?.aoMap) next.aoMap = material.aoMap;
    
    if (typeof material?.roughness === "number") next.roughness = material.roughness;
    if (typeof material?.metalness === "number") next.metalness = material.metalness;
    if (typeof material?.aoMapIntensity === "number") next.aoMapIntensity = material.aoMapIntensity;
    
    if (material?.emissive) next.emissive.copy(material.emissive);
    if (typeof material?.emissiveIntensity === "number") next.emissiveIntensity = material.emissiveIntensity;
    if (material?.normalScale) next.normalScale.copy(material.normalScale);
    if (typeof material?.transparent === "boolean") next.transparent = material.transparent;
    if (typeof material?.opacity === "number") next.opacity = material.opacity;
    if (typeof material?.side === "number") next.side = material.side;

    return next;
}

function initializeMeshMaterial(mesh) {
    const uniqueMaterial = cloneMaterial(mesh.material);
    const normalizedMaterial = Array.isArray(uniqueMaterial)
        ? uniqueMaterial.map(ensureStandardMaterial)
        : ensureStandardMaterial(uniqueMaterial);

    mesh.material = normalizedMaterial;
    mesh.userData.baseMaterial = cloneMaterial(normalizedMaterial);
}

function applyTextureRepeat(texture, repeat) {
    if (!texture?.isTexture) return;

    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat, repeat);
    texture.needsUpdate = true;
}

function getActivePbrSet(meshSetState) {
    const sets = meshSetState?.sets ?? [];
    const activeSetId = meshSetState?.activeSetId ?? sets[0]?.id ?? null;

    return sets.find((pbrSet) => pbrSet.id === activeSetId) ?? sets[0] ?? null;
}

function applyMapsToMaterial(mesh, material, baseMaterial, pbrSet, isSelected) {
    const slots = pbrSet?.maps;
    const settings = pbrSet?.settings;
    const textureRepeat = settings?.textureRepeat ?? DEFAULT_PBR_SETTINGS.textureRepeat;
    const normalIntensity = settings?.normalIntensity ?? DEFAULT_PBR_SETTINGS.normalIntensity;

    if (baseMaterial?.color) material.color.copy(baseMaterial.color);

    material.map = baseMaterial?.map ?? null;
    material.normalMap = baseMaterial?.normalMap ?? null;
    material.roughnessMap = baseMaterial?.roughnessMap ?? null;
    material.metalnessMap = baseMaterial?.metalnessMap ?? null;
    material.aoMap = baseMaterial?.aoMap ?? null;
    
    // Reset to base or defaults before applying slots
    material.roughness = baseMaterial?.roughness ?? 1;
    material.metalness = baseMaterial?.metalness ?? 0;
    material.aoMapIntensity = baseMaterial?.aoMapIntensity ?? 1;
    
    material.side = baseMaterial?.side ?? THREE.FrontSide;
    material.normalScale.copy(baseMaterial?.normalScale ?? DEFAULT_NORMAL_SCALE);

    if (slots) {
        if ("map" in slots) material.map = slots.map ?? null;
        
        if ("normalMap" in slots) {
            material.normalMap = slots.normalMap ?? null;
        }
        
        if ("roughnessMap" in slots) {
            material.roughnessMap = slots.roughnessMap ?? null;
            if (material.roughnessMap) material.roughness = 1.0;
        }
        
        if ("metalnessMap" in slots) {
            material.metalnessMap = slots.metalnessMap ?? null;
            if (material.metalnessMap) material.metalness = 1.0;
        }
        
        if ("aoMap" in slots) {
            material.aoMap = slots.aoMap ?? null;
            if (material.aoMap) material.aoMapIntensity = 1.0;
        }

        if (Object.values(slots).some(Boolean)) {
            material.side = THREE.DoubleSide;
        }
    }

    applyTextureRepeat(material.map, textureRepeat);
    applyTextureRepeat(material.normalMap, textureRepeat);
    applyTextureRepeat(material.roughnessMap, textureRepeat);
    applyTextureRepeat(material.metalnessMap, textureRepeat);
    applyTextureRepeat(material.aoMap, textureRepeat);

    if (material.normalMap) {
        // If we have a map, we want at least 1.0 intensity as base, unless baseMaterial specifically had a different non-zero scale
        const baseScale = (baseMaterial?.normalScale && (baseMaterial.normalScale.x !== 0 || baseMaterial.normalScale.y !== 0))
            ? baseMaterial.normalScale
            : DEFAULT_NORMAL_SCALE;
            
        material.normalScale.copy(baseScale).multiplyScalar(normalIntensity);
    } else {
        material.normalScale.set(0, 0);
    }

    if (material.normalMap) {
        if (mesh.geometry.attributes.uv && !mesh.geometry.attributes.tangent) {
            try {
                mesh.geometry.computeTangents();
            } catch (e) {
                console.warn("Could not compute tangents for mesh", mesh.name, e);
            }
        }
    }

    if (material.aoMap && mesh.geometry.attributes.uv && !mesh.geometry.attributes.uv2) {
        mesh.geometry.setAttribute("uv2", mesh.geometry.attributes.uv);
    }

    if (baseMaterial?.emissive) material.emissive.copy(baseMaterial.emissive);
    material.emissiveIntensity = baseMaterial?.emissiveIntensity ?? 0;

    if (isSelected) {
        material.emissive.copy(HIGHLIGHT_COLOR);
        material.emissiveIntensity = Math.max(material.emissiveIntensity, 0.25);
    }

    material.needsUpdate = true;
}

const GlbModelPbr = memo(({ url }) => {
    const pbrSets = useProductConfigStore((state) => state.pbrSets);
    const selectedMeshId = useProductConfigStore((state) => state.selectedMeshId);
    const setMeshes = useProductConfigStore((state) => state.setMeshes);

    const { scene } = useGLTF(url);
    const cloned = useMemo(() => scene.clone(true), [scene]);

    useEffect(() => {
        const rawMeshes = [];
        const nameCounts = new Map();
        let meshIndex = 0;

        cloned.traverse((child) => {
            if (!child.isMesh) return;

            meshIndex += 1;
            child.userData.meshId = `mesh-${meshIndex}`;

            const name = child.name?.trim() || `Mesh ${String(meshIndex).padStart(2, "0")}`;
            rawMeshes.push({ id: child.userData.meshId, name });
            nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);

            initializeMeshMaterial(child);
        });

        const nameIndexes = new Map();
        const meshes = rawMeshes.map((mesh) => {
            const occurrence = (nameIndexes.get(mesh.name) ?? 0) + 1;
            nameIndexes.set(mesh.name, occurrence);

            return {
                ...mesh,
                label: (nameCounts.get(mesh.name) ?? 0) > 1 ? `${mesh.name} (${occurrence})` : mesh.name,
            };
        });

        setMeshes(meshes);
    }, [cloned, setMeshes]);

    useEffect(() => {
        console.log("[GlbModelPbr] Applying PBR sets update...");
        cloned.traverse((child) => {
            if (!child.isMesh) return;

            const pbrSet = getActivePbrSet(pbrSets[child.userData.meshId]);
            if (pbrSet?.maps && Object.keys(pbrSet.maps).length > 0) {
                console.log(`[GlbModelPbr] Mesh: ${child.name} has maps:`, Object.keys(pbrSet.maps));
            }
            
            const materials = toMaterialArray(child.material);
            const baseMaterials = toMaterialArray(child.userData.baseMaterial);

            materials.forEach((material, index) => {
                const baseMaterial = baseMaterials[index] ?? baseMaterials[0];
                applyMapsToMaterial(child, material, baseMaterial, pbrSet, selectedMeshId === child.userData.meshId);
            });
        });
    }, [cloned, pbrSets, selectedMeshId]);

    // Force re-render of primitive by using a key derived from pbrSets
    const pbrKey = useMemo(() => JSON.stringify(Object.keys(pbrSets)), [pbrSets]);

    return (
        <Center>
            <primitive key={pbrKey} object={cloned} />
        </Center>
    );
});

GlbModelPbr.displayName = "GlbModelPbr";
export default GlbModelPbr;
