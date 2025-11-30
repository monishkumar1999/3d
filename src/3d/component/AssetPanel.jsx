import React from 'react';
import { Image as ImageIcon, Type, Trash2, Layers, Check } from "lucide-react";
import { createTextTexture } from '../utils/helpers';

// Mobile Slider Component
const Slider = ({ label, value, min, max, step, onChange }) => (
  <div style={{marginBottom: 15}}>
    <div style={{display:'flex', justifyContent:'space-between', color:'#aaa', fontSize:12, marginBottom:5}}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <input 
      type="range" min={min} max={max} step={step} value={value} 
      onChange={(e) => onChange(parseFloat(e.target.value))}
      style={{width:'100%', accentColor: '#3b82f6', height: 4}}
    />
  </div>
);

const AssetPanel = ({ layers, setLayers, selectedId, setSelectedId, activeTab, setActiveTab }) => {
  
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const newLayer = { id: Date.now(), type: 'image', url, name: 'Image', x:0, y:0, z:0.2, scale:0.2, opacity:1 };
    setLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
    setActiveTab('edit');
  };

  const handleTextAdd = () => {
    const text = prompt("Enter text:", "Cool");
    if (!text) return;
    const url = createTextTexture(text);
    const newLayer = { id: Date.now(), type: 'text', url, name: text, x:0, y:0, z:0.2, scale:0.2, opacity:1 };
    setLayers(prev => [...prev, newLayer]);
    setSelectedId(newLayer.id);
    setActiveTab('edit');
  };

  const updateLayer = (prop, val) => {
    setLayers(prev => prev.map(l => l.id === selectedId ? {...l, [prop]: val} : l));
  };

  const selectedLayer = layers.find(l => l.id === selectedId);

  return (
    <div style={{
      position: 'absolute', bottom: 0, left: 0, right: 0, 
      background: 'rgba(20,20,20,0.95)', borderTop: '1px solid #333',
      borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20,
      backdropFilter: 'blur(10px)', maxHeight: '50vh', overflowY: 'auto'
    }}>
      
      {/* 1. EDIT MODE */}
      {activeTab === 'edit' && selectedLayer ? (
        <div>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20}}>
            <h3 style={{margin:0, color:'white', fontSize:16}}>Edit: {selectedLayer.name}</h3>
            <button onClick={() => {
               setLayers(prev => prev.filter(l => l.id !== selectedId));
               setSelectedId(null);
               setActiveTab('assets');
            }} style={{background:'#ef4444', border:'none', borderRadius:8, padding:8, color:'white'}}>
              <Trash2 size={18}/>
            </button>
          </div>
          <Slider label="Size" value={selectedLayer.scale} min={0.05} max={1.5} step={0.01} onChange={v => updateLayer('scale', v)} />
          <Slider label="Opacity" value={selectedLayer.opacity} min={0.1} max={1} step={0.1} onChange={v => updateLayer('opacity', v)} />
          <button onClick={() => setActiveTab('assets')} style={{width:'100%', padding:12, background:'#333', color:'white', border:'none', borderRadius:8, marginTop:10}}>Done</button>
        </div>
      ) : (
        /* 2. ASSET MODE */
        <div>
          <h3 style={{margin:"0 0 15px 0", color:'white', fontSize:16}}>Add Design</h3>
          <div style={{display:'flex', gap: 10, marginBottom: 20}}>
            <label style={{flex:1, background:'#333', padding:15, borderRadius:12, textAlign:'center', color:'white'}}>
              <ImageIcon size={24} style={{marginBottom:5}}/>
              <div style={{fontSize:12}}>Photo</div>
              <input type="file" hidden accept="image/*" onChange={handleImageUpload} />
            </label>
            <button onClick={handleTextAdd} style={{flex:1, background:'#333', padding:15, borderRadius:12, border:'none', color:'white'}}>
              <Type size={24} style={{marginBottom:5}}/>
              <div style={{fontSize:12}}>Text</div>
            </button>
          </div>

          <h4 style={{color:'#666', fontSize:12, textTransform:'uppercase', margin:'0 0 10px 0'}}>Your Layers</h4>
          <div style={{display:'flex', flexDirection:'column', gap:8}}>
            {layers.map(l => (
              <div key={l.id} onClick={() => { setSelectedId(l.id); setActiveTab('edit'); }} 
                style={{
                  padding:10, borderRadius:8, background: selectedId === l.id ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.05)',
                  border: selectedId === l.id ? '1px solid #3b82f6' : '1px solid transparent',
                  display:'flex', alignItems:'center', gap:10, color:'white'
                }}>
                <img src={l.url} style={{width:30, height:30, objectFit:'contain', background:'white', borderRadius:4}} />
                <span style={{flex:1, fontSize:13}}>{l.name}</span>
                {selectedId === l.id && <Check size={16} color="#3b82f6"/>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssetPanel;