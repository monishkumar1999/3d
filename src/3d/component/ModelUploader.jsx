import React from 'react';
import { Box, UploadCloud } from "lucide-react";

const ModelUploader = ({ onUpload }) => {
  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', 
      alignItems: 'center', justifyContent: 'center', background: '#121212', color: 'white'
    }}>
      <div style={{
        border: '2px dashed #444', padding: '40px 20px', borderRadius: 20, 
        textAlign: 'center', background: 'rgba(255,255,255,0.05)', maxWidth: 300
      }}>
        <div style={{
          width: 80, height: 80, background: 'rgba(59, 130, 246, 0.2)', 
          borderRadius: '50%', display:'flex', alignItems:'center', justifyContent:'center',
          margin: '0 auto 20px'
        }}>
          <Box size={40} color="#3b82f6" />
        </div>
        <h2 style={{margin: "0 0 10px 0", fontSize: 20}}>Start Project</h2>
        <p style={{color: '#888', marginBottom: 20, fontSize: 14}}>
          Upload a .GLB file (T-Shirt, Mug, etc)
        </p>
        <label style={{
          background: '#3b82f6', padding: '14px 28px', borderRadius: 50, 
          cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems:'center', 
          gap: 10, justifyContent:'center', boxShadow: '0 4px 15px rgba(59, 130, 246, 0.4)'
        }}>
          <UploadCloud size={20}/>
          <span>Upload 3D Model</span>
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

export default ModelUploader;