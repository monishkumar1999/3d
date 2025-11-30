import React, { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { 
  useGLTF, 
  Decal, 
  Environment, 
  Center, 
  useTexture, 
  AccumulativeShadows, 
  RandomizedLight,
  CameraControls,
  Html,
  Loader
} from "@react-three/drei";
import * as THREE from "three";
import { Joystick } from 'react-joystick-component'; 
import { 
  Layers, 
  PlusCircle, 
  Settings, 
  Trash2, 
  Maximize, 
  Eye, 
  Palette, 
  Camera,
  RotateCcw, // For Reset
  Undo2,     // For Undo
  Check,
  Type,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RefreshCw,
  Move
} from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

/* =========================================
   1. UTILS & CONSTANTS
   ========================================= */
const FALLBACK_TEXTURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

// Preset Camera Views
const CAMERA_VIEWS = {
  FRONT: { pos: [0, 0, 4], target: [0, 0, 0] },
  BACK: { pos: [0, 0, -4], target: [0, 0, 0] },
  LEFT_SLEEVE: { pos: [-3, 0, 0], target: [0, 0, 0] },
  RIGHT_SLEEVE: { pos: [3, 0, 0], target: [0, 0, 0] },
};

const createTextTexture = (text, color = "black") => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 1024;
  canvas.height = 1024;
  ctx.clearRect(0, 0, 1024, 1024);
  ctx.fillStyle = color;
  ctx.font = "bold 180px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 512, 512);
  return canvas.toDataURL('image/png');
};

/* =========================================
   2. 3D COMPONENTS
   ========================================= */

const DecalLayer = ({ layer }) => {
  const texture = useTexture(layer.url || FALLBACK_TEXTURE);
  
  return (
    <Decal
      position={[layer.x, layer.y, layer.z]}
      rotation={[layer.rotX || 0, layer.rotY || 0, layer.rotZ || 0]}
      scale={[layer.scale, layer.scale, layer.depth || 0.2]} 
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
        side={THREE.FrontSide} // Prevents projection on the back
        name="DecalMaterial"   // Crucial: Used to exclude this from color updates
      />
    </Decal>
  );
};

const EditableModel = ({ modelUrl, layers, setLayers, selectedId, setIsDragging, onLayerChange }) => {
  const gltf = useGLTF(modelUrl);
  const scene = useMemo(() => gltf.scene.clone(), [gltf.scene]);
  
  // Find Main Mesh
  const meshData = useMemo(() => {
    let found = null;
    scene.traverse((child) => {
      if (child.isMesh && !found) found = child;
    });
    return found;
  }, [scene]);

  // Drag Logic
  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (selectedId) setIsDragging(true);
  };

  const handlePointerUp = (e) => {
    e.stopPropagation();
    setIsDragging(false);
    // Trigger history save on drag end if needed
    if(selectedId && onLayerChange) onLayerChange(); 
  };

  const handlePointerMove = (e) => {
    if (!selectedId) return;
    if (e.pointerType === 'mouse' && e.buttons !== 1) return; 

    const { point, face } = e;
    if (!point || !face) return;

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
    <mesh
      geometry={meshData.geometry}
      material={meshData.material} 
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerMove={handlePointerMove}
      castShadow
      receiveShadow
    >
      {/* Render Decals */}
      {layers.map((layer, index) => (
        <DecalLayer key={layer.id} layer={{...layer, order: index + 1}} />
      ))}
    </mesh>
  );
};

// Fixed: Correctly identifies shirt material vs decal material
const ShirtColorUpdater = ({ color }) => {
  const { scene } = useThree();
  useEffect(() => {
    scene.traverse((child) => {
      if (child.isMesh && child.material) {
        // If it's the specific Decal material, SKIP it
        if (child.material.name === 'DecalMaterial') return;
        
        // Otherwise, assume it's the shirt fabric and color it
        child.material.color.set(color);
      }
    });
  }, [color, scene]);
  return null;
}

function ScreenshotHandler({ takeScreenshot, onCaptured }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (takeScreenshot) {
      gl.render(scene, camera);
      const data = gl.domElement.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `design-${Date.now()}.png`;
      link.href = data;
      link.click();
      onCaptured();
    }
  }, [takeScreenshot]);
  return null;
}

/* =========================================
   3. MAIN APP COMPONENT
   ========================================= */

export default function ProTShirtStudio() {
  const [modelUrl, setModelUrl] = useState(null);
  
  // State
  const [layers, setLayers] = useState([]);
  const [history, setHistory] = useState([]); // Undo Stack
  const [selectedId, setSelectedId] = useState(null);
  const [activePanel, setActivePanel] = useState('none');
  const [shirtColor, setShirtColor] = useState("#ffffff");
  
  // Camera & Interaction
  const cameraRef = useRef();
  const [isDragging, setIsDragging] = useState(false);
  const [screenshotTrigger, setScreenshotTrigger] = useState(false);

  // --- HISTORY / UNDO ---
  const saveHistory = () => {
    setHistory(prev => [...prev.slice(-10), JSON.stringify(layers)]); // Keep last 10 states
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const lastState = JSON.parse(history[history.length - 1]);
    setLayers(lastState);
    setHistory(prev => prev.slice(0, -1));
    setSelectedId(null);
  };

  const handleReset = () => {
    if(window.confirm("Reset all designs?")) {
        saveHistory();
        setLayers([]);
        setShirtColor("#ffffff");
        setSelectedId(null);
    }
  };

  // --- ACTIONS ---
  
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      addLayer(url, "Image");
    }
  };

  const handleTextAdd = () => {
    const text = prompt("Enter text:", "Cool");
    if (text) {
      const url = createTextTexture(text);
      addLayer(url, text);
    }
  };

  const addLayer = (url, name) => {
    saveHistory(); // Save before adding
    const newLayer = {
      id: uuidv4(), name, url,
      x: 0, y: 0.04, z: 0.15,
      rotX: 0, rotY: 0, rotZ: 0,
      scale: 0.2, 
      opacity: 1, 
      depth: 0.2,
      visible: true,
    };
    setLayers([...layers, newLayer]);
    setSelectedId(newLayer.id);
    setActivePanel('edit');
  };

  const updateLayer = (prop, value) => {
    if (!selectedId) return;
    setLayers(prev => prev.map(l => l.id === selectedId ? { ...l, [prop]: value } : l));
  };

  // Camera Utils
  const handleZoom = (dir) => cameraRef.current?.dolly(dir * 0.5, true);
  const handleRotate = () => cameraRef.current?.rotate(Math.PI / 4, 0, true);
  const snapToView = (viewKey) => {
    const view = CAMERA_VIEWS[viewKey];
    if (cameraRef.current && view) {
      cameraRef.current.setLookAt(view.pos[0], view.pos[1], view.pos[2], view.target[0], view.target[1], view.target[2], true);
    }
  };

  // 1. Initial Uploader
  if (!modelUrl) {
    return (
      // Changed height to be relative to fit in dashboard
      <div className="flex flex-col items-center justify-center w-full h-[85vh] bg-neutral-900 text-white p-4 rounded-xl">
        <div className="border-2 border-dashed border-neutral-700 p-8 rounded-3xl text-center bg-white/5 max-w-sm w-full shadow-2xl">
          <div className="text-6xl mb-6">👕</div>
          <h2 className="text-3xl font-black mb-2 tracking-tight">Pro Studio</h2>
          <p className="text-neutral-400 mb-8 font-medium">Upload .GLB to begin</p>
          <label className="bg-blue-600 hover:bg-blue-500 transition-all py-4 px-8 rounded-2xl cursor-pointer font-bold flex items-center justify-center gap-3 shadow-lg hover:shadow-blue-500/30 w-full transform hover:scale-105 active:scale-95 duration-200">
            <span>Select 3D Model</span>
            <input type="file" accept=".glb,.gltf" className="hidden" onChange={(e) => {
              const file = e.target.files[0];
              if(file) setModelUrl(URL.createObjectURL(file));
            }}/>
          </label>
        </div>
      </div>
    );
  }

  const selectedLayer = layers.find(l => l.id === selectedId);

  return (
    // MAIN CONTAINER: Relative positioning ensures it respects parent sidebar layout
    <div className="relative w-full h-[85vh] bg-[#111] text-white font-sans overflow-hidden select-none touch-none rounded-xl shadow-2xl">
      
      {/* HEADER BAR */}
      <div className="absolute top-0 left-0 right-0 h-16 px-5 flex justify-between items-center z-50 bg-gradient-to-b from-black/90 to-transparent pointer-events-none">
        <div className="font-black text-xl tracking-wider text-white drop-shadow-md flex items-center gap-2 pointer-events-auto">
          <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"/>
          STUDIO
        </div>
        
        {/* Top Right Actions */}
        <div className="flex gap-2 pointer-events-auto">
            <button title="Undo" onClick={handleUndo} disabled={history.length === 0} className="w-10 h-10 bg-white/10 border border-white/20 rounded-full flex items-center justify-center backdrop-blur-md active:scale-95 disabled:opacity-30 transition-transform">
                <Undo2 size={18}/>
            </button>
            <button title="Reset All" onClick={handleReset} className="w-10 h-10 bg-red-500/20 border border-red-500/30 text-red-400 rounded-full flex items-center justify-center backdrop-blur-md active:scale-95 transition-transform">
                <RotateCcw size={18}/>
            </button>
        </div>
      </div>

      {/* SNAP VIEWS - Top Left (Positioned to avoid sidebar overlap) */}
      <div className="absolute left-4 top-20 flex flex-col gap-2 z-[40]">
        <div className="text-[10px] font-bold text-neutral-500 tracking-widest mb-1">VIEWS</div>
        <ViewBtn label="Front" onClick={() => snapToView('FRONT')} />
        <ViewBtn label="Back" onClick={() => snapToView('BACK')} />
        <ViewBtn label="L. Arm" onClick={() => snapToView('LEFT_SLEEVE')} />
        <ViewBtn label="R. Arm" onClick={() => snapToView('RIGHT_SLEEVE')} />
      </div>

      {/* CAMERA CONTROLS - Right Side */}
      <div className="absolute right-4 top-20 flex flex-col gap-3 z-[40]">
        <div className="text-[10px] font-bold text-neutral-500 tracking-widest mb-1">CAM</div>
        <ControlBtn icon={ZoomIn} onClick={() => handleZoom(1)} />
        <ControlBtn icon={ZoomOut} onClick={() => handleZoom(-1)} />
        <ControlBtn icon={RefreshCw} onClick={handleRotate} />
        <ControlBtn icon={Camera} onClick={() => setScreenshotTrigger(true)} active />
      </div>

      {/* 3D CANVAS */}
      <Canvas shadows camera={{ position: [0, 0, 4], fov: 35 }}>
        <ambientLight intensity={0.7} />
        <Environment preset="city" />
        <Center>
          <Suspense fallback={<Html center><div className="text-white font-bold animate-pulse text-xl">LOADING...</div></Html>}>
            <EditableModel 
              modelUrl={modelUrl} 
              layers={layers} 
              setLayers={setLayers}
              selectedId={selectedId}
              setIsDragging={setIsDragging}
              onLayerChange={saveHistory} // Save history on drag end
            />
            {/* Color Updater */}
            <ShirtColorUpdater color={shirtColor} />
          </Suspense>
        </Center>
        <CameraControls ref={cameraRef} makeDefault enabled={!isDragging} minDistance={1} maxDistance={8} dollySpeed={0.5} smoothTime={0.25} />
        <ScreenshotHandler takeScreenshot={screenshotTrigger} onCaptured={() => setScreenshotTrigger(false)} />
      </Canvas>

      {/* JOYSTICK (Bottom Left - Floating) */}
      {selectedId && (
        <div className="absolute bottom-28 left-6 z-30 opacity-80 hover:opacity-100 transition-opacity">
           <Joystick 
             size={80} 
             baseColor="rgba(255,255,255,0.1)" 
             stickColor="#3b82f6" 
             move={(e) => {
                if(!selectedId) return;
                setLayers(prev => prev.map(l => {
                  if(l.id === selectedId) return { ...l, x: l.x + (e.x * 0.005), y: l.y + (e.y * 0.005) };
                  return l;
                }));
             }} 
             stop={saveHistory} // Save history when joystick released
             throttle={10}
           />
           <div className="text-center text-[10px] text-neutral-400 mt-2 font-bold tracking-wide">MOVE</div>
        </div>
      )}

      {/* BOTTOM PANELS */}
      <div 
        className={`absolute bottom-[85px] left-0 right-0 bg-[#111]/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl z-40 transition-transform duration-300 ease-out overflow-hidden shadow-2xl ${activePanel === 'none' ? 'translate-y-full' : 'translate-y-0'}`}
        style={{ maxHeight: '60vh' }}
      >
         <div className="w-full flex justify-center pt-3 pb-1 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setActivePanel('none')}>
            <div className="w-12 h-1.5 bg-white/20 rounded-full" />
         </div>
         
         <div className="p-6">
            {activePanel === 'upload' && (
                <div className="grid grid-cols-2 gap-4">
                    <label className="bg-neutral-800 hover:bg-neutral-700 p-6 rounded-2xl flex flex-col items-center gap-3 cursor-pointer transition-all active:scale-95 border border-white/5">
                        <ImageIcon size={32} className="text-blue-400"/>
                        <span className="text-sm font-bold">Add Sticker</span>
                        <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
                    </label>
                    <button onClick={handleTextAdd} className="bg-neutral-800 hover:bg-neutral-700 p-6 rounded-2xl flex flex-col items-center gap-3 border border-white/5 text-white transition-all active:scale-95">
                        <Type size={32} className="text-green-400"/>
                        <span className="text-sm font-bold">Add Text</span>
                    </button>
                </div>
            )}

            {activePanel === 'color' && (
                <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Shirt Color</h3>
                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                        {['#ffffff', '#000000', '#ff0000', '#0000ff', '#ffff00', '#008000', '#800080', '#ffa500', '#333333', '#1a1a1a', '#550000', '#003300'].map(c => (
                            <button 
                                key={c} 
                                onClick={() => setShirtColor(c)} 
                                className={`w-14 h-14 rounded-full border-2 shadow-lg flex-shrink-0 transition-transform active:scale-90 ${shirtColor === c ? 'border-blue-500 scale-110' : 'border-white/10'}`}
                                style={{backgroundColor: c}}
                            />
                        ))}
                    </div>
                </div>
            )}

            {activePanel === 'edit' && selectedLayer && (
                <div className="space-y-6">
                    <div className="flex justify-between items-center border-b border-white/10 pb-4">
                        <h3 className="font-bold text-xl truncate max-w-[200px]">{selectedLayer.name}</h3>
                        <button 
                            onClick={() => { 
                                saveHistory();
                                setLayers(prev => prev.filter(l => l.id !== selectedId)); 
                                setSelectedId(null); 
                                setActivePanel('none'); 
                            }} 
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 p-3 rounded-xl transition-colors"
                        >
                            <Trash2 size={20}/>
                        </button>
                    </div>
                    <div className="space-y-6">
                        <SliderControl label="Scale" value={selectedLayer.scale} min={0.05} max={2.0} step={0.01} onChange={v => updateLayer('scale', v)} />
                        <SliderControl label="Rotate" value={Math.round((selectedLayer.rotZ || 0) * (180/Math.PI))} min={-180} max={180} step={1} onChange={v => updateLayer('rotZ', v * (Math.PI/180))} displayValue={`${Math.round((selectedLayer.rotZ || 0) * (180/Math.PI))}°`}/>
                        
                        <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/20">
                            <SliderControl 
                                label="Wrap (Depth)" value={selectedLayer.depth || 0.2} min={0.1} max={1.5} step={0.1} onChange={v => updateLayer('depth', v)} 
                                displayValue={selectedLayer.depth > 0.6 ? "Full Wrap" : "Flat"}
                            />
                            <p className="text-[10px] text-blue-300 mt-2 text-center">Increase to wrap around sleeves. Keep low for chest.</p>
                        </div>
                        <SliderControl label="Opacity" value={selectedLayer.opacity} min={0.1} max={1} step={0.1} onChange={v => updateLayer('opacity', v)} displayValue={`${(selectedLayer.opacity * 100).toFixed(0)}%`}/>
                    </div>
                </div>
            )}
            
            {activePanel === 'layers' && (
                <div className="space-y-3">
                <h3 className="font-bold text-lg mb-4 flex items-center justify-between">
                    <span>Your Designs</span>
                    <span className="text-xs bg-white/10 px-2 py-1 rounded text-neutral-400">{layers.length}</span>
                </h3>
                {layers.length === 0 && <p className="text-neutral-500 text-center py-8 border-2 border-dashed border-white/5 rounded-2xl">No layers yet. Click + to add one.</p>}
                {layers.map(l => (
                    <div key={l.id} onClick={() => { setSelectedId(l.id); setActivePanel('edit'); }} className={`flex items-center justify-between p-4 rounded-xl border transition-all active:scale-[0.98] cursor-pointer ${selectedId === l.id ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-900/20' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                        <div className="flex items-center gap-4">
                            <img src={l.url} className="w-10 h-10 rounded-lg bg-white/10 object-contain p-1" alt="" />
                            <span className="font-medium text-sm">{l.name}</span>
                        </div>
                        {selectedId === l.id && <Check size={20} className="text-blue-400"/>}
                    </div>
                ))}
                </div>
            )}
         </div>
      </div>

      {/* BOTTOM NAV BAR */}
      <div className="absolute bottom-0 left-0 right-0 h-[85px] bg-[#141414]/95 backdrop-blur-xl border-t border-white/10 flex justify-around items-start pt-4 z-50 pb-[env(safe-area-inset-bottom)]">
         <NavButton icon={Layers} label="Layers" active={activePanel === 'layers'} onClick={() => setActivePanel(activePanel === 'layers' ? 'none' : 'layers')} />
         
         <div className="relative -top-8">
            <button 
                onClick={() => setActivePanel('upload')}
                className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-[0_0_20px_rgba(59,130,246,0.5)] active:scale-95 transition-transform hover:scale-105"
            >
                <PlusCircle size={32} />
            </button>
         </div>
         
         <NavButton icon={Palette} label="Color" active={activePanel === 'color'} onClick={() => setActivePanel(activePanel === 'color' ? 'none' : 'color')} />
      </div>

    </div>
  );
}

// --- SUB-COMPONENTS ---

const ControlBtn = ({ icon: Icon, onClick, active }) => (
  <button 
    onClick={onClick} 
    className={`w-12 h-12 rounded-full border border-white/20 text-white flex items-center justify-center backdrop-blur-md shadow-lg active:scale-90 transition-all ${active ? 'bg-blue-600 border-blue-400' : 'bg-white/10 hover:bg-white/20'}`}
  >
    <Icon size={20} />
  </button>
);

const ViewBtn = ({ label, onClick }) => (
  <button 
    onClick={onClick} 
    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-white hover:bg-white/10 active:scale-95 transition-all text-center min-w-[60px]"
  >
    {label}
  </button>
);

const NavButton = ({ icon: Icon, label, onClick, active }) => (
  <button onClick={onClick} className={`flex flex-col items-center gap-1.5 w-16 transition-colors ${active ? 'text-blue-400' : 'text-neutral-500 hover:text-neutral-300'}`}>
    <Icon size={24} strokeWidth={active ? 2.5 : 2} />
    <span className="text-[10px] font-bold tracking-wide">{label}</span>
  </button>
);

const SliderControl = ({ label, value, min, max, step, onChange, displayValue }) => (
    <div className="space-y-3">
        <div className="flex justify-between text-sm font-medium">
            <span className="text-neutral-400">{label}</span>
            <span className="text-white bg-white/10 px-2 py-0.5 rounded text-xs">{displayValue || value}</span>
        </div>
        <input 
            type="range" min={min} max={max} step={step} value={value} 
            onChange={e => onChange(parseFloat(e.target.value))} 
            className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-blue-500 hover:accent-blue-400 transition-all"
        />
    </div>
);