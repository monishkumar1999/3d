import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { useGLTF, OrbitControls, Environment, Center } from "@react-three/drei";
import * as THREE from "three";
import { Stage, Layer, Image as KImage, Transformer, Rect } from "react-konva";

/* =========================================================
   1. UTILS: UV MAP GENERATOR (THE NEW FEATURE)
   ========================================================= */
// This function reads the 3D Mesh geometry and draws the UV layout on a 2D canvas
const generateUVMap = (mesh) => {
    if (!mesh || !mesh.geometry) return null;

    const width = 1024;
    const height = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Fill background (transparent)
    ctx.clearRect(0, 0, width, height);

    // Style for the wireframe
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)'; // Black lines
    ctx.lineWidth = 1;

    const uvAttribute = mesh.geometry.attributes.uv;
    const indexAttribute = mesh.geometry.index;

    if (indexAttribute) {
        // Indexed Geometry
        for (let i = 0; i < indexAttribute.count; i += 3) {
            const a = indexAttribute.getX(i);
            const b = indexAttribute.getX(i + 1);
            const c = indexAttribute.getX(i + 2);
            drawTriangle(ctx, uvAttribute, a, b, c, width, height);
        }
    } else {
        // Non-indexed Geometry
        for (let i = 0; i < uvAttribute.count; i += 3) {
            drawTriangle(ctx, uvAttribute, i, i + 1, i + 2, width, height);
        }
    }

    return canvas.toDataURL(); // Return as Image URL
};

const drawTriangle = (ctx, uv, a, b, c, w, h) => {
    const ax = uv.getX(a) * w;
    const ay = (1 - uv.getY(a)) * h; // Flip Y for Canvas
    const bx = uv.getX(b) * w;
    const by = (1 - uv.getY(b)) * h;
    const cx = uv.getX(c) * w;
    const cy = (1 - uv.getY(c)) * h;

    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.lineTo(cx, cy);
    ctx.closePath();
    ctx.stroke();
};

/* =========================================================
   2. STYLES & UI HELPERS
   ========================================================= */
const dotGridStyle = {
  backgroundColor: "#121212",
  backgroundImage: "radial-gradient(#333 1px, transparent 1px)",
  backgroundSize: "24px 24px",
};

const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);
  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { callback(...args); }, delay);
  }, [callback, delay]);
  return debouncedCallback;
};

const ToolButton = ({ icon, label, onClick, isActive }) => (
  <button
    onClick={onClick}
    className={`flex flex-col items-center justify-center w-full py-4 gap-1 transition-colors border-l-2
      ${isActive 
        ? "bg-[#1e1e1e] text-blue-400 border-blue-500" 
        : "text-zinc-500 hover:text-zinc-200 border-transparent hover:bg-[#1e1e1e]"
      }`}
  >
    <span className="text-2xl">{icon}</span>
    <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
  </button>
);

/* =========================================================
   3. 3D PREVIEW COMPONENT (WITH MATERIALS & EXTRACTOR)
   ========================================================= */
function DynamicModel({ url, activeMesh, meshTextures, meshScales, globalScale, materialProps, setMeshList, onMeshLoaded }) {
  const { scene } = useGLTF(url);
  const clonedScene = useMemo(() => scene.clone(), [scene]);

  useEffect(() => {
    const meshes = [];
    clonedScene.traverse((child) => {
      if (child.isMesh) {
        meshes.push(child.name);
        
        // --- TEXTURE APPLICATION ---
        if (meshTextures[child.name]) {
          const newMap = meshTextures[child.name];
          if (child.material.map && child.material.map.uuid !== newMap.uuid) {
             child.material.map.dispose();
          }
          if (!child.userData.originalMat) child.userData.originalMat = child.material.clone();
          child.material = child.userData.originalMat.clone();
          child.material.map = newMap;
          child.material.map.flipY = false; 
          child.material.map.colorSpace = THREE.SRGBColorSpace;
          child.material.needsUpdate = true;
        }

        // --- MATERIAL PROPERTIES (Roughness/Metalness) ---
        // Apply global material settings or specific ones if we built that logic
        if (materialProps) {
            // If we haven't textured it, ensure we use the base material but update props
            if (!meshTextures[child.name]) {
                 if (!child.userData.originalMat) child.userData.originalMat = child.material.clone();
                 child.material = child.userData.originalMat.clone();
            }
            child.material.roughness = materialProps.roughness;
            child.material.metalness = materialProps.metalness;
            child.material.wireframe = materialProps.wireframe;
            child.material.color.set(materialProps.color || "#ffffff");
            child.material.needsUpdate = true;
        }

        // --- SCALING ---
        const original = child.userData.originalScale || child.scale.clone();
        if (!child.userData.originalScale) child.userData.originalScale = original;

        if (meshScales[child.name]) {
            const { x, y, z } = meshScales[child.name];
            child.scale.set(original.x * x, original.y * y, original.z * z);
        } else {
            child.scale.copy(original);
        }
      }
    });
    setMeshList((prev) => (prev.length === meshes.length ? prev : [...new Set(meshes)]));
    
    // Pass the actual mesh object back up if needed for UV extraction
    if (onMeshLoaded) onMeshLoaded(clonedScene);

  }, [clonedScene, meshTextures, meshScales, materialProps, setMeshList, onMeshLoaded]);

  return (
    <Center>
        <primitive object={clonedScene} scale={[globalScale.x, globalScale.y, globalScale.z]} />
    </Center>
  );
}

/* =========================================================
   4. 2D EDITOR
   ========================================================= */
function WorkspaceEditor({ uvUrl, stickerUrl, backgroundUrl, onExport }) {
  const [uvImage, setUvImage] = useState(null);
  const [bgTexture, setBgTexture] = useState(null);
  const [stickersList, setStickersList] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  const stageRef = useRef(null);
  const trRef = useRef(null);
  const containerRef = useRef(null);

  const [stageSpec, setStageSpec] = useState({ 
      width: 0, height: 0, baseScale: 1, naturalWidth: 1024, naturalHeight: 1024, ready: false
  });

  const loadImage = (url, callback) => {
    if (!url) return;
    const img = new window.Image();
    img.crossOrigin = "Anonymous";
    img.src = url;
    img.onload = () => callback(img);
  };

  // Setup Canvas Dimensions
  useEffect(() => {
    if (!containerRef.current) return;
    
    // If no UV URL, we default to 1024x1024 square
    const imgW = uvImage ? uvImage.naturalWidth : 1024;
    const imgH = uvImage ? uvImage.naturalHeight : 1024;

    const containerW = containerRef.current.clientWidth || 800;
    const containerH = containerRef.current.clientHeight || 600;
    
    const scaleW = (containerW - 40) / imgW;
    const scaleH = (containerH - 40) / imgH;
    const baseScale = Math.min(scaleW, scaleH);

    setStageSpec({
        width: imgW * baseScale,
        height: imgH * baseScale,
        baseScale: baseScale,
        naturalWidth: imgW,
        naturalHeight: imgH,
        ready: true
    });

  }, [uvImage, containerRef.current?.clientWidth, containerRef.current?.clientHeight]);

  // Load UV Image whenever URL changes
  useEffect(() => {
      if (uvUrl) {
          loadImage(uvUrl, (img) => setUvImage(img));
      } else {
          setUvImage(null);
      }
  }, [uvUrl]);

  useEffect(() => { if (backgroundUrl) loadImage(backgroundUrl, (img) => setBgTexture(img)); }, [backgroundUrl]);

  useEffect(() => {
    if (!stickerUrl) return;
    loadImage(stickerUrl, (img) => {
        const newSticker = {
            id: Date.now().toString(),
            image: img,
            x: (stageSpec.naturalWidth / 2) - 100,
            y: (stageSpec.naturalHeight / 2) - 100,
            width: 200, height: 200, rotation: 0
        };
        setStickersList(prev => [...prev, newSticker]);
        setSelectedId(newSticker.id);
        triggerExport(); 
    });
  }, [stickerUrl]);

  useEffect(() => {
    if (selectedId && trRef.current && stageRef.current) {
        const node = stageRef.current.findOne('#' + selectedId);
        if (node) { trRef.current.nodes([node]); trRef.current.getLayer().batchDraw(); }
    } else if (trRef.current) { trRef.current.nodes([]); }
  }, [selectedId, stickersList]);

  useEffect(() => {
      const handleKeyDown = (e) => {
          if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
              setStickersList(prev => prev.filter(s => s.id !== selectedId));
              setSelectedId(null);
              triggerExport();
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId]);

  const performExport = () => {
    if (!stageRef.current) return;
    if (trRef.current) trRef.current.nodes([]);
    const uvNode = stageRef.current.findOne('#uv-overlay');
    if (uvNode) uvNode.visible(false);

    stageRef.current.batchDraw();

    const pixelRatio = 1 / (stageSpec.baseScale * zoomLevel);
    const uri = stageRef.current.toDataURL({ pixelRatio: pixelRatio });
    onExport(uri);
    
    if (uvNode) uvNode.visible(true);
    if (selectedId && trRef.current) {
         const node = stageRef.current.findOne('#' + selectedId);
         if (node) trRef.current.nodes([node]);
    }
    stageRef.current.batchDraw();
  };

  const triggerExport = useDebounce(performExport, 500);

  const checkDeselect = (e) => {
    const clickedOnEmpty = e.target === e.target.getStage() || e.target.attrs.id === 'bg-layer' || e.target.attrs.id === 'uv-overlay';
    if (clickedOnEmpty) setSelectedId(null);
  };

  const displayScale = stageSpec.baseScale * zoomLevel;
  const displayWidth = stageSpec.naturalWidth * displayScale;
  const displayHeight = stageSpec.naturalHeight * displayScale;

  return (
    <div className="w-full h-full flex flex-col relative">
      <div className="absolute top-4 right-4 z-20 flex gap-2 bg-black/60 rounded-lg p-1 backdrop-blur-md border border-white/10">
          <button onClick={() => setZoomLevel(z => Math.max(0.2, z - 0.1))} className="w-6 h-6 flex items-center justify-center text-white hover:bg-white/20 rounded">-</button>
          <span className="text-xs text-white w-8 text-center flex items-center justify-center">{Math.round(zoomLevel * 100)}%</span>
          <button onClick={() => setZoomLevel(z => Math.min(3, z + 0.1))} className="w-6 h-6 flex items-center justify-center text-white hover:bg-white/20 rounded">+</button>
      </div>

      <div ref={containerRef} className="flex-1 w-full flex items-center justify-center overflow-auto p-8 custom-scrollbar">
        {stageSpec.ready && (
            <div className="relative shadow-2xl transition-all duration-200" style={{ width: displayWidth, height: displayHeight }}>
                <Stage 
                    width={displayWidth} 
                    height={displayHeight} 
                    scaleX={displayScale}
                    scaleY={displayScale}
                    ref={stageRef}
                    onMouseDown={checkDeselect}
                    onTouchStart={checkDeselect}
                    onMouseUp={triggerExport}
                    onTouchEnd={triggerExport}
                >
                    <Layer>
                        {/* Transparent Background - relied on CSS or parent for color */}
                        <Rect width={stageSpec.naturalWidth} height={stageSpec.naturalHeight} fill="white" id="bg-layer" />
                        
                        {bgTexture && ( <KImage image={bgTexture} width={stageSpec.naturalWidth} height={stageSpec.naturalHeight} listening={false} /> )}
                        
                        {stickersList.map((sticker) => (
                            <KImage
                                key={sticker.id}
                                id={sticker.id}
                                image={sticker.image}
                                x={sticker.x} y={sticker.y}
                                width={sticker.width} height={sticker.height}
                                draggable
                                onClick={() => setSelectedId(sticker.id)}
                                onTap={() => setSelectedId(sticker.id)}
                                onDragEnd={(e) => {
                                    const idx = stickersList.findIndex(s => s.id === sticker.id);
                                    const newStickers = [...stickersList];
                                    newStickers[idx] = { ...newStickers[idx], x: e.target.x(), y: e.target.y() };
                                    setStickersList(newStickers);
                                    triggerExport();
                                }}
                                onTransformEnd={(e) => {
                                    const node = e.target;
                                    const idx = stickersList.findIndex(s => s.id === sticker.id);
                                    const newStickers = [...stickersList];
                                    const sX = node.scaleX(); const sY = node.scaleY();
                                    newStickers[idx] = { 
                                        ...newStickers[idx], x: node.x(), y: node.y(),
                                        width: Math.max(5, node.width() * sX), height: Math.max(5, node.height() * sY), rotation: node.rotation()
                                    };
                                    node.scaleX(1); node.scaleY(1);
                                    setStickersList(newStickers);
                                    triggerExport();
                                }}
                            />
                        ))}
                        
                        {/* UV WIREFRAME OVERLAY */}
                        {uvImage && <KImage id="uv-overlay" image={uvImage} opacity={0.6} listening={false} />}
                    </Layer>
                    <Layer><Transformer ref={trRef} borderStroke="#0099ff" anchorStroke="#0099ff" anchorFill="#ffffff" anchorSize={10} borderDash={[4, 4]} /></Layer>
                </Stage>
            </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   5. MAIN APP COMPONENT
   ========================================================= */
export default function ProTShirtStudio() {
  const [glbUrl, setGlbUrl] = useState(null);
  const [meshList, setMeshList] = useState([]);
  const [activeMesh, setActiveMesh] = useState("ALL");
  const [activeTool, setActiveTool] = useState("dimensions");
  const [isFullScreen, setIsFullScreen] = useState(false);
  
  const [uvMap, setUvMap] = useState({});
  const [stickers, setStickers] = useState({}); 
  const [backgrounds, setBackgrounds] = useState({}); 
  const [meshTextures, setMeshTextures] = useState({}); 
  
  // 3D Scene Reference
  const [sceneRef, setSceneRef] = useState(null);

  // States
  const [meshScales, setMeshScales] = useState({});
  const [globalScale, setGlobalScale] = useState({ x: 1, y: 1, z: 1 });
  const [lockRatio, setLockRatio] = useState(false);
  
  // Material Props
  const [materialProps, setMaterialProps] = useState({
      color: "#ffffff",
      roughness: 0.5,
      metalness: 0.1,
      wireframe: false
  });

  const handleGLBUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
        if(glbUrl) URL.revokeObjectURL(glbUrl); 
        setGlbUrl(URL.createObjectURL(file));
        setMeshList([]); setActiveMesh("ALL");
        setUvMap({}); setStickers({}); setBackgrounds({}); setMeshTextures({}); setMeshScales({});
        setGlobalScale({ x: 1, y: 1, z: 1 });
    }
  };

  const handleAssetUpload = (type, e) => {
    const file = e.target.files[0];
    if (!file || activeMesh === "ALL") return;
    const url = URL.createObjectURL(file);
    if (type === 'uv') setUvMap(prev => ({ ...prev, [activeMesh]: url }));
    if (type === 'sticker') setStickers(prev => ({ ...prev, [activeMesh]: url })); 
    if (type === 'background') setBackgrounds(prev => ({ ...prev, [activeMesh]: url }));
  };

  // AUTO GENERATE UV FUNCTION
  const handleAutoUV = () => {
      if (activeMesh === "ALL" || !sceneRef) {
          alert("Please select a specific mesh layer first.");
          return;
      }
      
      // Find the mesh object in the scene
      let targetMesh = null;
      sceneRef.traverse((child) => {
          if (child.isMesh && child.name === activeMesh) targetMesh = child;
      });

      if (targetMesh) {
          const uvDataUrl = generateUVMap(targetMesh);
          if (uvDataUrl) {
              setUvMap(prev => ({ ...prev, [activeMesh]: uvDataUrl }));
          } else {
              alert("Could not generate UVs for this mesh.");
          }
      }
  };

  const applyTexture = useCallback((meshName, dataUrl) => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(dataUrl);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = false;
    setMeshTextures(prev => ({ ...prev, [meshName]: tex }));
  }, []);

  const updateScale = (axis, value) => {
      const val = parseFloat(value);
      if (isNaN(val)) return;
      const applyLock = (prevScale) => {
          if (lockRatio) return { x: val, y: val, z: val };
          return { ...prevScale, [axis]: val };
      };
      if (activeMesh === "ALL") {
          setGlobalScale(prev => applyLock(prev));
      } else {
          setMeshScales(prev => {
              const current = prev[activeMesh] || { x: 1, y: 1, z: 1 };
              return { ...prev, [activeMesh]: applyLock(current) };
          });
      }
  };

  const currentScale = activeMesh === "ALL" ? globalScale : (meshScales[activeMesh] || { x: 1, y: 1, z: 1 });

  return (
    <div className="flex h-screen bg-[#0e0e0e] text-white font-sans overflow-hidden">
      <div className="w-20 bg-[#121212] border-r border-white/5 flex flex-col z-20 shadow-xl">
         <div className="p-4 mb-4"><div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-lg">3D</div></div>
         <div className="flex-1 space-y-2">
             <ToolButton icon="📂" label="Project" isActive={activeTool === 'project'} onClick={() => setActiveTool('project')} />
             <ToolButton icon="📏" label="Dimensions" isActive={activeTool === 'dimensions'} onClick={() => setActiveTool('dimensions')} />
             <ToolButton icon="☁️" label="Uploads" isActive={activeTool === 'uploads'} onClick={() => setActiveTool('uploads')} />
             <ToolButton icon="🎨" label="Materials" isActive={activeTool === 'materials'} onClick={() => setActiveTool('materials')} />
         </div>
      </div>

      <div className="w-72 bg-[#18181b] border-r border-white/5 flex flex-col z-10">
          <div className="p-6 border-b border-white/5"><h2 className="text-lg font-bold tracking-tight text-zinc-100 uppercase">{activeTool}</h2></div>
          <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
              
              {/* DIMENSIONS */}
              {activeTool === 'dimensions' && (
                  <div className="space-y-6">
                      <div className="bg-[#121212] p-4 rounded-xl border border-white/5">
                          <div className="flex justify-between items-center mb-4"><h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider">{activeMesh === "ALL" ? "Global Scale" : `${activeMesh} Scale`}</h3><button onClick={() => setLockRatio(!lockRatio)} className={`text-lg transition-colors ${lockRatio ? "text-blue-500" : "text-zinc-600"}`}>{lockRatio ? "🔒" : "🔓"}</button></div>
                          {['x', 'y', 'z'].map(axis => (
                              <div key={axis} className="mb-4">
                                  <div className="flex justify-between text-[10px] text-zinc-400 mb-1"><span className="uppercase font-bold">{axis} Axis</span><span className="text-white">{currentScale[axis].toFixed(2)}x</span></div>
                                  <input type="range" min="0.1" max="3.0" step="0.01" value={currentScale[axis]} onChange={(e) => updateScale(axis, e.target.value)} className="w-full h-1 rounded-lg appearance-none cursor-pointer bg-zinc-700 accent-blue-500" />
                              </div>
                          ))}
                      </div>
                  </div>
              )}

              {/* PROJECT */}
              {activeTool === 'project' && (
                  <>
                     {!glbUrl && <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-zinc-700 rounded-xl hover:border-blue-500 cursor-pointer"><span className="text-2xl mb-2">📥</span><span className="text-xs font-bold uppercase text-zinc-400">Import GLB</span><input type="file" accept=".glb" onChange={handleGLBUpload} className="hidden" /></label>}
                     {glbUrl && <div className="space-y-1"><button onClick={() => setActiveMesh("ALL")} className={`w-full text-left px-3 py-3 rounded-lg text-xs font-bold uppercase tracking-wider mb-2 border transition-all ${activeMesh === "ALL" ? "bg-white text-black border-white" : "bg-black border-zinc-800 text-zinc-400"}`}>Overview</button>{meshList.map(mesh => (<button key={mesh} onClick={() => setActiveMesh(mesh)} className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium flex items-center justify-between transition-all border ${activeMesh === mesh ? 'bg-blue-600 border-blue-500 text-white' : 'bg-zinc-800/30 border-transparent text-zinc-400'}`}><span className="truncate">{mesh}</span></button>))}</div>}
                  </>
              )}

              {/* UPLOADS (WITH AUTO UV) */}
              {activeTool === 'uploads' && (
                  <>
                    {activeMesh === "ALL" ? <div className="text-center mt-10 opacity-50"><p className="text-sm">Select a layer first.</p></div> : (
                        <div className="space-y-4">
                            <div className="bg-[#121212] p-4 rounded-xl border border-white/5">
                                <h3 className="text-[10px] font-bold text-zinc-500 mb-3 uppercase">1. UV Guide</h3>
                                
                                {/* AUTO GENERATE BUTTON */}
                                <button onClick={handleAutoUV} className="w-full mb-3 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white py-2 rounded text-xs font-bold shadow-lg transition-all active:scale-95">
                                    🪄 Auto-Generate UV
                                </button>
                                
                                <div className="flex items-center gap-2 mb-2"><div className="h-px bg-zinc-800 flex-1"></div><span className="text-[9px] text-zinc-600">OR</span><div className="h-px bg-zinc-800 flex-1"></div></div>

                                <label className="flex items-center gap-3 w-full p-3 bg-zinc-900 rounded-lg cursor-pointer hover:bg-zinc-800 border border-zinc-700"><span className="text-xl">📐</span><div className="text-xs font-bold text-zinc-200">Upload UV Map</div><input type="file" accept="image/*" onChange={(e) => handleAssetUpload('uv', e)} className="hidden" /></label>
                            </div>
                            <div className="bg-[#121212] p-4 rounded-xl border border-white/5"><h3 className="text-[10px] font-bold text-zinc-500 mb-3 uppercase">2. Base Texture</h3><label className="flex items-center gap-3 w-full p-3 bg-zinc-900 rounded-lg cursor-pointer hover:bg-zinc-800 border border-zinc-700"><span className="text-xl">🌄</span><div className="text-xs font-bold text-zinc-200">Upload Image</div><input type="file" accept="image/*" onChange={(e) => handleAssetUpload('background', e)} className="hidden" /></label></div>
                            <div className="bg-[#121212] p-4 rounded-xl border border-white/5"><h3 className="text-[10px] font-bold text-zinc-500 mb-3 uppercase">3. Stickers</h3><label className="flex items-center gap-3 w-full p-3 bg-zinc-900 rounded-lg cursor-pointer hover:bg-zinc-800 border border-zinc-700"><span className="text-xl">🖼️</span><div className="text-xs font-bold text-zinc-200">Add Sticker</div><input type="file" accept="image/*" onChange={(e) => handleAssetUpload('sticker', e)} className="hidden" /></label></div>
                        </div>
                    )}
                  </>
              )}

              {/* MATERIALS (NEW) */}
              {activeTool === 'materials' && (
                  <div className="bg-[#121212] p-4 rounded-xl border border-white/5 space-y-6">
                      
                      {/* COLOR */}
                      <div>
                        <h3 className="text-[10px] font-bold text-zinc-500 mb-2 uppercase">Base Color</h3>
                        <div className="flex gap-4 items-center">
                            <input type="color" value={materialProps.color} onChange={(e) => setMaterialProps(p => ({...p, color: e.target.value}))} className="w-12 h-12 rounded cursor-pointer border-0 bg-transparent" />
                            <div className="text-xs text-zinc-400 font-mono uppercase">{materialProps.color}</div>
                        </div>
                      </div>

                      {/* ROUGHNESS */}
                      <div>
                          <div className="flex justify-between text-[10px] text-zinc-400 mb-1"><span>Roughness</span><span className="text-white">{materialProps.roughness}</span></div>
                          <input type="range" min="0" max="1" step="0.1" value={materialProps.roughness} onChange={(e) => setMaterialProps(p => ({...p, roughness: parseFloat(e.target.value)}))} className="w-full h-1 bg-zinc-700 rounded-lg accent-zinc-200" />
                      </div>

                      {/* METALNESS */}
                      <div>
                          <div className="flex justify-between text-[10px] text-zinc-400 mb-1"><span>Metalness</span><span className="text-white">{materialProps.metalness}</span></div>
                          <input type="range" min="0" max="1" step="0.1" value={materialProps.metalness} onChange={(e) => setMaterialProps(p => ({...p, metalness: parseFloat(e.target.value)}))} className="w-full h-1 bg-zinc-700 rounded-lg accent-zinc-200" />
                      </div>

                      {/* WIREFRAME TOGGLE */}
                      <label className="flex items-center gap-3 cursor-pointer">
                          <input type="checkbox" checked={materialProps.wireframe} onChange={(e) => setMaterialProps(p => ({...p, wireframe: e.target.checked}))} className="w-4 h-4 accent-blue-500" />
                          <span className="text-xs font-bold text-zinc-300">Show Wireframe</span>
                      </label>
                  </div>
              )}
          </div>
      </div>

      <div className="flex-1 relative flex flex-col bg-[#121212]" style={dotGridStyle}>
          <div className="h-16 border-b border-white/5 bg-[#121212]/80 backdrop-blur-md flex items-center justify-between px-6 z-10"><h1 className="font-bold text-lg text-white/90">{activeMesh === "ALL" ? "3D Overview" : `Editing: ${activeMesh}`}</h1></div>
          <div className="flex-1 relative overflow-hidden">
            {activeMesh !== "ALL" ? 
                <WorkspaceEditor 
                    uvUrl={uvMap[activeMesh]} 
                    stickerUrl={stickers[activeMesh]} 
                    backgroundUrl={backgrounds[activeMesh]}
                    fabricColor={materialProps.color} 
                    onExport={(uri) => applyTexture(activeMesh, uri)} 
                /> 
                : 
                <div className="w-full h-full flex items-center justify-center opacity-20"><h1 className="text-9xl font-black text-white">3D</h1></div>
            }
          </div>
      </div>

      {/* 3D PREVIEW */}
      {glbUrl && (
          <div className={`transition-all duration-300 ease-in-out bg-[#18181b] shadow-2xl border border-white/10 overflow-hidden z-50 ${isFullScreen ? "fixed inset-0 w-full h-full rounded-none" : "absolute top-20 right-6 w-80 h-96 rounded-2xl hover:scale-[1.02]"}`}>
              <div className="absolute top-4 left-4 right-4 z-10 flex justify-between items-start pointer-events-none">
                  <span className="text-[10px] font-bold bg-black/50 backdrop-blur px-2 py-1 rounded text-white border border-white/10 pointer-events-auto">LIVE PREVIEW</span>
                  <button onClick={() => setIsFullScreen(!isFullScreen)} className="pointer-events-auto bg-black/50 hover:bg-blue-600 text-white w-8 h-8 flex items-center justify-center rounded-lg backdrop-blur transition-colors border border-white/10">{isFullScreen ? "✕" : "⛶"}</button>
              </div>
              <Canvas frameloop="demand" dpr={[1, 2]} camera={{ position: [0, 0, 3.5], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
                  <ambientLight intensity={0.7} /><directionalLight position={[5, 5, 5]} intensity={1.5} /><Environment preset="city" />
                  <DynamicModel 
                    url={glbUrl} 
                    activeMesh={activeMesh} 
                    meshTextures={meshTextures} 
                    meshScales={meshScales} 
                    globalScale={globalScale}
                    materialProps={materialProps}
                    setMeshList={setMeshList} 
                    onMeshLoaded={setSceneRef}
                  />
                  <OrbitControls makeDefault minDistance={1.5} maxDistance={10} />
              </Canvas>
          </div>
      )}
    </div>
  );
}