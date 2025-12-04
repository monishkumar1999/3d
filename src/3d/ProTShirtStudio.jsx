import React, { useState, useEffect, useMemo, Suspense, useRef } from "react";
import { Canvas, createPortal, useThree } from "@react-three/fiber";
import { useGLTF, Environment, Center, OrbitControls, Decal, Html } from "@react-three/drei";
import * as THREE from "three";

/* =========================================
   1. UTILS
   ========================================= */
const calculateRotation = (normal, userRotationZ) => {
    const dummy = new THREE.Object3D();
    dummy.lookAt(normal);
    dummy.rotateZ(userRotationZ);
    return [dummy.rotation.x, dummy.rotation.y, dummy.rotation.z];
};

/* =========================================
   2. COMPONENTS
   ========================================= */
const SmartDecal = ({ mesh, data, isSelected }) => {
    const { url, pos, normal, scale, rotation: userRotation } = data;
    const [texture, setTexture] = useState(null);
    const { gl } = useThree();

    // Default scale if not array: [0.4, 0.4, 0.2]
    const scaleVec = Array.isArray(scale) ? scale : [scale ?? 0.4, scale ?? 0.4, 0.2];

    useEffect(() => {
        if (!url) return;
        new THREE.TextureLoader().load(url, (tex) => {
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.anisotropy = gl.capabilities.getMaxAnisotropy();
            setTexture(tex);
        });
    }, [url, gl]);

    const finalRotation = useMemo(() => {
        const n = normal ? new THREE.Vector3(...normal) : new THREE.Vector3(0, 0, 1);
        return calculateRotation(n, userRotation ?? 0);
    }, [normal, userRotation]);

    if (!pos || !texture) return null;

    return (
        <Decal
            position={pos}
            rotation={finalRotation}
            scale={scaleVec}
        >
            <meshStandardMaterial 
                map={texture}
                transparent
                polygonOffset
                polygonOffsetFactor={-4}
                depthTest={true}
                depthWrite={false}
                roughness={0.2}
                emissive={isSelected ? "#222" : "#000"}
            />
        </Decal>
    );
};

/* =========================================
   3. MODEL VIEWER (INSPECTOR MODE)
   ========================================= */
const ModelViewer = ({ 
  url, 
  setControlsEnabled, 
  allowedMeshNames, 
  decals,
  setDecals,
  zoneSettings, 
  setZoneSettings,
  activeVariants, 
  selectedMeshName,
  setSelectedMeshName,
  onLoadHierarchy,
  showWireframe,
  meshRefs,     
  setMeshRefs,
  mode,             
  toggleAllowedMesh 
}) => {
  const gltf = useGLTF(url);
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredMesh, setHoveredMesh] = useState(null);
  
  const [matTextures, setMatTextures] = useState({});

  useEffect(() => {
      const handleGlobalPointerUp = () => {
          setIsDragging(false);
          setControlsEnabled(true);
      };
      window.addEventListener('pointerup', handleGlobalPointerUp);
      return () => window.removeEventListener('pointerup', handleGlobalPointerUp);
  }, [setControlsEnabled]);

  // Load Material Textures
  useEffect(() => {
    Object.keys(zoneSettings).forEach(meshName => {
        const settings = zoneSettings[meshName];
        if (settings?.material && settings.texture) {
            if (!matTextures[meshName] || matTextures[meshName].sourceFile !== settings.texture) {
                new THREE.TextureLoader().load(settings.texture, (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    tex.flipY = false;
                    tex.sourceFile = settings.texture;
                    setMatTextures(prev => ({ ...prev, [meshName]: tex }));
                });
            }
        }
    });
  }, [zoneSettings, matTextures]);

  // Main Scene Traversal
  useEffect(() => {
    if (!gltf) return;
    const refs = {};
    const allMeshNames = [];

    gltf.scene.traverse((child) => {
      if (child.isMesh) {
        allMeshNames.push(child.name);
        refs[child.name] = child;
        
        const isAllowed = allowedMeshNames.includes(child.name);
        const settings = zoneSettings[child.name];
        
        // --- 1. VARIANT VISIBILITY LOGIC ---
        let isVisible = true;
        if (settings?.variantGroup) {
            const activeInGroup = activeVariants[settings.variantGroup];
            if (activeInGroup && activeInGroup !== child.name) {
                isVisible = false;
            }
        }
        child.visible = isVisible;

        // --- 2. MATERIAL/VISUAL LOGIC ---
        if (child.material) {
            if (!child.userData.isMaterialCloned) {
                child.material = child.material.clone();
                child.userData.isMaterialCloned = true;
            }

            if (!child.userData.originalMat) {
                child.userData.originalMat = child.material.clone();
            }
            
            if (mode === 'setup') {
                child.material.wireframe = showWireframe || isAllowed;
                let highlightColor = 0x000000;
                if (settings?.stickers && settings?.material) highlightColor = 0x008888;
                else if (settings?.material) highlightColor = 0x004488;
                else if (settings?.stickers) highlightColor = 0x004400;
                if (settings?.variantGroup) highlightColor = 0x550055;

                child.material.emissive = new THREE.Color(isAllowed || settings?.variantGroup ? highlightColor : 0x000000);
                child.material.color = new THREE.Color(isAllowed ? 0x88ff88 : 0xffffff);
                child.material.map = child.userData.originalMat.map; 
            } 
            else {
                child.material.wireframe = showWireframe;
                child.material.emissive = new THREE.Color(0x000000);
                
                if (settings?.material && isVisible) {
                    const loadedTex = matTextures[child.name];
                    if (loadedTex) {
                        child.material.map = loadedTex;
                        child.material.color.set(0xffffff);
                    } else if (settings.color) {
                        child.material.map = null; 
                        child.material.color.set(settings.color);
                    } else {
                        child.material.color.copy(child.userData.originalMat.color);
                        child.material.map = child.userData.originalMat.map;
                    }
                } else {
                     child.material.color.copy(child.userData.originalMat.color);
                     child.material.map = child.userData.originalMat.map;
                }
                child.material.needsUpdate = true;
            }
        }
      }
    });
    
    setMeshRefs(refs);
    if (onLoadHierarchy) onLoadHierarchy([...new Set(allMeshNames)].sort());

  }, [gltf, allowedMeshNames, onLoadHierarchy, showWireframe, setMeshRefs, mode, zoneSettings, matTextures, activeVariants]);

  // Decal Logic
  useEffect(() => {
      const newDecals = { ...decals };
      let changed = false;

      Object.keys(newDecals).forEach(meshName => {
          const decal = newDecals[meshName];
          const mesh = meshRefs[meshName];
          
          if (decal.url && !decal.pos && mesh) {
             mesh.geometry.computeBoundingBox();
             const center = new THREE.Vector3();
             mesh.geometry.boundingBox.getCenter(center);
             
             newDecals[meshName] = {
                 ...decal,
                 pos: [center.x, center.y, center.z],
                 normal: [0, 0, 1] 
             };
             changed = true;
          }
      });

      if (changed) setDecals(newDecals);
  }, [decals, meshRefs, setDecals]);

  const handlePointerDown = (e) => {
    const meshName = e.object.name;
    e.stopPropagation();

    if (mode === 'setup') {
        toggleAllowedMesh(meshName);
        return;
    }

    if (allowedMeshNames.includes(meshName) && e.object.visible) {
        setSelectedMeshName(meshName);
        const settings = zoneSettings[meshName] || { stickers: true, material: false };

        if (settings?.stickers) {
            setIsDragging(true);
            setControlsEnabled(false);
            updateDecalPosition(e, meshName);
        }
    } else {
        setSelectedMeshName(null);
    }
  };

  const handlePointerMove = (e) => {
    if (e.object.name !== hoveredMesh) setHoveredMesh(e.object.name);

    if (isDragging && selectedMeshName && e.object.name === selectedMeshName) {
        e.stopPropagation();
        updateDecalPosition(e, selectedMeshName);
    }
  };
  
  const handlePointerOut = () => {
      setHoveredMesh(null);
  };

  const updateDecalPosition = (e, meshName) => {
      const localPoint = e.object.worldToLocal(e.point.clone());
      let normal = [0, 0, 1];
      if (e.face && e.face.normal) {
          normal = [e.face.normal.x, e.face.normal.y, e.face.normal.z];
      }

      setDecals(prev => {
          // Default Z set to 0.6 for better coverage out of box
          const existingData = prev[meshName] || { scale: [0.4, 0.4, 0.6], rotation: 0 };
          return {
            ...prev,
            [meshName]: {
                ...existingData, 
                pos: [localPoint.x, localPoint.y, localPoint.z],
                normal: normal
            }
          };
      });
  };

  return (
    <>
      <gridHelper args={[10, 10, 0x444444, 0x222222]} />
      <axesHelper args={[2]} />

      <primitive 
        object={gltf.scene} 
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
      />

      {Object.keys(decals).map(meshName => {
          const settings = zoneSettings[meshName] || { stickers: true };
          const mesh = meshRefs[meshName];
          if (!settings.stickers || !mesh || !mesh.visible) return null;

          const data = decals[meshName];
          if (!data.url) return null;

          return (
            <React.Fragment key={meshName}>
                {createPortal(
                    <SmartDecal 
                        key={meshName}
                        mesh={mesh}
                        data={data}
                        isSelected={selectedMeshName === meshName}
                    />,
                    mesh
                )}
            </React.Fragment>
          );
      })}
      
      {mode === 'setup' && hoveredMesh && (
          <Html position={[0,0,0]} style={{pointerEvents:'none'}}>
              <div className="bg-black/80 text-white text-xs px-2 py-1 rounded translate-x-4 translate-y-4 whitespace-nowrap border border-white/20">
                  {hoveredMesh} {allowedMeshNames.includes(hoveredMesh) ? "✅" : ""}
              </div>
          </Html>
      )}
    </>
  );
};

/* =========================================
   4. MAIN COMPONENT (TESTER DASHBOARD)
   ========================================= */
export default function Simple3DViewer() {
  const [modelUrl, setModelUrl] = useState(null);
  const [controlsEnabled, setControlsEnabled] = useState(true);
  const [mode, setMode] = useState('setup'); 

  const [allowedInput, setAllowedInput] = useState("Photo, Screen");
  const [hierarchy, setHierarchy] = useState([]); 
  const [showWireframe, setShowWireframe] = useState(false);

  const [modelPos, setModelPos] = useState([0, 0, 0]);
  const [modelRot, setModelRot] = useState([0, 0, 0]);

  const [decals, setDecals] = useState({});
  const [zoneSettings, setZoneSettings] = useState({}); 
  const [activeVariants, setActiveVariants] = useState({});
  
  const [selectedMeshName, setSelectedMeshName] = useState(null);
  const [meshRefs, setMeshRefs] = useState({});

  const allowedMeshNames = useMemo(() => {
    return allowedInput.split(',').map(s => s.trim()).filter(s => s.length > 0);
  }, [allowedInput]);

  const variantGroups = useMemo(() => {
      const groups = {};
      Object.entries(zoneSettings).forEach(([meshName, settings]) => {
          if (settings.variantGroup) {
              if (!groups[settings.variantGroup]) groups[settings.variantGroup] = [];
              groups[settings.variantGroup].push(meshName);
          }
      });
      return groups;
  }, [zoneSettings]);

  useEffect(() => {
      const defaults = {};
      Object.keys(variantGroups).forEach(group => {
          if (!activeVariants[group] || !variantGroups[group].includes(activeVariants[group])) {
              if (variantGroups[group].length > 0) {
                  defaults[group] = variantGroups[group][0]; 
              }
          }
      });
      if (Object.keys(defaults).length > 0) {
          setActiveVariants(prev => ({ ...prev, ...defaults }));
      }
  }, [variantGroups, activeVariants]);


  const toggleAllowedMesh = (name) => {
    let current = allowedMeshNames;
    if (current.includes(name)) {
        current = current.filter(n => n !== name);
        const newSettings = { ...zoneSettings };
        delete newSettings[name];
        setZoneSettings(newSettings);
    } else {
        current.push(name);
        setZoneSettings(prev => ({ 
            ...prev, 
            [name]: { stickers: true, material: false, color: '#ffffff', variantGroup: '' } 
        }));
    }
    setAllowedInput(current.join(', '));
  };

  const toggleCapability = (name, cap) => {
      setZoneSettings(prev => {
          const current = prev[name] || { stickers: true, material: false, color: '#ffffff' };
          return {
            ...prev,
            [name]: { ...current, [cap]: !current[cap] }
          };
      });
  };

  const updateVariantGroup = (name, groupName) => {
      setZoneSettings(prev => {
          const current = prev[name] || { stickers: true, material: false, color: '#ffffff' };
          return {
            ...prev,
            [name]: { ...current, variantGroup: groupName }
          };
      });
  };

  const setZoneColor = (name, color) => {
      setZoneSettings(prev => ({
          ...prev,
          [name]: { ...prev[name], color: color, texture: null }
      }));
  };

  const handleFileUpload = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const url = URL.createObjectURL(file);

      if (selectedMeshName && allowedMeshNames.includes(selectedMeshName)) {
          updateDecal(selectedMeshName, { url });
      }
  };

  const updateDecal = (meshName, newData) => {
      setDecals(prev => {
          // Initialize scale as Array [x, y, z] if it was a number or undefined
          const oldScale = prev[meshName]?.scale;
          const safeScale = Array.isArray(oldScale) ? oldScale : [0.4, 0.4, 0.2];
          
          return {
            ...prev,
            [meshName]: {
                ...(prev[meshName] || { scale: safeScale, rotation: 0, pos: null, normal: null }),
                ...newData
            }
          };
      });
  };

  // Update scale X (width) or Y (height) or Z (depth) independently
  const updateSelectedScale = (axis, value) => {
      if (!selectedMeshName) return;
      const current = decals[selectedMeshName] || {};
      const oldScale = Array.isArray(current.scale) ? current.scale : [0.4, 0.4, 0.2];
      
      const newScale = [...oldScale];
      if (axis === 'x') newScale[0] = value;
      if (axis === 'y') newScale[1] = value;
      if (axis === 'z') newScale[2] = value;
      
      updateDecal(selectedMeshName, { scale: newScale });
  };

  const updateSelectedTransform = (key, value) => {
      if (!selectedMeshName) return;
      updateDecal(selectedMeshName, { [key]: value });
  };

  const handleSaveConfiguration = () => {
    if (!modelUrl) return;

    const stickerZones = [];
    const materialZones = [];
    const variantDefinitions = [];

    allowedMeshNames.forEach(meshName => {
        const settings = zoneSettings[meshName] || { stickers: true, material: false };
        const zoneId = meshName.toLowerCase().replace(/\s+/g, '_');
        const label = `Custom ${meshName}`;

        if (settings.stickers) {
            const currentTestDecal = decals[meshName];
            let defaultPosition = [0, 0, 0];
            let defaultNormal = [0, 0, 1];
            let defaultScale = [0.4, 0.4, 0.2]; 

            if (currentTestDecal && currentTestDecal.pos) {
                defaultPosition = currentTestDecal.pos;
                defaultNormal = currentTestDecal.normal || [0, 0, 1];
                defaultScale = Array.isArray(currentTestDecal.scale) ? currentTestDecal.scale : [0.4, 0.4, 0.2];
            } else {
                 const mesh = meshRefs[meshName];
                 if(mesh) {
                    mesh.geometry.computeBoundingBox();
                    const center = new THREE.Vector3();
                    mesh.geometry.boundingBox.getCenter(center);
                    defaultPosition = [center.x, center.y, center.z];
                 }
            }

            stickerZones.push({
                zoneId,
                meshName,
                label: `${label} (Sticker)`,
                type: 'decal',
                variantGroup: settings.variantGroup || null, 
                defaultTransform: {
                    position: defaultPosition,
                    normal: defaultNormal,
                    scale: defaultScale
                }
            });
        } 

        if (settings.material) {
            materialZones.push({
                zoneId: `${zoneId}_mat`,
                meshName,
                label: `${label} (Material)`,
                type: 'material',
                variantGroup: settings.variantGroup || null,
                defaultMaterial: {
                    color: settings.color || '#ffffff'
                }
            });
        }
    });

    Object.keys(variantGroups).forEach(group => {
        variantDefinitions.push({
            id: group.toLowerCase().replace(/\s+/g, '_'),
            label: group,
            options: variantGroups[group], 
            default: activeVariants[group] || variantGroups[group][0]
        });
    });

    const productDefinition = {
        modelSource: "YOUR_GLB_URL_HERE.glb",
        globalTransform: {
            position: modelPos,
            rotation: modelRot.map(d => d * Math.PI / 180)
        },
        variantGroups: variantDefinitions,
        stickerZones,
        materialZones
    };

    console.log("------------------------------------------");
    console.log("✅ PRODUCT DEFINITION SAVED");
    console.log(JSON.stringify(productDefinition, null, 2));
    console.log("------------------------------------------");
    alert("Product Definition generated! Check Console (F12).");
  };

  const activeSettings = selectedMeshName 
    ? (zoneSettings[selectedMeshName] || { stickers: true, material: false, color: '#ffffff', variantGroup: '' }) 
    : null;

  // Safe accessor for scale array
  const getCurrentScale = () => {
      const d = decals[selectedMeshName];
      if (!d) return [0.4, 0.4, 0.2];
      return Array.isArray(d.scale) ? d.scale : [d.scale ?? 0.4, d.scale ?? 0.4, 0.2];
  };
  const [scaleX, scaleY, scaleZ] = getCurrentScale();
  
  const currentRotation = decals[selectedMeshName]?.rotation ?? 0;
  const currentRotationDeg = Math.round(currentRotation * (180 / Math.PI));

  if (!modelUrl) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-screen bg-neutral-900 text-white">
        <div className="p-8 rounded-2xl border-2 border-dashed border-neutral-700 bg-white/5 text-center">
          <h2 className="text-2xl font-bold mb-4">3D Model Inspector</h2>
          <label className="cursor-pointer bg-blue-600 hover:bg-blue-500 px-6 py-3 rounded-xl font-bold transition-colors inline-block">
            <span>Upload GLB for Testing</span>
            <input 
              type="file" 
              accept=".glb,.gltf" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files[0];
                if (file) {
                    setModelUrl(URL.createObjectURL(file));
                    setDecals({});
                    setSelectedMeshName(null);
                    setHierarchy([]);
                    setModelPos([0,0,0]);
                    setModelRot([0,0,0]);
                    setZoneSettings({});
                    setActiveVariants({});
                }
              }}
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen bg-[#111] relative flex">
      
      {/* --- LEFT SIDEBAR: HIERARCHY --- */}
      <div className="w-64 h-full bg-[#1a1a1a] border-r border-white/10 flex flex-col z-10">
          <div className="p-4 border-b border-white/10">
              <button onClick={() => setModelUrl(null)} className="w-full bg-white/10 text-white px-3 py-2 rounded mb-4 hover:bg-white/20 text-xs font-bold">← Upload New Model</button>
              
              <div className="flex bg-black/50 p-1 rounded-lg mb-4">
                  <button onClick={() => setMode('setup')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${mode === 'setup' ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:text-white'}`}>🛠️ Setup</button>
                  <button onClick={() => setMode('test')} className={`flex-1 py-2 text-xs font-bold rounded-md transition-colors ${mode === 'test' ? 'bg-purple-600 text-white' : 'text-neutral-500 hover:text-white'}`}>🎨 Test</button>
              </div>

              <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">
                  {mode === 'setup' ? "Structure & Variants" : "Active Variants"}
              </h3>
              
              {mode === 'setup' && (
                <label className="flex items-center gap-2 text-xs text-neutral-300 cursor-pointer hover:text-white mb-2">
                    <input type="checkbox" checked={showWireframe} onChange={e => setShowWireframe(e.target.checked)} className="rounded border-white/20 bg-white/5"/>
                    Show Wireframe
                </label>
              )}
          </div>

          <div className="flex-1 overflow-y-auto p-2">
              {/* TEST MODE: VARIANT SELECTOR */}
              {mode === 'test' && (
                  <>
                    {Object.keys(variantGroups).length === 0 ? (
                        <div className="p-4 text-center">
                            <p className="text-xs text-neutral-500 mb-2">No variants configured.</p>
                            <button onClick={() => setMode('setup')} className="text-[10px] text-blue-400 underline">Go to Setup to add Variant Groups</button>
                        </div>
                    ) : (
                        <div className="mb-6">
                            {Object.keys(variantGroups).map(group => (
                                <div key={group} className="mb-4">
                                    <h4 className="text-[10px] uppercase font-bold text-purple-400 mb-2 pl-2">{group}</h4>
                                    <div className="flex flex-col gap-1">
                                        {variantGroups[group].map(meshName => (
                                            <button
                                                key={meshName}
                                                onClick={() => setActiveVariants(prev => ({ ...prev, [group]: meshName }))}
                                                className={`text-xs px-3 py-2 text-left rounded transition-colors ${activeVariants[group] === meshName ? 'bg-purple-600 text-white font-bold' : 'text-neutral-400 hover:bg-white/5'}`}
                                            >
                                                {meshName}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                  </>
              )}

              {/* SETUP MODE: MESH LIST */}
              {mode === 'setup' && hierarchy.map(name => {
                  const isAllowed = allowedMeshNames.includes(name);
                  // ✅ FIX: Fallback
                  const settings = zoneSettings[name] || { stickers: true, material: false, variantGroup: '' };
                  
                  return (
                      <div key={name} className="mb-1 border-b border-white/5 pb-2">
                          <button
                            onClick={() => toggleAllowedMesh(name)}
                            className={`w-full text-left px-3 py-2 text-xs font-mono rounded transition-colors flex items-center justify-between
                                ${isAllowed ? 'bg-white/10 text-white' : 'text-neutral-500 hover:bg-white/5'}
                            `}
                          >
                              <span className="truncate" title={name}>{name}</span>
                              {isAllowed && <span className="text-[9px] bg-green-600 text-white px-1 rounded">ON</span>}
                          </button>
                          
                          {/* Setup Controls */}
                          {isAllowed && (
                              <div className="pl-2 mt-1 flex flex-col gap-2">
                                  <div className="flex gap-1">
                                      <button onClick={() => toggleCapability(name, 'stickers')} className={`text-[9px] px-2 py-1 rounded flex-1 border ${settings.stickers ? 'bg-blue-600 border-blue-400 text-white' : 'bg-transparent border-white/10 text-neutral-500'}`}>Sticker</button>
                                      <button onClick={() => toggleCapability(name, 'material')} className={`text-[9px] px-2 py-1 rounded flex-1 border ${settings.material ? 'bg-orange-600 border-orange-400 text-white' : 'bg-transparent border-white/10 text-neutral-500'}`}>Material</button>
                                  </div>
                                  <div>
                                      <input 
                                        type="text" 
                                        placeholder="Variant Group (e.g. Sleeves)"
                                        value={settings.variantGroup || ''}
                                        onChange={(e) => updateVariantGroup(name, e.target.value)}
                                        className="w-full bg-black/40 text-white text-[10px] px-2 py-1 rounded border border-white/10 focus:border-purple-500 outline-none"
                                      />
                                  </div>
                              </div>
                          )}
                      </div>
                  )
              })}
          </div>
      </div>

      {/* --- CENTER: CANVAS --- */}
      <div className="flex-1 relative h-full">
        <div className="absolute top-5 left-5 z-0 pointer-events-none">
            <h1 className="text-white font-bold text-xl drop-shadow-md">
                {mode === 'setup' ? "🛠️ Setup Mode" : "🎨 Test Mode"}
            </h1>
            <p className="text-neutral-400 text-sm drop-shadow-md max-w-md">
                {mode === 'setup' 
                    ? "Click meshes to toggle. Enable Sticker/Material capabilities." 
                    : "Interact with zones to test visuals."}
            </p>
        </div>

        <Canvas 
            shadows 
            camera={{ position: [3, 3, 3], fov: 45 }}
            onPointerMissed={() => setSelectedMeshName(null)}
        >
            <ambientLight intensity={0.8} />
            <Environment preset="city" />

            <Suspense fallback={<Html center><div className="text-white font-bold">LOADING...</div></Html>}>
            <Center position={modelPos} rotation={modelRot.map(d => d * Math.PI / 180)}>
                <ModelViewer 
                    url={modelUrl} 
                    setControlsEnabled={setControlsEnabled}
                    allowedMeshNames={allowedMeshNames}
                    decals={decals}
                    setDecals={setDecals}
                    zoneSettings={zoneSettings}
                    setZoneSettings={setZoneSettings}
                    activeVariants={activeVariants}
                    selectedMeshName={selectedMeshName}
                    setSelectedMeshName={setSelectedMeshName}
                    onLoadHierarchy={setHierarchy}
                    showWireframe={showWireframe}
                    meshRefs={meshRefs}
                    setMeshRefs={setMeshRefs}
                    mode={mode}
                    toggleAllowedMesh={toggleAllowedMesh}
                />
            </Center>
            </Suspense>

            <OrbitControls makeDefault enabled={controlsEnabled} minDistance={0.1} maxDistance={500} />
        </Canvas>

        {/* --- RIGHT OVERLAY: EDITOR --- */}
        <div className="absolute top-5 right-5 flex flex-col gap-3 w-64 pointer-events-none">
            <div className="pointer-events-auto flex flex-col gap-3">
                
                {/* 1. MODEL ALIGNMENT (Visible when NO zone is selected) */}
                {!selectedMeshName && (
                    <div className="bg-black/80 text-white px-4 py-3 rounded-lg backdrop-blur border border-white/10">
                        <div className="flex justify-between items-center mb-2">
                             <h4 className="text-[10px] text-yellow-400 font-bold uppercase">Model Alignment</h4>
                             <button onClick={() => { setModelPos([0,0,0]); setModelRot([0,0,0]); }} className="text-[9px] text-neutral-400 hover:text-white underline">Reset</button>
                        </div>
                        
                        {/* Position Y (Up/Down) */}
                        <div className="mb-2">
                            <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                                <span>POS Y (Up/Down)</span>
                                <span>{modelPos[1].toFixed(1)}</span>
                            </div>
                            <input type="range" min="-5" max="5" step="0.1" value={modelPos[1]} onChange={(e) => setModelPos([modelPos[0], parseFloat(e.target.value), modelPos[2]])} className="w-full h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer" />
                        </div>
                         {/* Position X (Left/Right) */}
                         <div className="mb-2">
                            <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                                <span>POS X (Left/Right)</span>
                                <span>{modelPos[0].toFixed(1)}</span>
                            </div>
                            <input type="range" min="-5" max="5" step="0.1" value={modelPos[0]} onChange={(e) => setModelPos([parseFloat(e.target.value), modelPos[1], modelPos[2]])} className="w-full h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer" />
                        </div>

                         {/* Rotation Y (Spin) */}
                         <div>
                            <div className="flex justify-between text-[10px] text-neutral-400 mb-1">
                                <span>ROTATE Y</span>
                                <span>{modelRot[1]}°</span>
                            </div>
                            <input type="range" min="0" max="360" step="10" value={modelRot[1]} onChange={(e) => setModelRot([modelRot[0], parseInt(e.target.value), modelRot[2]])} className="w-full h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer" />
                        </div>
                    </div>
                )}

                {/* 2. ZONE EDITOR (Visible when Zone IS selected) */}
                <div className="bg-black/80 text-white px-4 py-3 rounded-lg backdrop-blur border border-white/10">
                    <span className="text-[10px] text-neutral-400 uppercase font-bold">Currently Editing</span>
                    <div className="text-sm font-mono font-bold mt-1 text-blue-400 truncate">
                        {selectedMeshName || "None"}
                    </div>
                    {selectedMeshName && (
                        <div className="mt-1 flex flex-col gap-1">
                             <div className="text-[10px] text-neutral-500 flex gap-2">
                                {activeSettings?.stickers && <span className="bg-blue-900/50 px-1 rounded text-blue-300">Sticker</span>}
                                {activeSettings?.material && <span className="bg-orange-900/50 px-1 rounded text-orange-300">Material</span>}
                             </div>
                             {activeSettings?.variantGroup && (
                                <div className="text-[10px] text-purple-400 border border-purple-500/30 px-1 rounded w-fit">
                                    Group: {activeSettings.variantGroup}
                                </div>
                             )}
                        </div>
                    )}
                </div>

                {/* --- CONTROLS: DECAL (STICKER) --- */}
                {mode === 'test' && selectedMeshName && activeSettings?.stickers && (
                    <div className="border-l-2 border-blue-500 pl-2">
                         <div className="bg-black/80 text-white px-4 py-3 rounded-lg backdrop-blur border border-white/10 mb-2">
                            <h4 className="text-[10px] text-blue-400 font-bold mb-2 uppercase">Sticker Settings</h4>
                            <div className="mb-2">
                                <div className="flex justify-between text-[10px] font-bold text-neutral-400 mb-1">
                                    <span>WIDTH (Scale X)</span>
                                    <span>{scaleX.toFixed(2)}</span>
                                </div>
                                <input type="range" min="0.05" max="10.0" step="0.05" value={scaleX} onChange={(e) => updateSelectedScale('x', parseFloat(e.target.value))} className="w-full h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            <div className="mb-3">
                                <div className="flex justify-between text-[10px] font-bold text-neutral-400 mb-1">
                                    <span>HEIGHT (Scale Y)</span>
                                    <span>{scaleY.toFixed(2)}</span>
                                </div>
                                <input type="range" min="0.05" max="10.0" step="0.05" value={scaleY} onChange={(e) => updateSelectedScale('y', parseFloat(e.target.value))} className="w-full h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer" />
                            </div>
                            {/* NEW: PROJECTION DEPTH (Z) */}
                            <div className="mb-3">
                                <div className="flex justify-between text-[10px] font-bold text-neutral-400 mb-1">
                                    <span>DEPTH (Projection)</span>
                                    <span>{scaleZ.toFixed(2)}</span>
                                </div>
                                <input type="range" min="0.01" max="10.0" step="0.05" value={scaleZ} onChange={(e) => updateSelectedScale('z', parseFloat(e.target.value))} className="w-full h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer" />
                                <div className="text-[9px] text-neutral-500 mt-1">
                                    Low (~0.1) for Flat/T-Shirts. High (~0.6+) for Mugs.
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-[10px] font-bold text-neutral-400 mb-1">
                                    <span>ROTATION</span>
                                    <span>{currentRotationDeg}°</span>
                                </div>
                                <input type="range" min="0" max="360" step="5" value={currentRotationDeg} onChange={(e) => updateSelectedTransform('rotation', parseInt(e.target.value) * (Math.PI / 180))} className="w-full h-1 bg-neutral-600 rounded-lg appearance-none cursor-pointer" />
                            </div>
                        </div>
                        <div className="bg-black/80 text-white px-4 py-3 rounded-lg backdrop-blur border border-white/10">
                            <label className="text-[10px] text-neutral-400 uppercase font-bold block mb-2">Upload Sticker</label>
                            <input 
                                type="file" 
                                accept="image/*" 
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if(file) updateDecal(selectedMeshName, { url: URL.createObjectURL(file) });
                                }} 
                                className="w-full text-xs text-neutral-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-blue-600 file:text-white hover:file:bg-blue-500" 
                            />
                        </div>
                    </div>
                )}

                {/* --- CONTROLS: MATERIAL (SKIN) --- */}
                {mode === 'test' && selectedMeshName && activeSettings?.material && (
                    <div className="border-l-2 border-orange-500 pl-2 mt-2">
                        <div className="bg-black/80 text-white px-4 py-3 rounded-lg backdrop-blur border border-white/10">
                            <h4 className="text-[10px] text-orange-400 font-bold mb-2 uppercase">Material / Skin Settings</h4>
                            
                            <label className="text-[10px] text-neutral-400 uppercase font-bold block mb-2">Base Color</label>
                            <input 
                                type="color" 
                                value={activeSettings.color || '#ffffff'}
                                onChange={(e) => setZoneColor(selectedMeshName, e.target.value)}
                                className="w-full h-8 cursor-pointer rounded mb-3"
                            />

                            <label className="text-[10px] text-neutral-400 uppercase font-bold block mb-2">Upload Pattern / Texture</label>
                            <input 
                                type="file" 
                                accept="image/*" 
                                key={`mat-${selectedMeshName}`} 
                                onChange={(e) => {
                                    const file = e.target.files[0];
                                    if(file) {
                                        setZoneSettings(prev => ({
                                            ...prev,
                                            [selectedMeshName]: { ...prev[selectedMeshName], texture: URL.createObjectURL(file) }
                                        }));
                                    }
                                }}
                                className="w-full text-xs text-neutral-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-[10px] file:bg-orange-600 file:text-white hover:file:bg-orange-500" 
                            />
                            <p className="text-[9px] text-neutral-500 mt-2 italic">
                                Note: Patterns wrap around the whole mesh. For front-only designs, use the Sticker section above.
                            </p>
                        </div>
                    </div>
                )}

                <button onClick={handleSaveConfiguration} className="w-full bg-green-600 text-white px-4 py-3 rounded-lg backdrop-blur hover:bg-green-500 transition-colors font-bold text-xs uppercase tracking-wider shadow-lg border border-green-400/30">
                    💾 Save Product Config
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}