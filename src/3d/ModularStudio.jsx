import React, { useState } from "react";
import { ArrowLeft } from "lucide-react";
import ModelUploader from "./component/ModelUploader";
import AssetPanel from "./component/AssetPanel";
import Workspace3D from "./component/Workspace3D";


export default function ModularStudio() {
  const [modelUrl, setModelUrl] = useState(null);
  const [layers, setLayers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [activeTab, setActiveTab] = useState('assets'); // 'assets' | 'edit'

  // State 1: No Model
  if (!modelUrl) {
    return <ModelUploader onUpload={setModelUrl} />;
  }

  // State 2: Studio Mode
  return (
    <div style={{display: 'flex', flexDirection:'column', height: '100dvh', width: '100vw', overflow:'hidden'}}>
      
      {/* Top Header */}
      <div style={{
        height: 60, background: 'rgba(20,20,20,0.9)', borderBottom: '1px solid #333', 
        display: 'flex', alignItems: 'center', padding: '0 20px', color: 'white', zIndex:50
      }}>
         <button onClick={() => setModelUrl(null)} style={{background:'none', border:'none', color:'#ccc', cursor:'pointer', display:'flex', alignItems:'center', gap:10, fontSize:14}}>
           <ArrowLeft size={20}/> Change Product
         </button>
      </div>

      {/* 3D Workspace */}
      <Workspace3D 
        modelUrl={modelUrl} 
        layers={layers} 
        setLayers={setLayers}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
      />

      {/* Bottom Panel */}
      <AssetPanel 
        layers={layers} 
        setLayers={setLayers}
        selectedId={selectedId} 
        setSelectedId={setSelectedId}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
    </div>
  );
}