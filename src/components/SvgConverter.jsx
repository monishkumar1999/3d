import React, { useState, useRef } from 'react';
import { Upload, Download, Settings2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

export default function SvgConverter() {
    const [originalSvgText, setOriginalSvgText] = useState(null);
    const [fileName, setFileName] = useState("");
    const [borderWidth, setBorderWidth] = useState(3);
    const [fillOpacity, setFillOpacity] = useState(1);
    const [isConverting, setIsConverting] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);

    const canvasRef = useRef(null);

    // Handle File Upload
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file || file.type !== "image/svg+xml") {
            alert("Please upload a valid SVG file.");
            return;
        }

        setFileName(file.name.replace(".svg", ""));
        const text = await file.text();
        setOriginalSvgText(text);
        processAndPreviewSvg(text, borderWidth, fillOpacity);
    };

    // Process SVG Text and Generate Preview
    const processAndPreviewSvg = (svgText, currentStrokeWidth, currentFillOpacity) => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, "image/svg+xml");
            
            // Get all visible elements
            const shapes = doc.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon, g');

            shapes.forEach(shape => {
                // Apply Full White Fill
                // We use rgba for fill to support opacity
                const whiteFill = `rgba(255, 255, 255, ${currentFillOpacity})`;
                shape.setAttribute("fill", whiteFill);
                
                // Remove inline styles that might override attributes
                if (shape.getAttribute("style")) {
                    shape.setAttribute("style", shape.getAttribute('style').replace(/fill:[^;]+;?/i, ''));
                    shape.setAttribute("style", shape.getAttribute('style').replace(/stroke:[^;]+;?/i, ''));
                }

                // Apply White Border (Stroke)
                if (currentStrokeWidth > 0) {
                    shape.setAttribute("stroke", "#ffffff");
                    shape.setAttribute("stroke-width", currentStrokeWidth);
                    shape.setAttribute("stroke-linejoin", "round");
                    shape.setAttribute("stroke-linecap", "round");
                } else {
                    shape.removeAttribute("stroke");
                }
            });

            const serializer = new XMLSerializer();
            const newSvgText = serializer.serializeToString(doc);

            // Create a blob URL for the modified SVG
            const blob = new Blob([newSvgText], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            setPreviewUrl(url);

        } catch (error) {
            console.error("Error processing SVG:", error);
            alert("Failed to read SVG file structure.");
        }
    };

    // Handle Setting Changes
    const handleSettingsChange = (type, value) => {
        if (type === 'border') {
            setBorderWidth(value);
            if (originalSvgText) processAndPreviewSvg(originalSvgText, value, fillOpacity);
        }
        if (type === 'fill') {
            setFillOpacity(value);
            if (originalSvgText) processAndPreviewSvg(originalSvgText, borderWidth, value);
        }
    };

    // Export to High-Res PNG
    const downloadPng = () => {
        if (!previewUrl) return;
        setIsConverting(true);

        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");

            // We export at 3x resolution for high quality
            const exportScale = 3; 
            
            canvas.width = img.width * exportScale;
            canvas.height = img.height * exportScale;

            // Clear canvas (transparent background)
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw image scaled up
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            // Convert to PNG and Download
            const dataUrl = canvas.toDataURL("image/png", 1.0);
            
            const link = document.createElement("a");
            link.download = `${fileName}_white_converted.png`;
            link.href = dataUrl;
            link.click();

            setIsConverting(false);
        };
        img.src = previewUrl;
    };

    return (
        <div className="min-h-screen bg-[#0f172a] text-white p-8 flex items-center justify-center font-sans">
            <div className="w-full max-w-4xl grid md:grid-cols-2 gap-8 items-start">
                
                {/* Left Column: Upload & Settings */}
                <div className="bg-[#1e293b] p-8 rounded-3xl shadow-2xl border border-white/5 space-y-8">
                    
                    <div>
                        <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent flex items-center gap-2">
                            <ImageIcon size={28} className="text-blue-400" />
                            SVG Output Converter
                        </h2>
                        <p className="text-slate-400 text-sm mt-2">
                            Upload a black/colored SVG. We'll instantly convert it to a solid white shape, add your desired border, and let you download a transparent PNG.
                        </p>
                    </div>

                    {/* Upload Box */}
                    <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-600 hover:border-blue-500 hover:bg-blue-500/10 rounded-2xl cursor-pointer transition-all group">
                        <Upload size={32} className="text-slate-500 group-hover:text-blue-400 mb-3" />
                        <span className="text-sm font-semibold text-slate-300 group-hover:text-blue-300">
                            {fileName ? `Uploaded: ${fileName}.svg` : "Click to upload an SVG file"}
                        </span>
                        <input type="file" accept=".svg" onChange={handleFileUpload} className="hidden" />
                    </label>

                    {/* Controls */}
                    {previewUrl && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="flex items-center gap-2 tracking-wide text-slate-300"><Settings2 size={16} /> Border Thickness</span>
                                    <span className="text-blue-400 font-bold">{borderWidth}px</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" max="20" step="0.5" 
                                    value={borderWidth} 
                                    onChange={(e) => handleSettingsChange('border', Number(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-blue-500 cursor-pointer"
                                />
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="flex items-center gap-2 tracking-wide text-slate-300"><Settings2 size={16} /> Fill Opacity</span>
                                    <span className="text-blue-400 font-bold">{Math.round(fillOpacity * 100)}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="0" max="1" step="0.05" 
                                    value={fillOpacity} 
                                    onChange={(e) => handleSettingsChange('fill', Number(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none accent-blue-500 cursor-pointer"
                                />
                            </div>

                            <button 
                                onClick={downloadPng}
                                disabled={isConverting}
                                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-blue-900/50 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                            >
                                {isConverting ? (
                                    <span className="animate-pulse">Processing High-Res Image...</span>
                                ) : (
                                    <>
                                        <Download size={20} />
                                        Download White PNG
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Column: Preview window (Dark background so white shows up clearly) */}
                <div className="bg-[#1e293b] p-2 rounded-3xl shadow-2xl border border-white/5 h-[600px] flex flex-col relative overflow-hidden group">
                    <div className="absolute top-6 left-6 z-10 flex items-center gap-2 bg-black/50 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">Live Preview</span>
                    </div>

                    <div className="flex-1 w-full h-full bg-[#0f172a] rounded-2xl flex items-center justify-center p-8 relative overflow-hidden" 
                         style={{ 
                             backgroundImage: 'radial-gradient(#334155 1px, transparent 1px)', 
                             backgroundSize: '24px 24px' 
                         }}>
                        
                        {previewUrl ? (
                            <img 
                                src={previewUrl} 
                                alt="Converted Output" 
                                className="w-full h-full object-contain filter drop-shadow-2xl transition-all duration-300"
                            />
                        ) : (
                            <div className="text-center text-slate-600 flex flex-col items-center gap-3">
                                <ImageIcon size={48} className="opacity-50" />
                                <p className="font-medium text-sm">Upload an SVG to preview</p>
                            </div>
                        )}
                        
                    </div>
                </div>

            </div>

            {/* Hidden canvas for exporting to PNG */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
