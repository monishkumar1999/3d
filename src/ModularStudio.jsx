import React, { useState, useMemo, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { 
  useGLTF, Decal, Environment, OrbitControls, Center, useTexture, AccumulativeShadows, RandomizedLight 
} from "@react-three/drei";
import { Joystick } from 'react-joystick-component'; 
import { Upload, Type, Image as ImageIcon, Box, Trash2, ArrowLeft } from "lucide-react";
import { v4 as uuidv4 } from 'uuid';
import * as THREE from 'three';

// --- UTILS ---
const FALLBACK_TEXTURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

// Helper: Convert Text to an Image URL (for Decals)
const createTextTexture = (text, color="black") => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 1024;
  canvas.height = 1024;
  
  // Clear
  ctx.clearRect(0, 0, 1024, 1024);
  
  // Draw Text
  ctx.fillStyle = color;
  ctx.font = "bold 200px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 512);
  
  return canvas.toDataURL('image/png');
};

/* =========================================
   COMPONENT 1: MODEL UPLOADER
   (Getting the GLB File)
   ========================================= */
const ModelUploader = ({ onUpload }) => {
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column', 
      alignItems: 'center', justifyContent: 'center', background: '#121212', color: 'white'
    }}>
      <div style={{
        border: '2px dashed #333', padding: 50, borderRadius: 20, 
        textAlign: 'center', background: 'rgba(255,255,255,0.05)'
      }}>
        <Box size={64} style={{marginBottom: 20, color: '#3b82f6'}} />
        <h2 style={{margin:0}}>Upload your 3D Model</h2>
        <p style={{color: '#888', marginBottom: 20}}>.GLB or .GLTF files only</p>
        <label style={{
          background: '#3b82f6', padding: '12px 24px', borderRadius: 8, 
          cursor: 'pointer', fontWeight: 'bold', display: 'inline-block'
        }}>
          Select File
          <input 
            type="file" 
            accept=".glb,.gltf" 
            style={{display:'none'}} 
            onChange={(e) => {
              const file = e.target.files[0];
              if(file) onUpload(URL.createObjectURL(file));
            }}
          />
        </label>
      </div>
    </div>
  );
};

/* =========================================
   COMPONENT 2: ASSET PANEL
   (Image Upload & Text Upload)
   ========================================= */
const AssetPanel = ({ onAddLayer, layers, setLayers, selectedId, setSelectedId }) => {
  
  // Handle Image File
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onAddLayer({ type: 'image', url, name: 'Image Layer' });
  };

  // Handle Text Creation
  const handleTextAdd = () => {
    const text = prompt("Enter text:", "HELLO");
    if (!text) return;
    const url = createTextTexture(text);
    onAddLayer({ type: 'text', url, name: `Text: ${text}` });
  };

  return (
    <div style={{
      width: 300, background: '#1a1a1a', borderRight: '1px solid #333', 
      display: 'flex', flexDirection: 'column', padding: 20, gap: 20
    }}>
      <h3 style={{color:'white', margin:0}}>Assets</h3>
      
      {/* Upload Buttons */}
      <div style={{display: 'flex', gap: 10}}>
        <label style={{
          flex:1, background: '#333', padding: 15, borderRadius: 8, 
          cursor: 'pointer', textAlign: 'center', color:'white'
        }}>
          <ImageIcon size={24} style={{marginBottom:5}}/>
          <div style={{fontSize:12}}>Image</div>
          <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
        </label>
        
        <button 
          onClick={handleTextAdd}
          style={{
            flex:1, background: '#333', padding: 15, borderRadius: 8, 
            border:'none', cursor: 'pointer', color:'white'
          }}
        >
          <Type size={24} style={{marginBottom:5}}/>
          <div style={{fontSize:12}}>Text</div>
        </button>
      </div>

      {/* Layers List */}
      <div style={{flex:1, overflowY:'auto'}}>
        <h4 style={{color:'#666', fontSize:12, textTransform:'uppercase'}}>Layers</h4>
        {layers.map(layer => (
           <div 
             key={layer.id}
             onClick={() => setSelectedId(layer.id)}
             style={{
               padding: 10, marginBottom: 8, borderRadius: 6,
               background: selectedId === layer.id ? '#3b82f6' : '#222',
               color: 'white', fontSize: 13, display: 'flex', alignItems: 'center', gap: 10,
               cursor: 'pointer'
             }}
           >
             <img src={layer.url} style={{width: 24, height: 24, objectFit:'contain', background:'white', borderRadius:4}} />
             <span style={{flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{layer.name}</span>
             <Trash2 size={14} onClick={(e) => {
               e.stopPropagation();
               setLayers(prev => prev.filter(l => l.id !== layer.id));
             }}/>
           </div>
        ))}
      </div>
    </div>
  );
};

/* =========================================
   COMPONENT 3: WORKSPACE 3D
   (The Edit Place)
   ========================================= */

// Internal Sub-component for the specific Model
const EditableModel = ({ modelUrl, layers, setLayers, selectedId }) => {
  const gltf = useGLTF(modelUrl);
  
  // Find the mesh inside the GLB
  const meshData = useMemo(() => {
    let found = null;
    gltf.scene.traverse((child) => {
      if (child.isMesh && !found) found = child;
    });
    return found;
  }, [gltf.scene]);

  // Handle Joystick Move (Updates selected layer position)
  const handleMove = (e) => {
    if (!selectedId) return;
    setLayers(prev => prev.map(l => {
      if (l.id === selectedId) {
        return { ...l, x: l.x + (e.x * 0.01), y: l.y + (e.y * 0.01) };
      }
      return l;
    }));
  };

  if (!meshData) return null;

  return (
    <>
      <mesh 
        geometry={meshData.geometry} 
        material={meshData.material} 
        castShadow 
        receiveShadow
      >
        {layers.map((layer, index) => (
          <DecalLayer key={layer.id} layer={{...layer, order: index + 1}} />
        ))}
      </mesh>
      
      {/* Joystick is technically UI, but lives "in context" of the 3D workspace */}
      {selectedId && (
        <Html position={[0, -1, 0]}> 
          <div style={{position:'fixed', bottom: 50, left: '50%', transform: 'translateX(-50%)'}}>
            <Joystick size={100} baseColor="rgba(0,0,0,0.5)" stickColor="#3b82f6" move={handleMove} throttle={10} />
          </div>
        </Html>
      )}
    </>
  );
};

const DecalLayer = ({ layer }) => {
  const texture = useTexture(layer.url || FALLBACK_TEXTURE);
  return (
    <Decal
      position={[layer.x, layer.y, layer.z]}
      rotation={[0,0,0]}
      scale={[layer.scale, layer.scale, 1.2]}
    >
      <meshStandardMaterial 
        map={texture} 
        transparent 
        polygonOffset 
        polygonOffsetFactor={-1 * layer.order} 
      />
    </Decal>
  );
};

const Workspace3D = ({ modelUrl, layers, setLayers, selectedId }) => {
  return (
    <div style={{flex: 1, position: 'relative', background: '#000'}}>
      <Canvas shadows camera={{ position: [0, 0, 1], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <Environment preset="city" />
        <Center>
          <Suspense fallback={null}>
            <EditableModel 
              modelUrl={modelUrl} 
              layers={layers} 
              setLayers={setLayers}
              selectedId={selectedId} 
            />
          </Suspense>
        </Center>
        <OrbitControls makeDefault />
      </Canvas>
    </div>
  );
};


/* =========================================
   COMPONENT 4: MAIN LAYOUT (StudioLayout)
   (The Parent that holds everything)
   ========================================= */
export default function ModularStudio() {
  const [modelUrl, setModelUrl] = useState(null);
  const [layers, setLayers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const addLayer = ({ type, url, name }) => {
    const newLayer = {
      id: uuidv4(),
      type,
      name,
      url,
      x: 0, y: 0.1, z: 0.15, // Default position
      scale: 0.2,
      opacity: 1
    };
    setLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
  };

  // State 1: No Model -> Show Uploader
  if (!modelUrl) {
    return <ModelUploader onUpload={setModelUrl} />;
  }

  // State 2: Model Loaded -> Show Workspace
  return (
    <div style={{display: 'flex', height: '100vh', width: '100vw'}}>
      
      {/* Left: Asset Panel */}
      <AssetPanel 
        onAddLayer={addLayer} 
        layers={layers} 
        setLayers={setLayers}
        selectedId={selectedId} 
        setSelectedId={setSelectedId}
      />

      {/* Right: 3D Workspace */}
      <div style={{flex: 1, display: 'flex', flexDirection: 'column'}}>
        
        {/* Top Bar */}
        <div style={{
          height: 50, background: '#1a1a1a', borderBottom: '1px solid #333', 
          display: 'flex', alignItems: 'center', padding: '0 20px', color: 'white'
        }}>
           <button onClick={() => setModelUrl(null)} style={{background:'none', border:'none', color:'#888', cursor:'pointer', display:'flex', alignItems:'center', gap:5}}>
             <ArrowLeft size={16}/> Change Model
           </button>
        </div>

        {/* The 3D Editor */}
        <Workspace3D 
          modelUrl={modelUrl} 
          layers={layers} 
          setLayers={setLayers}
          selectedId={selectedId}
        />
      </div>
    </div>
  );
}