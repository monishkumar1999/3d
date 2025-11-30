import React, { Suspense, useRef } from 'react';
import { Canvas } from "@react-three/fiber";
import { Environment, Center, CameraControls, Html, useProgress, Loader } from "@react-three/drei";
import { ZoomIn, ZoomOut, RefreshCw, RotateCcw } from "lucide-react";
import EditableModel from './EditableModel';

const Workspace3D = ({ modelUrl, layers, setLayers, selectedId, setSelectedId }) => {
  const cameraRef = useRef();
  
  // Button Handlers
  const handleZoom = (dir) => {
    // dir: 1 = Zoom In (Move closer), -1 = Zoom Out (Move away)
    // dolly moves the camera forward/backward
    cameraRef.current?.dolly(dir * 0.5, true);
  };
  
  const handleRotate = () => {
    // Rotate 45 degrees horizontally
    cameraRef.current?.rotate(Math.PI / 4, 0, true);
  };
  
  const handleReset = () => {
    cameraRef.current?.reset(true);
  };

  // Disable controls when dragging logic is active
  const [isDragging, setIsDragging] = React.useState(false);

  return (
    <div style={{flex: 1, position: 'relative', background: 'radial-gradient(circle, #2a2a2a 0%, #000 100%)'}}>
      
      {/* 1. VIEW BUTTONS (Overlay) */}
      <div style={{
        position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', 
        zIndex: 100, // High Z-Index to show on mobile
        display: 'flex', flexDirection: 'column', gap: 15
      }}>
        <ControlBtn icon={ZoomIn} onClick={() => handleZoom(1)} />
        <ControlBtn icon={ZoomOut} onClick={() => handleZoom(-1)} />
        <ControlBtn icon={RefreshCw} onClick={handleRotate} />
        <ControlBtn icon={RotateCcw} onClick={handleReset} />
      </div>

      {/* 2. CANVAS */}
      <Canvas shadows camera={{ position: [0, 0, 2], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <Environment preset="city" />
        
        <Center>
          <Suspense fallback={<Html center>Loading...</Html>}>
            <EditableModel 
              modelUrl={modelUrl} 
              layers={layers} 
              setLayers={setLayers}
              selectedId={selectedId}
              setIsDragging={setIsDragging}
            />
          </Suspense>
        </Center>
        
        {/* Active Camera Controls */}
        <CameraControls 
          ref={cameraRef} 
          makeDefault // Important: Makes this the default controller
          enabled={!isDragging} 
          minDistance={0.5} maxDistance={5} 
          dollySpeed={0.5} 
          smoothTime={0.25}
        />
      </Canvas>
    </div>
  );
};

const ControlBtn = ({ icon: Icon, onClick }) => (
  <button onClick={onClick} style={{
    width: 50, height: 50, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.2)',
    background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)', color: 'white',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
  }}>
    <Icon size={24} />
  </button>
);

export default Workspace3D;