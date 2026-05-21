import { useEffect, useState } from "react";

export const useMeshDiscovery = (clonedScene, setMeshList, onMeshLoaded) => {
    const [meshes, setMeshes] = useState([]);
    
    useEffect(() => {
        const meshNames = [];
        clonedScene.traverse((child) => {
            if (child.isMesh) {
                meshNames.push(child.name);
            }
        });
        setMeshes(meshNames);
        if (setMeshList) {
            setMeshList((prev) => (prev.length === meshNames.length ? prev : [...new Set(meshNames)]));
        }
        if (onMeshLoaded) onMeshLoaded(clonedScene);
    }, [clonedScene, setMeshList, onMeshLoaded]);

    return meshes;
};
