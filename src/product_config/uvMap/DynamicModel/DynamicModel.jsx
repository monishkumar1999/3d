import React, { useMemo } from "react";
import { Center } from "@react-three/drei";
import { useSelector } from "react-redux";
import { useMeshDiscovery } from "./useMeshDiscovery";
import { useApplyBaseMaterial } from "./useApplyBaseMaterial";
import { useApplyStickerOverlay } from "./useApplyStickerOverlay";

const DynamicModel = React.memo(({
    url, meshTextures, baseTextures, pbrTextures, meshMaterials = {}, materialProps, showOriginal = false, setMeshList, onMeshLoaded
}) => {
    // 1. Get model and clone it once
    const { scene } = useGLTF_custom(url);
    
    const clonedScene = useMemo(() => {
        const s = scene.clone();
        s.traverse(child => {
            if (child.isMesh && !child.userData.originalMat) {
                child.userData.originalMat = child.material.clone();
            }
        });
        return s;
    }, [scene]);

    // 2. Select global material attributes from Redux
    const globalMaterial = useSelector(state => state.uvMap.globalMaterial);

    // 3. Hooks
    useMeshDiscovery(clonedScene, setMeshList, onMeshLoaded);
    useApplyBaseMaterial({
        clonedScene, baseTextures, pbrTextures, meshMaterials, materialProps, globalMaterial, showOriginal
    });
    useApplyStickerOverlay({
        clonedScene, meshTextures, meshMaterials, globalMaterial, showOriginal
    });

    return (
        <Center>
            <primitive object={clonedScene} />
        </Center>
    );
});

// A lightweight hook helper to load GLTF
import { useGLTF } from "@react-three/drei";
function useGLTF_custom(url) {
    return useGLTF(url);
}

export default DynamicModel;
export { useGLTF_custom };
