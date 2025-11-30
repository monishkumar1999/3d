import React, { useState, useMemo, useLayoutEffect } from 'react';
import { useGLTF } from "@react-three/drei";
import * as THREE from 'three';
import DecalLayer from './DecalLayer';

const EditableModel = ({ modelUrl, layers, setLayers, selectedId, setIsDragging }) => {
  const gltf = useGLTF(modelUrl);
  
  // Clone scene to avoid issues when switching models
  const scene = useMemo(() => gltf.scene.clone(), [gltf.scene]);

  // Find the first Mesh
  const meshData = useMemo(() => {
    let found = null;
    scene.traverse((child) => {
      if (child.isMesh && !found) found = child;
    });
    return found;
  }, [scene]);

  // --- DRAG LOGIC (Surface Magnetism) ---
  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (selectedId) setIsDragging(true); // Tell parent to disable camera
  };

  const handlePointerUp = (e) => {
    e.stopPropagation();
    setIsDragging(false); // Tell parent to enable camera
  };

  const handlePointerMove = (e) => {
    if (!selectedId) return;
    
    // Only move if we are actively dragging (mouse down)
    // OR if we want "hover" placement (optional). 
    // Here we check for drag flag passed from parent or internal state if you prefer.
    if (e.buttons !== 1) return; // Only move on left click drag

    const { point, face } = e;
    if (!point || !face) return;

    // Calculate rotation to face surface normal
    const normal = face.normal.clone();
    normal.transformDirection(e.object.matrixWorld);
    const dummy = new THREE.Object3D();
    dummy.position.copy(point);
    dummy.lookAt(point.clone().add(normal));
    
    setLayers(prev => prev.map(l => {
      if (l.id === selectedId) {
        return { 
          ...l, 
          x: point.x, y: point.y, z: point.z, 
          rotX: dummy.rotation.x, rotY: dummy.rotation.y, rotZ: dummy.rotation.z 
        };
      }
      return l;
    }));
  };

  if (!meshData) return null;

  return (
    <primitive 
      object={scene}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
    >
      {/* Decals must be children of the mesh to work properly */}
      <mesh
        geometry={meshData.geometry}
        material={meshData.material}
        visible={false} // Invisible mesh just for targeting? No, use the primitive.
        // Actually, for Decals to work on <primitive>, we need to attach them to the mesh found.
        // But since we can't easily nest JSX inside a traverse result, 
        // we render the decals separately but use the 'mesh' prop or 
        // rely on the primitive catching the raycast and updating coordinates.
      />
      {layers.map((layer, index) => (
        <DecalLayer key={layer.id} layer={{...layer, order: index + 1}} />
      ))}
    </primitive>
  );
};

export default EditableModel;