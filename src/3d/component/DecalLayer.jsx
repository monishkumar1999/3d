import React from 'react';
import { Decal, useTexture } from "@react-three/drei";
import { FALLBACK_TEXTURE } from '../utils/helpers';

const DecalLayer = ({ layer }) => {
  const texture = useTexture(layer.url || FALLBACK_TEXTURE);
  
  return (
    <Decal
      position={[layer.x, layer.y, layer.z]}
      rotation={[layer.rotX || 0, layer.rotY || 0, layer.rotZ || 0]}
      // CRITICAL: Z-scale 1.2 ensures deep projection into cloth wrinkles
      scale={[layer.scale, layer.scale, 1.2]} 
    >
      <meshStandardMaterial 
        map={texture} 
        transparent 
        opacity={layer.opacity} 
        polygonOffset 
        polygonOffsetFactor={-1 * layer.order} 
        depthTest={true}
        depthWrite={false}
        roughness={0.5}
      />
    </Decal>
  );
};

export default DecalLayer;