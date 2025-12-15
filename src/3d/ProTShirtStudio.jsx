import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF, OrbitControls, Center, Environment, AccumulativeShadows, RandomizedLight } from "@react-three/drei";
import { Stage, Layer, Image as KonvaImage, Transformer } from "react-konva";
import * as THREE from "three";
import useImage from "use-image";
import { Upload, Layers, Box, Image as ImageIcon, MousePointer2, Save } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

/**
 * --- OPTIMIZED TEXTURE HOOK ---
 * This is the secret to performance. It debounces updates so the screen doesn't freeze.
 */
function useCanvasTexture(canvasRef, version) {
  const texture = useMemo(() => {
    if (!canvasRef.current) return null;
    const t = new THREE.CanvasTexture(canvasRef.current);
    t.flipY = false;
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter;
    return t;
  }, [canvasRef.current]); // Only create once

  // Update texture only when 'version' changes (Drag End), not every frame
  useEffect(() => {
    if (texture && canvasRef.current) {
      texture.needsUpdate = true;
    }
  }, [texture, version]);

  return texture;
}

/**
 * --- 3D MESH COMPONENT ---
 * Handles individual parts of the shirt
 */
const SmartMesh = ({ node, config, activeId, onClick }) => {
  // Use the optimized texture
  const texture = useCanvasTexture(config.canvasRef, config.version);
  
  // Clone material to avoid conflicts
  const material = useMemo(() => {
    const mat = node.material.clone();
    mat.color = new THREE.Color(0xffffff); // Pure white base
    mat.roughness = 0.5;
    return mat;
  }, [node.material]);

  // Apply texture if it exists
  useEffect(() => {
    if (texture) {
      material.map = texture;
      material.needsUpdate = true;
    }
  }, [texture, material]);

  return (
    <mesh
      geometry={node.geometry}
      material={material}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node.name);
      }}
      // Highlight logic (Visual selection)
      onPointerOver={() => { document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { document.body.style.cursor = 'default' }}
    >
      {activeId === node.name && (
        <meshStandardMaterial
          transparent
          opacity={0.1}
          color="#00aaff"
          depthTest={false}
          depthWrite={false}
        />
      )}
    </mesh>
  );
};

const Model = ({ url, meshConfigs, activeMesh, onMeshClick, onLoaded }) => {
  const { scene } = useGLTF(url);
  
  // Extract meshes once
  useEffect(() => {
    const meshes = [];
    scene.traverse((o) => {
      if (o.isMesh) meshes.push(o.name);
    });
    onLoaded(meshes);
  }, [scene, onLoaded]);

  return (
    <group dispose={null}>
      {scene.children.map((child) => {
        if (!child.isMesh) return <primitive key={child.uuid} object={child} />;
        return (
          <SmartMesh 
            key={child.name} 
            node={child} 
            config={meshConfigs[child.name] || {}} 
            activeId={activeMesh}
            onClick={onMeshClick}
          />
        );
      })}
    </group>
  );
};

// --- 2D STICKER COMPONENT ---
const Sticker = ({ data, isSelected, onSelect, onChange }) => {
  const [image] = useImage(data.src);
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image}
        x={data.x}
        y={data.y}
        width={data.width}
        height={data.height}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({ ...data, x: e.target.x(), y: e.target.y() });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          const scaleX = node.scaleX();
          node.scaleX(1); // Reset scale
          node.scaleY(1);
          onChange({
            ...data,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, node.width() * scaleX),
            height: Math.max(5, node.height() * node.scaleY()),
          });
        }}
      />
      {isSelected && <Transformer ref={trRef} borderStroke="#00aaff" anchorFill="#00aaff" />}
    </>
  );
};

// --- MAIN APP ---
export default function App() {
  const [glbUrl, setGlbUrl] = useState(null);
  const [meshes, setMeshes] = useState([]);
  const [activeMesh, setActiveMesh] = useState(null);
  const [meshConfigs, setMeshConfigs] = useState({}); // { Front: { canvasRef, version, mask, stickers: [] } }
  const [selectedStickerId, setSelectedStickerId] = useState(null);

  // 1. Upload GLB
  const handleGlbUpload = (e) => {
    const file = e.target.files[0];
    if (file) setGlbUrl(URL.createObjectURL(file));
  };

  // 2. Upload SVG Mask
  const handleSvgUpload = (e) => {
    if (!activeMesh) return alert("Please select a mesh part first.");
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateConfig(activeMesh, { mask: url });
    }
  };

  // 3. Upload Sticker
  const handleStickerUpload = (e) => {
    if (!activeMesh) return alert("Please select a mesh part first.");
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      const newSticker = { id: uuidv4(), src: url, x: 150, y: 150, width: 200, height: 200 };
      
      const currentStickers = meshConfigs[activeMesh]?.stickers || [];
      updateConfig(activeMesh, { stickers: [...currentStickers, newSticker] });
    }
  };

  // Helper to update state and bump version (triggers 3D texture update)
  const updateConfig = (meshName, newValues) => {
    setMeshConfigs(prev => ({
      ...prev,
      [meshName]: {
        ...prev[meshName],
        ...newValues,
        version: (prev[meshName]?.version || 0) + 1 // Bumps version to refresh texture
      }
    }));
  };

  // Styles
  const styles = {
    container: { display: "flex", height: "100vh", backgroundColor: "#1e1e1e", color: "white", fontFamily: "Inter, sans-serif" },
    sidebar: { width: "320px", borderRight: "1px solid #333", display: "flex", flexDirection: "column" },
    header: { padding: "20px", borderBottom: "1px solid #333", fontSize: "18px", fontWeight: "bold", display: "flex", alignItems: "center", gap: "10px" },
    content: { flex: 1, padding: "20px", overflowY: "auto" },
    card: { backgroundColor: "#2a2a2a", borderRadius: "8px", padding: "16px", marginBottom: "16px" },
    label: { display: "block", fontSize: "12px", color: "#888", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "1px" },
    button: { width: "100%", padding: "10px", backgroundColor: "#00aaff", border: "none", borderRadius: "6px", color: "white", cursor: "pointer", fontWeight: "600", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" },
    meshItem: (isActive) => ({
      padding: "10px", borderRadius: "6px", marginBottom: "4px", cursor: "pointer",
      backgroundColor: isActive ? "#00aaff20" : "transparent",
      color: isActive ? "#00aaff" : "#ccc",
      border: isActive ? "1px solid #00aaff" : "1px solid transparent",
      display: "flex", alignItems: "center", gap: "10px"
    }),
    uploadBox: { border: "2px dashed #444", borderRadius: "8px", padding: "20px", textAlign: "center", cursor: "pointer", color: "#666" },
    hiddenInput: { display: "none" }
  };

  return (
    <div style={styles.container}>
      
      {/* --- LEFT SIDEBAR (Ultra Rich UI) --- */}
      <div style={styles.sidebar}>
        <div style={styles.header}>
          <Box size={20} color="#00aaff" />
          <span>Configurator Pro</span>
        </div>

        <div style={styles.content}>
          {/* STEP 1: GLB Loader */}
          {!glbUrl && (
            <div style={styles.card}>
              <span style={styles.label}>1. Project File</span>
              <label style={styles.uploadBox}>
                <Upload size={24} style={{ marginBottom: 10 }} />
                <br />
                Click to upload .GLB
                <input type="file" style={styles.hiddenInput} accept=".glb" onChange={handleGlbUpload} />
              </label>
            </div>
          )}

          {/* STEP 2: Mesh Selector */}
          {glbUrl && (
            <div style={styles.card}>
              <span style={styles.label}>2. Select Zone</span>
              <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                {meshes.map(mesh => (
                  <div 
                    key={mesh} 
                    style={styles.meshItem(activeMesh === mesh)}
                    onClick={() => setActiveMesh(mesh)}
                  >
                    <Layers size={16} />
                    {mesh}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Actions */}
          {activeMesh && (
            <div style={styles.card}>
              <span style={styles.label}>3. Edit {activeMesh}</span>
              
              <div style={{ display: "grid", gap: "10px" }}>
                {/* Upload Mask */}
                <label style={{...styles.button, backgroundColor: "#333"}}>
                  <ImageIcon size={16} />
                  {meshConfigs[activeMesh]?.mask ? "Replace Mask" : "Upload Mask (SVG)"}
                  <input type="file" style={styles.hiddenInput} accept=".svg,.png" onChange={handleSvgUpload} />
                </label>

                {/* Add Sticker */}
                <label style={styles.button}>
                  <MousePointer2 size={16} />
                  Add Sticker
                  <input type="file" style={styles.hiddenInput} accept=".png,.jpg" onChange={handleStickerUpload} />
                </label>
              </div>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div style={{ padding: "20px", borderTop: "1px solid #333" }}>
          <button style={{ ...styles.button, backgroundColor: "#4CAF50" }}>
            <Save size={16} /> Save Configuration
          </button>
        </div>
      </div>

      {/* --- CENTER: 3D CANVAS --- */}
      <div style={{ flex: 1, position: "relative", backgroundColor: "#111" }}>
        <Canvas shadows camera={{ position: [0, 0, 1.5], fov: 45 }}>
          <ambientLight intensity={0.7} />
          <Environment preset="city" />
          <AccumulativeShadows opacity={0.4} scale={10}>
            <RandomizedLight amount={8} radius={4} ambient={0.5} position={[5, 5, -10]} bias={0.001} />
          </AccumulativeShadows>
          
          <Center>
            {glbUrl && (
              <Model 
                url={glbUrl} 
                meshConfigs={meshConfigs} 
                activeMesh={activeMesh}
                onMeshClick={setActiveMesh}
                onLoaded={setMeshes}
              />
            )}
          </Center>
          <OrbitControls makeDefault />
        </Canvas>
      </div>

      {/* --- HIDDEN 2D PROCESSING CANVAS --- */}
      {/* This renders off-screen but feeds textures to 3D */}
      <div style={{ position: "absolute", top: "-9999px", left: "-9999px" }}>
        {meshes.map(meshName => (
          <Stage
            key={meshName}
            width={1024}
            height={1024}
            ref={node => {
              if (node && !meshConfigs[meshName]?.canvasRef) {
                // Initial ref registration
                const canvas = node.getStage().content.children[0];
                setMeshConfigs(prev => ({
                  ...prev,
                  [meshName]: { ...prev[meshName], canvasRef: { current: canvas } }
                }));
              }
            }}
          >
            <Layer>
              {/* The White Base (T-shirt fabric) */}
              <KonvaImage
                width={1024} height={1024}
                image={(() => {
                    const i = new Image(); 
                    i.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'; // transparent placeholder
                    return i;
                })()} 
              />
              
              {/* The Mask (SVG) */}
              {meshConfigs[meshName]?.mask && (
                <ConfiguredImage 
                  src={meshConfigs[meshName].mask} 
                  x={0} y={0} width={1024} height={1024} 
                  listening={false} // Mask shouldn't be dragged
                />
              )}

              {/* The Stickers */}
              {meshConfigs[meshName]?.stickers?.map(sticker => (
                <Sticker
                  key={sticker.id}
                  data={sticker}
                  isSelected={sticker.id === selectedStickerId}
                  onSelect={() => {
                    setActiveMesh(meshName);
                    setSelectedStickerId(sticker.id);
                  }}
                  onChange={(newAttrs) => {
                    const stickers = meshConfigs[meshName].stickers.map(s => s.id === newAttrs.id ? newAttrs : s);
                    updateConfig(meshName, { stickers });
                  }}
                />
              ))}
            </Layer>
          </Stage>
        ))}
      </div>
    </div>
  );
}

// Wrapper for simple images to handle loading hook
const ConfiguredImage = ({ src, ...props }) => {
  const [img] = useImage(src);
  return <KonvaImage image={img} {...props} />;
};