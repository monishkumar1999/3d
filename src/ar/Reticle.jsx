/**
 * Reticle.jsx
 * 
 * Placement Indicator Ring Component for WebXR AR.
 * Renders a sleek 3D ring and central dot on detected real-world surfaces.
 * Uses linear/spherical interpolation (lerp/slerp) for smooth tracking.
 */

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export default function Reticle({ reticleDataRef }) {
    const meshRef = useRef(null);

    useFrame((state, delta) => {
        if (!meshRef.current) return;

        const currentData = reticleDataRef?.current;

        if (!currentData || !currentData.visible || !currentData.position || !currentData.quaternion) {
            meshRef.current.visible = false;
            return;
        }

        meshRef.current.visible = true;

        // Smooth position interpolation (lerp factor 0.25 for responsive & smooth movement)
        meshRef.current.position.lerp(currentData.position, 0.25);

        // Smooth rotation interpolation (slerp)
        meshRef.current.quaternion.slerp(currentData.quaternion, 0.25);
    });

    return (
        <group ref={meshRef} visible={false}>
            {/* Outer animated target ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
                <ringGeometry args={[0.18, 0.2, 32]} />
                <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} transparent opacity={0.85} />
            </mesh>

            {/* Inner subtle glow ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow={false}>
                <ringGeometry args={[0.08, 0.12, 32]} />
                <meshBasicMaterial color="#6366f1" side={THREE.DoubleSide} transparent opacity={0.6} />
            </mesh>

            {/* Center dot */}
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.02, 16]} />
                <meshBasicMaterial color="#4f46e5" side={THREE.DoubleSide} />
            </mesh>

            {/* Surface Direction Indicator Line */}
            <mesh position={[0, 0.001, -0.22]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[0.015, 0.06]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
            </mesh>
        </group>
    );
}
