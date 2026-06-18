import React, { useState, useRef } from 'react';
import { Upload, Download, Settings2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';

export default function SvgConverter() {
    const [originalSvgText, setOriginalSvgText] = useState(null);
    const [originalImage, setOriginalImage] = useState(null);
    const [fileName, setFileName] = useState("");
    const [borderWidth, setBorderWidth] = useState(3);
    const [borderColor, setBorderColor] = useState("#000000"); // default to black
    const [fillOpacity, setFillOpacity] = useState(1);
    const [bgRemoval, setBgRemoval] = useState("transparent"); // 'transparent', 'white', 'black'
    const [isConverting, setIsConverting] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);

    const canvasRef = useRef(null);

    // Handle File Upload
    const handleFileUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.type === "image/svg+xml") {
            setFileName(file.name.replace(".svg", ""));
            const text = await file.text();
            setOriginalSvgText(text);
            setOriginalImage(null);
            processAndPreviewSvg(text, borderWidth, fillOpacity, borderColor);
        } else if (file.type.startsWith("image/")) {
            setFileName(file.name.replace(/\.[^/.]+$/, ""));
            setOriginalSvgText(null);
            
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    setOriginalImage(img);
                    processAndPreviewRaster(img, borderWidth, fillOpacity, borderColor, bgRemoval);
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            alert("Please upload a valid SVG or image file (PNG/JPEG/WebP).");
        }
    };

    // Process Raster Image and Generate Preview
    const processAndPreviewRaster = (img, currentStrokeWidth, currentFillOpacity, currentBorderColor, currentBgRemoval) => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');

            // Draw with a slight blur to soften potential aliasing/jaggedness in original
            ctx.filter = 'blur(2px)';
            ctx.drawImage(img, 0, 0);
            ctx.filter = 'none';

            // Get pixels for thresholding
            let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            let data = imageData.data;

            // Make solid white with custom opacity, filtering out background
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i + 1];
                const b = data[i + 2];
                let alpha = data[i + 3];

                let isBackground = false;
                if (currentBgRemoval === 'white') {
                    if (r > 220 && g > 220 && b > 220) {
                        isBackground = true;
                    }
                } else if (currentBgRemoval === 'black') {
                    if (r < 35 && g < 35 && b < 35) {
                        isBackground = true;
                    }
                }

                if (alpha < 10) {
                    isBackground = true;
                }

                if (!isBackground) {
                    data[i] = 255;
                    data[i + 1] = 255;
                    data[i + 2] = 255;
                    data[i + 3] = Math.round(255 * currentFillOpacity);
                } else {
                    data[i + 3] = 0;
                }
            }
            ctx.putImageData(imageData, 0, 0);

            // Keep the core white shape in a temporary canvas
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.drawImage(canvas, 0, 0);

            // Clear main canvas for drawing border and shape
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Dilation/Border (Strokes)
            if (currentStrokeWidth > 0) {
                const borderCanvas = document.createElement('canvas');
                borderCanvas.width = canvas.width;
                borderCanvas.height = canvas.height;
                const borderCtx = borderCanvas.getContext('2d');

                // Circular stamps to dilate
                const radius = Math.round(currentStrokeWidth);
                for (let dx = -radius; dx <= radius; dx++) {
                    for (let dy = -radius; dy <= radius; dy++) {
                        if (dx * dx + dy * dy <= radius * radius) {
                            borderCtx.drawImage(tempCanvas, dx, dy);
                        }
                    }
                }

                // Change dilated pixels to currentBorderColor
                const borderImgData = borderCtx.getImageData(0, 0, borderCanvas.width, borderCanvas.height);
                const borderData = borderImgData.data;
                const hexColor = currentBorderColor || "#000000";
                const r = parseInt(hexColor.slice(1, 3), 16);
                const g = parseInt(hexColor.slice(3, 5), 16);
                const b = parseInt(hexColor.slice(5, 7), 16);

                for (let i = 0; i < borderData.length; i += 4) {
                    if (borderData[i + 3] > 0) {
                        borderData[i] = r;
                        borderData[i + 1] = g;
                        borderData[i + 2] = b;
                    }
                }
                borderCtx.putImageData(borderImgData, 0, 0);

                // Draw dilated border
                ctx.drawImage(borderCanvas, 0, 0);
            }

            // Draw original white shape on top
            ctx.drawImage(tempCanvas, 0, 0);

            // Smooth the dilated edges slightly (anti-aliasing)
            const tempCanvas2 = document.createElement('canvas');
            tempCanvas2.width = canvas.width;
            tempCanvas2.height = canvas.height;
            const tempCtx2 = tempCanvas2.getContext('2d');
            tempCtx2.drawImage(canvas, 0, 0);

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.filter = 'blur(1.5px)';
            ctx.drawImage(tempCanvas2, 0, 0);
            ctx.filter = 'none';

            imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            data = imageData.data;

            const minVal = 60;
            const maxVal = 140;

            for (let i = 0; i < data.length; i += 4) {
                const alpha = data[i + 3];
                if (alpha >= maxVal) {
                    data[i + 3] = 255;
                } else if (alpha <= minVal) {
                    data[i + 3] = 0;
                } else {
                    const factor = (alpha - minVal) / (maxVal - minVal);
                    data[i + 3] = Math.round(factor * 255);
                }
            }
            ctx.putImageData(imageData, 0, 0);

            const url = canvas.toDataURL("image/png");
            setPreviewUrl(url);
        } catch (error) {
            console.error("Error processing raster image:", error);
        }
    };

    // Process SVG Text and Generate Preview
    const processAndPreviewSvg = (svgText, currentStrokeWidth, currentFillOpacity, currentBorderColor) => {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(svgText, "image/svg+xml");

            // Get all visible elements
            const shapes = doc.querySelectorAll('path, rect, circle, ellipse, line, polyline, polygon, g');

            shapes.forEach(shape => {
                // Apply Full White Fill
                const whiteFill = `rgba(255, 255, 255, ${currentFillOpacity})`;
                shape.setAttribute("fill", whiteFill);

                // Remove any inline styles completely to prevent overrides
                shape.removeAttribute("style");

                // Remove any fill-opacity / opacity that might make it transparent
                shape.removeAttribute("fill-opacity");
                shape.removeAttribute("opacity");
                shape.removeAttribute("fill-rule");

                // Apply Border (Stroke)
                if (currentStrokeWidth > 0) {
                    shape.setAttribute("stroke", currentBorderColor);
                    shape.setAttribute("stroke-width", currentStrokeWidth);
                    shape.setAttribute("stroke-linejoin", "round");
                    shape.setAttribute("stroke-linecap", "round");
                } else {
                    shape.removeAttribute("stroke");
                    shape.removeAttribute("stroke-width");
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
        let newBorder = borderWidth;
        let newFill = fillOpacity;
        let newColor = borderColor;
        let newBgRemoval = bgRemoval;

        if (type === 'border') {
            newBorder = value;
            setBorderWidth(value);
        }
        if (type === 'fill') {
            newFill = value;
            setFillOpacity(value);
        }
        if (type === 'borderColor') {
            newColor = value;
            setBorderColor(value);
        }
        if (type === 'bgRemoval') {
            newBgRemoval = value;
            setBgRemoval(value);
        }

        if (originalSvgText) {
            processAndPreviewSvg(originalSvgText, newBorder, newFill, newColor);
        } else if (originalImage) {
            processAndPreviewRaster(originalImage, newBorder, newFill, newColor, newBgRemoval);
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
                            Universal Mask Converter
                        </h2>
                        <p className="text-slate-400 text-sm mt-2">
                            Upload any SVG or image (PNG/JPEG). We'll instantly convert it to a solid white shape, add your desired border/stroke, and let you download a transparent PNG.
                        </p>
                    </div>

                    {/* Upload Box */}
                    <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-slate-600 hover:border-blue-500 hover:bg-blue-500/10 rounded-2xl cursor-pointer transition-all group">
                        <Upload size={32} className="text-slate-500 group-hover:text-blue-400 mb-3" />
                        <span className="text-sm font-semibold text-slate-300 group-hover:text-blue-300">
                            {fileName ? `Uploaded: ${fileName}` : "Click to upload an SVG or PNG/JPEG file"}
                        </span>
                        <input type="file" accept=".svg,image/*" onChange={handleFileUpload} className="hidden" />
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
                                    <span className="flex items-center gap-2 tracking-wide text-slate-300"><Settings2 size={16} /> Border Color</span>
                                    <span className="text-blue-400 font-bold uppercase">{borderColor}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => handleSettingsChange('borderColor', '#000000')}
                                        className={`w-10 h-10 rounded-full border-2 transition-all ${borderColor === '#000000' ? 'border-blue-500 scale-110 shadow-lg shadow-blue-500/30' : 'border-slate-600 hover:border-slate-500'}`}
                                        style={{ backgroundColor: '#000000' }}
                                        title="Black Border"
                                    />
                                    <button 
                                        type="button"
                                        onClick={() => handleSettingsChange('borderColor', '#ffffff')}
                                        className={`w-10 h-10 rounded-full border-2 transition-all ${borderColor === '#ffffff' ? 'border-blue-500 scale-110 shadow-lg shadow-blue-500/30' : 'border-slate-600 hover:border-slate-500'}`}
                                        style={{ backgroundColor: '#ffffff' }}
                                        title="White Border"
                                    />
                                    <div className="relative w-10 h-10 rounded-full border-2 border-slate-600 hover:border-slate-500 overflow-hidden flex items-center justify-center cursor-pointer bg-slate-800">
                                        <input 
                                            type="color" 
                                            value={borderColor} 
                                            onChange={(e) => handleSettingsChange('borderColor', e.target.value)}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        />
                                        <span className="text-[10px] font-bold text-slate-400">Custom</span>
                                    </div>
                                </div>
                            </div>

                            {originalImage && (
                                <div className="space-y-3">
                                    <div className="flex justify-between text-sm font-medium">
                                        <span className="flex items-center gap-2 tracking-wide text-slate-300"><Settings2 size={16} /> Background Removal</span>
                                    </div>
                                    <select
                                        value={bgRemoval}
                                        onChange={(e) => handleSettingsChange('bgRemoval', e.target.value)}
                                        className="w-full bg-slate-800 border border-slate-700 text-slate-300 rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
                                    >
                                        <option value="transparent">None (Keep Transparent)</option>
                                        <option value="white">Remove White Background</option>
                                        <option value="black">Remove Black Background</option>
                                    </select>
                                </div>
                            )}

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
                                        Download Mask PNG
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
                                <p className="font-medium text-sm">Upload an SVG or image to preview</p>
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
