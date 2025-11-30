import React, { useState, useEffect, useMemo, Suspense } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import { 
  useGLTF, 
  Decal, 
  Environment, 
  OrbitControls, 
  Center, 
  useTexture, 
  AccumulativeShadows, 
  RandomizedLight
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
  RotateCcw,
  Check
} from "lucide-react";
import { v4 as uuidv4 } from 'uuid';

/* =========================================
   1. MOBILE-FIRST THEME & STYLES
   ========================================= */
const THEME = {
  bg: "#121212",
  panel: "rgba(20, 20, 20, 0.9)", 
  accent: "#3b82f6",
  text: "#ffffff",
  danger: "#ef4444",
};

const styles = {
  container: {
    width: "100%",
    height: "100vh", 
    height: "100dvh", 
    background: "radial-gradient(circle at 50% 50%, #2a2a2a 0%, #000000 100%)",
    color: THEME.text,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    overflow: "hidden", 
    position: "fixed",  
    inset: 0,
    touchAction: "none", 
    userSelect: "none",  
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    padding: "0 20px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 50,
    background: "linear-gradient(180deg, rgba(0,0,0,0.8) 0%, transparent 100%)",
    pointerEvents: "none" 
  },
  headerBtn: {
    pointerEvents: "auto",
    background: "rgba(255,255,255,0.1)",
    border: "1px solid rgba(255,255,255,0.2)",
    borderRadius: "50%",
    width: 44, 
    height: 44,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    backdropFilter: "blur(10px)",
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 80,
    background: THEME.panel,
    backdropFilter: "blur(20px)",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    display: "flex",
    justifyContent: "space-around", 
    alignItems: "center",
    zIndex: 50,
    paddingBottom: "env(safe-area-inset-bottom)", 
  },
  navItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    background: "transparent",
    border: "none",
    color: "#888",
    fontSize: 10,
    fontWeight: 600,
    width: 60,
    height: 60,
  },
  activeNav: {
    color: THEME.accent,
  },
  toolPanel: {
    position: "absolute",
    bottom: 80, 
    left: 0,
    right: 0,
    background: "rgba(0,0,0,0.85)",
    backdropFilter: "blur(20px)",
    borderTop: "1px solid rgba(255,255,255,0.1)",
    padding: "20px 20px 30px 20px",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 40,
    transition: "transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)",
    maxHeight: "50vh",
    overflowY: "auto",
  },
  sliderContainer: {
    marginBottom: 20,
  },
  sliderLabel: {
    display: 'flex', 
    justifyContent: 'space-between', 
    marginBottom: 8, 
    fontSize: 14, 
    fontWeight: 500,
    color: "#ccc"
  },
  sliderInput: {
    width: "100%",
    height: 6,
    accentColor: THEME.accent,
    borderRadius: 10,
    outline: "none"
  },
  joystickContainer: {
    position: "absolute",
    bottom: 100,
    right: 20,
    zIndex: 30,
    opacity: 0.8,
    transition: "opacity 0.3s"
  }
};

/* =========================================
   2. UTILITIES
   ========================================= */
const FALLBACK_TEXTURE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=";

const BigSlider = ({ label, value, min, max, step, onChange, icon: Icon }) => (
  <div style={styles.sliderContainer}>
    <div style={styles.sliderLabel}>
      <div style={{display:'flex', gap: 8, alignItems:'center'}}>
        {Icon && <Icon size={18} />}
        {label}
      </div>
      <span>{value}</span>
    </div>
    <input 
      type="range" 
      min={min} max={max} step={step} 
      value={value} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={styles.sliderInput} 
    />
  </div>
);

/* =========================================
   3. 3D COMPONENTS
   ========================================= */

const DecalLayer = ({ layer }) => {
  const texture = useTexture(layer.url || FALLBACK_TEXTURE);
  return (
    <Decal
      position={[layer.x, layer.y, layer.z]}
      rotation={[layer.rotX || 0, layer.rotY || 0, layer.rotZ || 0]}
      // FIX APPLIED HERE: Z-scale increased to 1.2
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

function ShirtModel({ config, layers, setLayers, selectedLayerId, setSelectedLayerId, setPanelOpen }) {
  const gltf = useGLTF("/models/tshirt.glb");
  const [isDragging, setIsDragging] = useState(false);
  
  const meshData = useMemo(() => {
    let found = null;
    gltf.scene.traverse((child) => {
      if (child.isMesh && !found) found = child;
    });
    return found;
  }, [gltf.scene]);

  const material = useMemo(() => {
    if (!meshData) return new THREE.MeshStandardMaterial();
    return meshData.material.clone();
  }, [meshData]);

  useFrame(() => {
    if (material) {
      material.color.set(config.color);
      material.roughness = config.roughness;
      material.metalness = config.metalness;
    }
  });

  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (selectedLayerId) {
      setIsDragging(true);
      if (window.orbitControls) window.orbitControls.enabled = false;
    }
  };

  const handlePointerUp = (e) => {
    e.stopPropagation();
    setIsDragging(false);
    if (window.orbitControls) window.orbitControls.enabled = true;
  };

  const handlePointerMove = (e) => {
    if (!isDragging || !selectedLayerId) return;
    const { point, face } = e;
    if (!point || !face) return;

    const normal = face.normal.clone();
    normal.transformDirection(e.object.matrixWorld);
    const dummy = new THREE.Object3D();
    dummy.position.copy(point);
    dummy.lookAt(point.clone().add(normal));
    
    setLayers(prev => prev.map(l => {
      if (l.id === selectedLayerId) {
        return {
          ...l,
          x: point.x,
          y: point.y,
          z: point.z,
          rotX: dummy.rotation.x,
          rotY: dummy.rotation.y,
          rotZ: dummy.rotation.z
        };
      }
      return l;
    }));
  };

  if (!meshData) return null;

  return (
    <group dispose={null}>
      <mesh
        castShadow
        receiveShadow
        geometry={meshData.geometry}
        material={material}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerMove={handlePointerMove}
      >
        {layers.map((layer, index) => (
          layer.visible && (
            <DecalLayer 
              key={layer.id} 
              layer={{...layer, order: index + 1}} 
            />
          )
        ))}
      </mesh>
    </group>
  );
}

function ScreenshotHandler({ takeScreenshot, onCaptured }) {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (takeScreenshot) {
      gl.render(scene, camera);
      const data = gl.domElement.toDataURL("image/png");
      const link = document.createElement("a");
      link.setAttribute("download", `design-${Date.now()}.png`);
      link.setAttribute("href", data);
      link.click();
      onCaptured();
    }
  }, [takeScreenshot, gl, scene, camera, onCaptured]);
  return null;
}

/* =========================================
   4. MAIN APPLICATION
   ========================================= */

export default function MobileTShirtStudio() {
  const [config, setConfig] = useState({
    color: "#ffffff",
    roughness: 0.6,
    metalness: 0.1,
    envIntensity: 1,
  });

  const [layers, setLayers] = useState([]);
  const [selectedLayerId, setSelectedLayerId] = useState(null);
  
  const [activePanel, setActivePanel] = useState('none');
  const [screenshotTrigger, setScreenshotTrigger] = useState(false);

  // --- ACTIONS ---

  const handleUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newLayer = {
        id: uuidv4(),
        name: `Layer ${layers.length + 1}`,
        url: url,
        x: 0, y: 0.04, z: 0.15,
        rotX: 0, rotY: 0, rotZ: 0,
        scale: 0.15,
        opacity: 1,
        visible: true,
      };
      setLayers([...layers, newLayer]);
      setSelectedLayerId(newLayer.id);
      setActivePanel('edit'); 
    }
  };

  const updateLayer = (prop, value) => {
    if (!selectedLayerId) return;
    setLayers(prev => prev.map(l => 
      l.id === selectedLayerId ? { ...l, [prop]: value } : l
    ));
  };

  const handleJoystickMove = (evt) => {
    if (!selectedLayerId) return;
    setLayers(prev => prev.map(l => {
      if (l.id === selectedLayerId) {
        const speed = 0.002;
        return {
          ...l,
          x: l.x + (evt.x * speed),
          y: l.y + (evt.y * speed)
        };
      }
      return l;
    }));
  };

  // --- UI RENDERERS ---

  const renderEditPanel = () => {
    const l = layers.find(x => x.id === selectedLayerId);
    if (!l) return <div style={{textAlign:'center', padding: 20, color: '#666'}}>Select a layer to edit</div>;

    return (
      <div style={{animation: "slideUp 0.3s"}}>
         <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 20}}>
            <h3 style={{margin:0, color:'white'}}>Edit: {l.name}</h3>
            <button 
              onClick={() => {
                 setLayers(prev => prev.filter(item => item.id !== l.id));
                 setSelectedLayerId(null);
                 setActivePanel('none');
              }}
              style={{background: THEME.danger, border:'none', borderRadius: 8, padding: '8px 12px', color:'white', display:'flex', gap:5}}
            >
              <Trash2 size={16}/> Delete
            </button>
         </div>

         <BigSlider 
            label="Size" icon={Maximize}
            value={parseFloat(l.scale.toFixed(2))} 
            min={0.05} max={1.0} step={0.01} 
            onChange={(v) => updateLayer("scale", v)} 
         />
         <BigSlider 
            label="Opacity" icon={Eye}
            value={l.opacity} 
            min={0.1} max={1} step={0.1} 
            onChange={(v) => updateLayer("opacity", v)} 
         />
         
         <div style={{fontSize: 12, color: '#666', marginTop: 10, textAlign:'center'}}>
           Tip: You can also drag the image on the shirt directly.
         </div>
      </div>
    );
  };

  const renderColorPanel = () => (
    <div>
      <h3 style={{margin: "0 0 20px 0", color:'white'}}>Shirt Color</h3>
      <div style={{display:'flex', gap: 12, overflowX:'auto', paddingBottom: 10}}>
         {['#ffffff', '#000000', '#1a1a1a', '#880000', '#003366', '#004400', '#FFD700', '#555555', '#333333'].map(c => (
            <div 
              key={c}
              onClick={() => setConfig({...config, color: c})}
              style={{
                flexShrink: 0,
                width: 50, height: 50, borderRadius: '50%', background: c, 
                border: config.color === c ? `3px solid ${THEME.accent}` : '2px solid rgba(255,255,255,0.2)',
                boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
              }}
            />
         ))}
      </div>
      <div style={{marginTop: 20}}>
        <BigSlider label="Roughness" icon={Palette} value={config.roughness} min={0} max={1} step={0.1} onChange={(v) => setConfig({...config, roughness: v})} />
      </div>
    </div>
  );

  const renderLayersPanel = () => (
    <div>
       <h3 style={{margin: "0 0 20px 0", color:'white'}}>Layers ({layers.length})</h3>
       {layers.length === 0 && <div style={{color:'#666', textAlign:'center'}}>No layers yet.</div>}
       <div style={{display:'flex', flexDirection:'column', gap: 10}}>
         {layers.map(layer => (
           <div 
             key={layer.id}
             onClick={() => { setSelectedLayerId(layer.id); setActivePanel('edit'); }}
             style={{
               display:'flex', alignItems:'center', gap: 15, padding: 12, 
               background: selectedLayerId === layer.id ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)',
               border: selectedLayerId === layer.id ? `1px solid ${THEME.accent}` : '1px solid transparent',
               borderRadius: 12
             }}
           >
             <img src={layer.url} style={{width: 40, height: 40, objectFit:'contain', background:'white', borderRadius: 4}} alt="" />
             <div style={{flex:1, fontWeight:'bold', fontSize: 14}}>{layer.name}</div>
             {selectedLayerId === layer.id && <Check size={20} color={THEME.accent} />}
           </div>
         ))}
       </div>
    </div>
  );

  return (
    <div style={styles.container}>
      
      {/* 1. HEADER */}
      <div style={styles.header}>
        <div style={{fontWeight: 900, fontSize: 20, color: 'white', display:'flex', alignItems:'center', gap: 6}}>
           <div style={{width:10, height:10, background:THEME.accent, borderRadius:'50%'}}/> 
           STUDIO
        </div>
        <div style={{display:'flex', gap: 10}}>
          <button style={styles.headerBtn} onClick={() => { if(window.orbitControls) window.orbitControls.reset() }}>
             <RotateCcw size={20}/>
          </button>
          <button style={{...styles.headerBtn, background: THEME.accent, border:'none'}} onClick={() => setScreenshotTrigger(true)}>
             <Camera size={20}/>
          </button>
        </div>
      </div>

      {/* 2. SLIDING TOOL PANEL */}
      <div style={{
          ...styles.toolPanel,
          transform: activePanel === 'none' ? 'translateY(120%)' : 'translateY(0)'
        }}>
         <div 
           onClick={() => setActivePanel('none')}
           style={{width: 40, height: 5, background: 'rgba(255,255,255,0.2)', borderRadius: 10, margin: '0 auto 20px auto'}}
         />
         
         {activePanel === 'edit' && renderEditPanel()}
         {activePanel === 'color' && renderColorPanel()}
         {activePanel === 'layers' && renderLayersPanel()}
      </div>

      {/* 3. JOYSTICK */}
      {selectedLayerId && (
        <div style={styles.joystickContainer}>
           <Joystick size={80} baseColor="rgba(0,0,0,0.5)" stickColor={THEME.accent} move={handleJoystickMove} throttle={10}/>
        </div>
      )}

      {/* 4. BOTTOM NAV BAR */}
      <div style={styles.bottomBar}>
         
         {/* UPLOAD */}
         <label style={{
            width: 60, height: 60, background: 'white', borderRadius: '50%', 
            display:'flex', alignItems:'center', justifyContent:'center', 
            color:'black', boxShadow:'0 0 20px rgba(255,255,255,0.3)', marginBottom: 30
         }}>
            <PlusCircle size={32} />
            <input type="file" onChange={handleUpload} style={{display:'none'}} accept="image/*" />
         </label>

         <button 
           style={{...styles.navItem, ...(activePanel === 'layers' ? styles.activeNav : {})}} 
           onClick={() => setActivePanel(activePanel === 'layers' ? 'none' : 'layers')}
         >
           <Layers size={24} />
           Layers
         </button>

         <button 
           style={{...styles.navItem, ...(activePanel === 'color' ? styles.activeNav : {})}} 
           onClick={() => setActivePanel(activePanel === 'color' ? 'none' : 'color')}
         >
           <Palette size={24} />
           Color
         </button>

         <button 
           style={{...styles.navItem, ...(activePanel === 'edit' ? styles.activeNav : {})}} 
           onClick={() => selectedLayerId ? setActivePanel(activePanel === 'edit' ? 'none' : 'edit') : alert("Add a layer first")}
           style={{opacity: selectedLayerId ? 1 : 0.3}}
         >
           <Settings size={24} />
           Edit
         </button>

      </div>

      {/* 5. CANVAS */}
      <Canvas shadows camera={{ position: [0, 0, 0.75], fov: 50 }} gl={{ preserveDrawingBuffer: true, antialias: true, pixelRatio: window.devicePixelRatio }}>
        <color attach="background" args={[THEME.bg]} />
        <ambientLight intensity={0.5} />
        <Environment preset="city" background={false} blur={0.8} />
        <AccumulativeShadows temporal frames={60} alphaTest={0.85} scale={10} position={[0, -0.5, 0]}>
           <RandomizedLight amount={8} radius={5} ambient={0.5} position={[5, 5, -10]} bias={0.001} />
        </AccumulativeShadows>

        <Center>
          <Suspense fallback={null}>
            <ShirtModel 
              config={config} 
              layers={layers} 
              setLayers={setLayers}
              selectedLayerId={selectedLayerId} 
              setSelectedLayerId={setSelectedLayerId}
            />
          </Suspense>
        </Center>

        <OrbitControls makeDefault minDistance={0.5} maxDistance={2} enablePan={false} onEnd={(e) => { window.orbitControls = e.target }} />
        <ScreenshotHandler takeScreenshot={screenshotTrigger} onCaptured={() => setScreenshotTrigger(false)} />
        <ambientLight intensity={config.envIntensity * 0.5} />
      </Canvas>
    </div>
  );
}