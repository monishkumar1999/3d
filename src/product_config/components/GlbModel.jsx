import { memo, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { Center } from "@react-three/drei";

const GlbModel = memo(({ url, onMeshesFound }) => {
    const { scene } = useGLTF(url);

    useEffect(() => {
        const seen = new Set();
        const names = [];
        scene.traverse((child) => {
            if (child.isMesh && child.name && !seen.has(child.name)) {
                seen.add(child.name);
                names.push(child.name);
            }
        });
        onMeshesFound(names);
    }, [scene, onMeshesFound]);

    return (
        <Center>
            <primitive object={scene} />
        </Center>
    );
});

GlbModel.displayName = "GlbModel";
export default GlbModel;
