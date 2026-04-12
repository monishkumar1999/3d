/**
 * GlbModelPbr.jsx — inside <Canvas>
 * Reads glbUrl, pbrMap, selectedMesh directly from the store.
 * Calls setMeshNames once after scene parse.
 */
import { memo, useEffect, useMemo } from "react";
import { useGLTF, Center } from "@react-three/drei";
import * as THREE from "three";
import { useProductConfigStore } from "../store/useProductConfigStore";

const GlbModelPbr = memo(({ url }) => {
    const pbrMap      = useProductConfigStore(s => s.pbrMap);
    const selectedMesh = useProductConfigStore(s => s.selectedMesh);
    const setMeshNames = useProductConfigStore(s => s.setMeshNames);

    const { scene }  = useGLTF(url);
    const cloned     = useMemo(() => scene.clone(true), [scene]);

    // ── Discover meshes once ──────────────────────────────────────
    useEffect(() => {
        const seen = new Set();
        const names = [];
        cloned.traverse(c => {
            if (c.isMesh && c.name && !seen.has(c.name)) {
                seen.add(c.name);
                names.push(c.name);
                if (!c.userData.origMat) c.userData.origMat = c.material.clone();
            }
        });
        setMeshNames(names);
    }, [cloned, setMeshNames]);

    // ── Apply PBR textures + selection highlight ──────────────────
    useEffect(() => {
        cloned.traverse(c => {
            if (!c.isMesh) return;

            if (!(c.material instanceof THREE.MeshStandardMaterial)) {
                c.material = new THREE.MeshStandardMaterial();
            }

            const slots = pbrMap[c.name];
            if (slots) {
                const mat = c.material;
                if (slots.map          !== undefined) mat.map          = slots.map;
                if (slots.normalMap    !== undefined) mat.normalMap    = slots.normalMap;
                if (slots.roughnessMap !== undefined) mat.roughnessMap = slots.roughnessMap;
                if (slots.metalnessMap !== undefined) mat.metalnessMap = slots.metalnessMap;
                if (slots.aoMap        !== undefined) {
                    mat.aoMap = slots.aoMap;
                    c.geometry.setAttribute("uv2", c.geometry.attributes.uv);
                }
                mat.side = THREE.DoubleSide;
            }

            // Indigo emissive tint on selected mesh
            c.material.emissive          = new THREE.Color(selectedMesh === c.name ? 0x4f46e5 : 0x000000);
            c.material.emissiveIntensity = selectedMesh === c.name ? 0.25 : 0;
            c.material.needsUpdate       = true;
        });
    }, [cloned, pbrMap, selectedMesh]);

    return <Center><primitive object={cloned} /></Center>;
});

GlbModelPbr.displayName = "GlbModelPbr";
export default GlbModelPbr;
