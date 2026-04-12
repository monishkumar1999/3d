import React, { useImperativeHandle, forwardRef, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

const AICaptureRig = forwardRef((props, ref) => {
    const { gl, scene, camera } = useThree();

    // Save original camera state to restore later
    const originalState = useRef({ position: new THREE.Vector3(), rotation: new THREE.Euler() });

    const captureView = async (angleOffset) => {
        return new Promise((resolve) => {
            // Calculate position: Assume object is at 0,0,0
            // We revolve around Y axis.
            // Radius ? Let's use current camera radius or fixed?
            // "4 sides" implies Front, Right, Back, Left.

            // Let's use a fixed radius for consistency or try to maintain current zoom.
            const radius = 3; // Tune this to fit the model
            const height = 1.5; // Slightly elevated

            const x = radius * Math.sin(angleOffset);
            const z = radius * Math.cos(angleOffset);

            camera.position.set(x, height, z);
            camera.lookAt(0, 0, 0);
            camera.updateMatrixWorld();

            // Wait for render ?
            // We need to force a render to capture correctly
            // Use requestAnimationFrame to ensure frame is drawn?

            // Simple delay to allow camera update to settle and frame to render
            setTimeout(() => {
                gl.render(scene, camera);
                const dataUrl = gl.domElement.toDataURL('image/png');
                resolve(dataUrl);
            }, 50);
        });
    };

    useImperativeHandle(ref, () => ({
        captureAllViews: async () => {
            // 1. Save State
            originalState.current.position.copy(camera.position);
            originalState.current.rotation.copy(camera.rotation);

            // 2. Capture 4 sides
            // 0 = Front (Z+), PI/2 = Left (X+), PI = Back (Z-), 3PI/2 = Right (X-) 
            // NOTE: Depends on coordinate system.
            // Standard Threejs: Z+ is front? 

            const views = [];
            const angles = [0, Math.PI / 2, Math.PI, 3 * Math.PI / 2];

            for (const angle of angles) {
                const img = await captureView(angle);
                views.push(img);
            }

            // 3. Restore State
            camera.position.copy(originalState.current.position);
            camera.rotation.copy(originalState.current.rotation);
            camera.updateProjectionMatrix();

            return views; // [Front, Left, Back, Right]
        }
    }));

    return null;
});

export default AICaptureRig;
