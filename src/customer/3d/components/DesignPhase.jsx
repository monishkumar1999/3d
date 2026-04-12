import React, { useCallback, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, OrbitControls, Center, ContactShadows, Html, useProgress } from "@react-three/drei";
import { Type, Palette, Upload, Download, Image as ImageIcon, ChevronLeft, X, Save, Trash, Minus, Plus, Maximize, Settings, Layers, Wand2, Check, Droplet, Sun, Moon, Sunset, Scan, Lightbulb, Cloud, Trees, Building2, Menu, Eye, EyeOff, RotateCcw, RotateCw, Camera, Share2, Info } from "lucide-react";
import * as THREE from "three";
import AttractiveColorPicker from "../../components/ui/AttractiveColorPicker";
import { useStore } from "../../store/useStore";
import { createOptimizedImageUrl, LARGE_UPLOAD_THRESHOLD_BYTES } from "../../utils/imageOptimizer";

import DynamicModel from "./DynamicModel";
import PatternZone from "./PatternZone";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter";
import api from "../../api/axios";
import { submitDesignRequest } from "../../api/ai-design";




const PRESET_COLORS = [
    "#000000", "#FFFFFF", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#6366F1", "#8B5CF6", "#EC4899"
];

const FONTS = [
    { name: "Inter", family: "Inter" },
    { name: "Roboto", family: "Roboto" },
    { name: "Lato", family: "Lato" },
    { name: "Montserrat", family: "Montserrat" },
    { name: "Poppins", family: "Poppins" },
    { name: "Open Sans", family: "Open Sans" },
    { name: "Oswald", family: "Oswald" },
    { name: "Playfair", family: "Playfair Display" },
    { name: "Merriweather", family: "Merriweather" },
    { name: "Lora", family: "Lora" },
    { name: "Cinzel", family: "Cinzel" },
    { name: "Bebas Neue", family: "Bebas Neue" },
    { name: "Anton", family: "Anton" },
    { name: "Righteous", family: "Righteous" },
    { name: "Lobster", family: "Lobster" },
    { name: "Pacifico", family: "Pacifico" },
    { name: "Dancing Script", family: "Dancing Script" },
    { name: "Satisfaction", family: "Satisfy" },
    { name: "Caveat", family: "Caveat" },
    { name: "Indie Flower", family: "Indie Flower" },
    { name: "Sacramento", family: "Sacramento" },
    { name: "Permanent Marker", family: "Permanent Marker" },
    { name: "Inconsolata", family: "Inconsolata" },
];

// Helper Button
const Button = ({ children, onClick, variant = "primary", className = "", disabled = false, icon: Icon }) => {
    const baseStyle = "flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";
    const variants = {
        primary: "bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/40",
        secondary: "bg-white hover:bg-zinc-50 text-zinc-700 border border-zinc-200 shadow-sm",
    };
    return (
        <button onClick={onClick} disabled={disabled} className={`${baseStyle} ${variants[variant]} ${className}`}>
            {Icon && <Icon size={18} />}
            {children}
        </button>
    );
};

// Background Handler Component
const BackgroundHandler = ({ type, color, imageUrl }) => {
    const { scene } = useThree();

    useEffect(() => {
        if (type === 'solid') {
            scene.background = new THREE.Color(color);
        } else if (type === 'image' && imageUrl) {
            new THREE.TextureLoader().load(imageUrl, (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                scene.background = texture;
            });
        } else {
            scene.background = null; // Transparent
        }
    }, [type, color, imageUrl, scene]);

    return null;
};

// Simple Loading Screen
const Loader = () => {
    const { progress } = useProgress();
    return (
        <Html center>
            <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-indigo-600">{progress.toFixed(0)}%</p>
            </div>
        </Html>
    );
};

const DebouncedColorPicker = ({ value, onChange, className }) => {
    return (
        <div className={`relative ${className}`}>
            <AttractiveColorPicker
                color={value}
                onChange={onChange}

                className="w-full"
            />
        </div>
    );
};

// Helper UI: AI Prompt Side Panel
const AIPanel = ({ screenshot, onClose, onSubmit, isOpen }) => {
    const [prompt, setPrompt] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Normalize to object if string
    const images = typeof screenshot === 'string' ? { front: screenshot } : (screenshot || {});

    // Mock Recent Variants
    const [selectedVariant, setSelectedVariant] = useState(null);
    const variants = [
        { id: 1, img: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=400&q=80", label: "Variant 1" },
        { id: 2, img: "https://images.unsplash.com/photo-1542272617-08f086303b96?auto=format&fit=crop&w=400&q=80", label: "Variant 2" },
    ];

    const handleSubmit = async () => {
        if (!prompt.trim()) return;
        setIsSubmitting(true);
        try {
            await onSubmit(prompt, images);
        } catch (err) {
            // console.error(err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`absolute top-0 right-0 h-full w-[35%] min-w-[320px] bg-white border-l border-zinc-100 shadow-2xl z-[60] pointer-events-auto flex flex-col transition-transform duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
            <div className="flex-1 overflow-y-auto p-8 flex flex-col gap-8">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900">AI Design Assistant</h2>
                        <p className="text-xs text-zinc-500 mt-1">Describe changes using the captured context.</p>
                    </div>
                    <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Input Area */}
                <div className="space-y-6">
                    <div className="relative group">
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full h-40 p-4 bg-white border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none outline-none text-zinc-700 transition-all placeholder:text-zinc-300 text-sm shadow-sm hover:shadow-md"
                            placeholder="Describe your vision... (e.g., 'Make it denim with gold stitching')"
                        />
                        <button className="absolute bottom-3 right-3 p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl transition-colors">
                            <Wand2 size={16} />
                        </button>
                    </div>

                    {/* AI Tips */}
                    <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/50">
                        <h4 className="text-[10px] font-bold text-indigo-900 mb-3 uppercase tracking-wider opacity-70">AI Tips</h4>
                        <div className="flex flex-wrap gap-2">
                            {['Modern', 'Vintage', 'Leather', 'Floral', 'Dark Mode'].map(tag => (
                                <button key={tag} onClick={() => setPrompt(p => p + (p ? ' ' : '') + tag)} className="text-[10px] font-medium px-3 py-1.5 bg-white border border-indigo-100 rounded-lg text-indigo-600 hover:text-indigo-800 hover:border-indigo-300 transition-all shadow-sm">
                                    +{tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Recent Variants (Mock UI) */}
                    <div>
                        <h4 className="text-[10px] font-bold text-zinc-500 mb-3 uppercase tracking-wider">Recent Variants</h4>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {variants.map(v => (
                                <div
                                    key={v.id}
                                    onClick={() => setSelectedVariant(v.id)}
                                    className={`relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden cursor-pointer border-2 transition-all group ${selectedVariant === v.id ? 'border-indigo-600 ring-2 ring-indigo-600/20' : 'border-transparent hover:border-zinc-200'}`}
                                >
                                    <img src={v.img} alt={v.label} className="w-full h-full object-cover" />
                                    {selectedVariant === v.id && (
                                        <div className="absolute inset-0 bg-indigo-600/10 flex items-center justify-center">
                                            <div className="bg-indigo-600 text-white p-1 rounded-full"><Check size={12} /></div>
                                        </div>
                                    )}
                                </div>
                            ))}
                            <button className="flex-shrink-0 w-24 h-24 rounded-2xl border-2 border-dashed border-zinc-200 flex items-center justify-center text-zinc-300 hover:text-zinc-500 hover:border-zinc-300 transition-colors">
                                <Plus size={24} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-100 flex items-center gap-4 bg-white">
                <button
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-semibold text-zinc-500 hover:text-zinc-800 transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !prompt.trim()}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                    {isSubmitting ? 'Processing...' : 'Generate'} <Wand2 size={16} />
                </button>
            </div>
        </div>
    );
};

// Helper to resize/compress image
const compressImage = (base64Str, maxWidth = 600) => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const scale = maxWidth / img.width;
            const finalScale = scale < 1 ? scale : 1;

            canvas.width = img.width * finalScale;
            canvas.height = img.height * finalScale;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            // Save as JPEG with 0.7 quality to reduce size
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
    });
};

// Helper Component: Capture Controller (Invisible)
const CaptureController = React.forwardRef((props, ref) => {
    const { camera, gl, scene } = useThree();

    React.useImperativeHandle(ref, () => ({
        captureAll: async () => {
            const originalPos = camera.position.clone();
            const originalRot = camera.rotation.clone();

            const angles = [
                { name: 'front', pos: [0, 0, 3.5] },
                { name: 'right', pos: [3.5, 0, 0] },
                { name: 'back', pos: [0, 0, -3.5] },
                { name: 'left', pos: [-3.5, 0, 0] },
            ];

            const screenshots = {};

            for (const angle of angles) {
                // Move Camera
                camera.position.set(...angle.pos);
                camera.lookAt(0, 0, 0);
                camera.updateMatrixWorld();

                // Wait a frame for updates
                await new Promise(r => setTimeout(r, 50));

                // Render manually
                gl.render(scene, camera);

                // Capture initial full quality
                const rawUrl = gl.domElement.toDataURL('image/png');

                // Compress and resize immediately
                screenshots[angle.name] = await compressImage(rawUrl, 600);
            }

            // Restore
            camera.position.copy(originalPos);
            camera.rotation.copy(originalRot);
            camera.updateMatrixWorld();
            gl.render(scene, camera);

            return screenshots;
        }
    }));

    return null;
});

const DesignPhase = ({ productId, glbUrl, meshConfig, meshTextures, globalMaterial, activeStickerUrl, setGlobalMaterial, setActiveStickerUrl, onBack, onUpdateTexture, preview, isCloth = true, designId }) => {
    const navigate = useNavigate();
    // Post-Save Modal State
    const [savedDesignId, setSavedDesignId] = useState(null);

    // Targeted Selectors for Stability
    useEffect(() => {
        // console.log("DesignPhase mounted/updated. productId:", productId, "designId:", designId);
    }, [productId, designId]);

    const materialSettings = useStore(state => state.materialSettings);
    const setMaterialSetting = useStore(state => state.setMaterialSetting);
    const productName = useStore(state => state.productName);
    const meshColors = useStore(state => state.meshColors);
    const setMeshColor = useStore(state => state.setMeshColor);
    const setMeshStickers = useStore(state => state.setMeshStickers);
    const saveDesign = useStore(state => state.saveDesign);
    const saveDesignToBackend = useStore(state => state.saveDesignToBackend);
    const isSaving = useStore(state => state.isSaving);
    const saveSuccess = useStore(state => state.saveSuccess);
    const saveError = useStore(state => state.saveError);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 1024);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Performance Detection
    const [isLowPowerMode, setIsLowPowerMode] = useState(false);

    useEffect(() => {
        const checkPerf = async () => {
            const { isLowEndDevice } = await import("../../utils/detectPerformance");
            const lowEnd = isLowEndDevice();
            setIsLowPowerMode(isMobile && lowEnd);
        };
        checkPerf();
    }, [isMobile]);

    useEffect(() => {
        return () => {
            if (activeStickerUrl?.startsWith('blob:')) {
                URL.revokeObjectURL(activeStickerUrl);
            }
        };
    }, [activeStickerUrl]);

    // Force remove fabric texture if not cloth - SAFE VERSION
    useEffect(() => {
        if (!isCloth) {
            // Set fabric strength to 0 to remove texture
            // Check if already 0 to avoid infinite render loops
            if (materialSettings.fabricStrength !== 0) {
                setMaterialSetting("fabricStrength", 0);
            }
            // Do not set fabricScale as it might be invalid (min 2) and strength 0 is enough
        }
    }, [isCloth, materialSettings.fabricStrength, setMaterialSetting]);

    const { undo, redo, clear } = useStore.temporal.getState();

    const [activeTab, setActiveTab] = useState('design'); // 'design', 'uploads', 'studio'
    const [selectedMesh, setSelectedMesh] = useState(null);

    // Responsive UI State
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [previewOpen, setPreviewOpen] = useState(true);

    // Text Tool State
    const [textInput, setTextInput] = useState("hello");
    const [selectedFont, setSelectedFont] = useState(FONTS[0].family);
    const [textColor, setTextColor] = useState("#000000");
    const [opacity, setOpacity] = useState(1);
    const [activeTextToPlace, setActiveTextToPlace] = useState(null);
    const [editingSelection, setEditingSelection] = useState(null); // { meshName, id, type, text, fontFamily, fill, opacity }

    const orbitRef = useRef();
    const [meshNormals, setMeshNormals] = useState({}); // New state for baked normals
    const [meshList, setMeshList] = useState([]); // Missing state for mesh list

    // AI VIEW_STATE
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [showAiPrompt, setShowAiPrompt] = useState(false);
    const [screenshotUrl, setScreenshotUrl] = useState(null);
    const [editingMesh, setEditingMesh] = useState(null); // Full-screen mesh editing mode for mobile
    const [showMobileTextInput, setShowMobileTextInput] = useState(false); // Mobile text input modal
    const [showMobileColorPicker, setShowMobileColorPicker] = useState(false); // Mobile color picker modal
    const [mobileTextValue, setMobileTextValue] = useState(''); // Text value for mobile input

    const handleOpenAiPrompt = async () => {
        if (captureRef.current) {
            try {
                // Capture all angles
                // setIsSaving(true); 
                const images = await captureRef.current.captureAll();
                setScreenshotUrl(images); // Now storing an object { front, back, etc }
                setShowAiPrompt(true);
            } catch (e) {
                // console.error("Multi-capture failed", e);
                alert("Failed to capture angles.");
            }
        } else {
            // Fallback to single shot if controller fails or not mounted (though it should be)
            const canvasContainer = document.getElementById('three-d-canvas-container');
            const canvas = canvasContainer?.querySelector('canvas');
            if (canvas) {
                const dataUrl = canvas.toDataURL('image/png');
                setScreenshotUrl({ front: dataUrl }); // normalize to object
                setShowAiPrompt(true);
            } else {
                // console.error("3D Canvas not found");
                alert("3D View not found. Please ensure the preview is open.");
            }
        }
    };

    const handleAiSubmit = async (prompt, images) => {
        try {
            // Send to backend (images is now an object)
            // If backend expects one image, maybe send 'front' or all.
            // Let's assume we send the whole object or just primary.
            // For now, let's keep sending 'images' object if backend supports it, 
            // or just 'front' if we need to match previous sig.
            // Let's send the whole object.
            const result = await submitDesignRequest(prompt, images);
            // console.log("AI Result:", result);

            // Handle Response (Mock behavior for now, assuming backend returns { textureUrl: "..." })
            if (result && result.textureUrl) {
                setActiveStickerUrl(result.textureUrl);
                alert(`AI Design Generated! Applied new texture from backend.`);
            } else {
                alert("Request sent! Backend processing... (No texture returned in mock)");
            }

            setShowAiPrompt(false);
        } catch (error) {
            alert("Failed to send request: " + error.message);
        }
    };

    const handleStickerFileChange = useCallback(async (e) => {
        const input = e.target;
        const file = input.files?.[0];
        if (!file) return;

        try {
            const isLargeUpload = file.size >= LARGE_UPLOAD_THRESHOLD_BYTES;
            const maxWidth = isLowPowerMode
                ? (isLargeUpload ? 1536 : 2048)
                : (isLargeUpload ? 3072 : 4096);
            const quality = isLargeUpload ? 0.86 : 0.92;
            const { url } = await createOptimizedImageUrl(file, {
                maxWidth,
                quality,
                outputType: 'image/webp'
            });
            setActiveStickerUrl(url);
        } catch (error) {
            console.error('Failed to prepare sticker upload', error);
            setActiveStickerUrl(URL.createObjectURL(file));
        } finally {
            input.value = null;
        }
    }, [isLowPowerMode, setActiveStickerUrl]);

    // Environment & Background State
    const [envPreset, setEnvPreset] = useState('city');
    const [bgType, setBgType] = useState('solid'); // 'solid' | 'image'
    const [bgColor, setBgColor] = useState('#F1F5F9');
    const [bgImage, setBgImage] = useState(null);
    // showBackground is replaced by bgType logic (solid/image vs transparent handled by removing both?)
    // Actually, user might want "Transparent" which means NO background.
    // Let's keep a "transparent" mode or just "solid" with null?
    // User requested "Light", "Dark", "Custom", "Image". 
    // Transparent is useful for export, let's keep it as a 'transparent' type.

    const [showBgPicker, setShowBgPicker] = useState(false);
    const customBgBtnRef = useRef(null);
    const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 });

    useEffect(() => {
        if (showBgPicker && customBgBtnRef.current) {
            const rect = customBgBtnRef.current.getBoundingClientRect();
            // Position it above the button, aligned to the left
            setPickerPos({
                top: rect.top - 8, // 8px margin
                left: rect.left
            });
        }
    }, [showBgPicker]);

    // Derived: showBackground was boolean. Now we check type.
    const showBackground = bgType !== 'transparent';
    const [brightness, setBrightness] = useState(2.0);
    const [showAuxLights, setShowAuxLights] = useState(true);

    // Refs
    const bgImageFileInputRef = React.useRef(null);

    const handlePatternSelect = (item) => {
        if (!item) {
            setEditingSelection(null);
            return;
        }

        // If selecting a text item, open text drawer and populate
        if (item.type === 'text') {
            setActiveTab('design');
            setTextInput(item.text);
            setSelectedFont(item.fontFamily);
            setTextColor(item.fill);
            setOpacity(item.opacity ?? 1);
            setEditingSelection(item);
            setActiveTextToPlace(null);
        } else if (item.type === 'image') {
            setActiveTab('design');
            setEditingSelection(item);
            setOpacity(item.opacity ?? 1);
        }
    };

    const updateEditingItem = (key, value) => {
        if (!editingSelection) return;

        const changes = { [key]: value };
        if (key === 'color') changes.fill = value;

        const { meshName, id } = editingSelection;
        const currentStickers = meshStickers[meshName] || [];
        const nextStickers = currentStickers.map(s => s.id === id ? { ...s, ...changes } : s);

        setMeshStickers(meshName, nextStickers);
        setEditingSelection(prev => ({ ...prev, ...changes }));
    };

    const updateMeshColor = (meshName, color) => {
        setMeshColor(meshName, color);
    };

    const handleDeleteLayer = () => {
        if (!editingSelection) return;
        const { meshName, id } = editingSelection;
        const currentStickers = meshStickers[meshName] || [];
        setMeshStickers(meshName, currentStickers.filter(s => s.id !== id));
        setEditingSelection(null);
    };

    // Auto-select first mesh
    React.useEffect(() => {
        if (!selectedMesh && meshConfig && Object.keys(meshConfig).length > 0) {
            const firstMesh = Object.keys(meshConfig).find(key => meshConfig[key].maskUrl);
            if (firstMesh) setSelectedMesh(firstMesh);
        }
    }, [meshConfig, selectedMesh]);

    // Keyboard Shortcuts for Undo/Redo
    React.useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                if (e.shiftKey) redo();
                else undo();
                e.preventDefault();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
                redo();
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undo, redo]);

    // Store
    const [isExporting, setIsExporting] = useState(false);
    const modelRef = React.useRef();
    const captureRef = React.useRef(); // Ref for Multi-Angle Capture

    const handleDownload = async () => {
        if (!modelRef.current) return;
        setIsExporting(true);

        try {
            const exporter = new GLTFExporter();
            exporter.parse(
                modelRef.current.scene,
                (gltf) => {
                    const blob = new Blob([gltf], { type: 'model/gltf-binary' });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.style.display = 'none';
                    link.href = url;
                    link.download = `${productName || 'design'}.glb`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    URL.revokeObjectURL(url);
                    setIsExporting(false);
                },
                (error) => {
                    // console.error('An error happened during parsing', error);
                    setIsExporting(false);
                },
                {
                    binary: true,  // Export as GLB
                }
            );

        } catch (error) {
            // console.error("Export failed", error);
            setIsExporting(false);
        }
    };

    const applyNormal = useCallback((meshName, normalUri) => {
        setMeshNormals(prev => {
            if (!normalUri) {
                if (!prev[meshName]) return prev;
                const newState = { ...prev };
                delete newState[meshName];
                return newState;
            }
            if (prev[meshName] === normalUri) return prev;
            return { ...prev, [meshName]: normalUri };
        });
    }, []);



    const handleSave = async () => {
        let result = null;

        // Manual fallback to ensure we get designId if prop is missing but in URL
        const urlParams = new URLSearchParams(window.location.search);
        const effectiveDesignId = designId || urlParams.get('designId') || savedDesignId;

        // console.log("handleSave called. Prop designId:", designId, "Effective designId:", effectiveDesignId);

        if (!modelRef.current) {
            result = await saveDesignToBackend(productId, null, effectiveDesignId);
        } else {
            // Promisify the exporter
            try {
                result = await new Promise((resolve) => {
                    const exporter = new GLTFExporter();
                    exporter.parse(
                        modelRef.current.scene,
                        async (gltf) => {
                            const blob = new Blob([gltf], { type: 'model/gltf-binary' });
                            const res = await saveDesignToBackend(productId, blob, effectiveDesignId);
                            resolve(res);
                        },
                        async (error) => {
                            // console.error('GLB Export failed during save:', error);
                            // Fallback save without GLB
                            const res = await saveDesignToBackend(productId, null, effectiveDesignId);
                            resolve(res);
                        },
                        { binary: true }
                    );
                });
            } catch (e) {
                // console.error("Save error:", e);
                result = await saveDesignToBackend(productId, null, effectiveDesignId);
            }
        }

        // Post-save logic
        if (result && result.success) {
            // Assuming backend returns { success: true, design: { id: ... } } or { success: true, data: { id: ... } }
            const newDesignId = result.design?.id || result.data?.id || (result.data && result.data.design && result.data.design.id);

            if (newDesignId) {
                setSavedDesignId(newDesignId);
                // setShowPostSaveModal(true);
            }
        }
    };

    if (isMobile) return (
        <div className={`flex flex-col w-full h-[100dvh] bg-gradient-to-b from-slate-50 to-slate-100 overflow-hidden ${isFullScreen ? '' : ''}`}>
            {/* Minimal Header */}
            <header className="flex-none flex items-center justify-between px-5 py-3 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 z-50">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-indigo-500/25">
                        <Scan size={16} />
                    </div>
                    <div>
                        <h1 className="text-xs font-bold text-slate-800">{productName || '3D Studio'}</h1>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-full ml-auto">
                    <button onClick={() => undo()} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><RotateCcw size={14} /></button>
                    <button onClick={() => redo()} className="p-1.5 text-slate-400 hover:text-indigo-600 transition-colors"><RotateCw size={14} /></button>

                    <div className="w-px h-4 bg-slate-200 mx-1"></div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-3 py-1 bg-indigo-600 text-white text-[10px] font-bold rounded-full shadow-md shadow-indigo-500/30 disabled:opacity-50 flex items-center gap-1"
                    >
                        {isSaving ? '...' : 'Save'}
                    </button>
                </div>
            </header>

            {/* 3D Preview - Larger, more prominent */}
            <div className={`flex-none transition-all duration-500 ${isFullScreen ? 'fixed inset-0 z-[200]' : 'p-3'}`}>
                <div className={`relative overflow-hidden transition-all duration-500 ${isFullScreen ? 'w-full h-full rounded-none bg-gradient-to-b from-slate-900 via-slate-950 to-black' : 'aspect-[16/10] rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 shadow-xl shadow-slate-300/50 border border-white'}`}>
                    {/* Live Badge - Hidden in fullscreen */}
                    {!isFullScreen && (
                        <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-white/95 backdrop-blur px-2.5 py-1 rounded-full shadow-sm">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[8px] font-bold text-slate-700 uppercase tracking-wider">Live</span>
                        </div>
                    )}

                    {isFullScreen && (
                        <>
                            {/* Fullscreen Header */}
                            <div className="absolute top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-black/60 to-transparent">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                                        <span className="text-xs font-bold text-white/90 uppercase tracking-wider">3D Preview</span>
                                    </div>
                                    <button
                                        onClick={() => setIsFullScreen(false)}
                                        className="px-4 py-2 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full flex items-center gap-2 text-white/90 transition-all active:scale-95 border border-white/10"
                                    >
                                        <X size={14} />
                                        <span className="text-xs font-bold">Close</span>
                                    </button>
                                </div>
                            </div>

                            {/* Fullscreen Bottom Controls */}
                            <div className="absolute bottom-0 left-0 right-0 z-50 p-4 bg-gradient-to-t from-black/60 to-transparent">
                                <div className="flex items-center justify-center gap-3">
                                    <button
                                        onClick={() => { if (orbitRef.current) orbitRef.current.reset(); }}
                                        className="w-12 h-12 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-2xl flex items-center justify-center text-white/90 active:scale-95 transition-all border border-white/10"
                                        title="Reset View"
                                    >
                                        <RotateCw size={20} />
                                    </button>
                                    <button
                                        onClick={handleOpenAiPrompt}
                                        className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/30 flex items-center gap-2 text-white active:scale-95 transition-all"
                                    >
                                        <Wand2 size={18} />
                                        <span className="text-sm font-bold">AI Generate</span>
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    <div className="w-full h-full">
                        <Canvas
                            shadows={!isLowPowerMode} // Keep shadows for high-end mobile
                            camera={{ position: [0, 0, 3.5], fov: 40 }}
                            gl={{
                                preserveDrawingBuffer: true,
                                antialias: !isLowPowerMode, // Keep AA for high-end mobile
                                toneMapping: THREE.ACESFilmicToneMapping,
                                toneMappingExposure: brightness,
                                powerPreference: "high-performance"
                            }}
                            dpr={[1, isLowPowerMode ? 1.5 : 2]} // Only clamp DPR on low-end
                        >
                            <Environment preset={envPreset} background={false} />
                            <BackgroundHandler type={bgType} color={bgColor} imageUrl={bgImage} />
                            <ambientLight intensity={0.5} />
                            <spotLight
                                position={[10, 15, 10]}
                                angle={0.5}
                                penumbra={1}
                                intensity={1}
                                castShadow={!isLowPowerMode}
                            />
                            <React.Suspense fallback={null}>
                                <Center position={[0, -0.2, 0]}>
                                    <DynamicModel
                                        ref={modelRef}
                                        url={glbUrl}
                                        meshTextures={meshTextures}
                                        meshNormals={meshNormals}
                                        meshColors={meshColors}
                                        materialProps={{ color: globalMaterial?.color }}
                                        setMeshList={setMeshList}
                                        isMobile={isLowPowerMode} // Pass low power status as the throttle flag
                                    />
                                </Center>
                                <ContactShadows
                                    position={[0, -1.4, 0]}
                                    opacity={0.4}
                                    scale={20}
                                    blur={2.5}
                                    color="#000000"
                                    frames={isLowPowerMode ? 1 : Infinity}
                                    resolution={isLowPowerMode ? 256 : 512}
                                />
                            </React.Suspense>
                            <OrbitControls ref={orbitRef} makeDefault enablePan={false} enableDamping dampingFactor={0.05} minDistance={1.5} maxDistance={10} />
                        </Canvas>
                    </div>

                    {/* Floating Controls - Only in normal view */}
                    {/* Floating Controls - Only in normal view */}
                    {!isFullScreen && (
                        <div className="absolute bottom-3 right-3 flex gap-2">
                            <button
                                onClick={() => { if (orbitRef.current) orbitRef.current.reset(); }}
                                className="w-9 h-9 bg-white/95 backdrop-blur rounded-xl shadow-lg flex items-center justify-center text-slate-600 active:scale-95 transition-all"
                            >
                                <RotateCw size={16} />
                            </button>
                            <button
                                onClick={handleOpenAiPrompt}
                                className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white active:scale-95 transition-all"
                            >
                                <Wand2 size={16} />
                            </button>
                            <button
                                onClick={() => setIsFullScreen(true)}
                                className="w-9 h-9 bg-white/95 backdrop-blur rounded-xl shadow-lg flex items-center justify-center text-slate-600 active:scale-95 transition-all"
                            >
                                <Maximize size={16} />
                            </button>
                        </div>
                    )}
                </div>
            </div>


            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto">
                {/* Tab Pills */}
                <div className="px-4 py-3 sticky top-0 bg-gradient-to-b from-slate-50 to-transparent z-10">
                    <div className="flex gap-2 justify-center">
                        {['design', 'studio', 'uploads'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-5 py-2 rounded-full text-[11px] font-bold transition-all ${activeTab === tab
                                    ? 'bg-slate-800 text-white shadow-lg shadow-slate-800/25'
                                    : 'bg-white text-slate-400 border border-slate-200 hover:border-slate-300'}`}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content - Mesh Selector */}
                <div className="px-4 pb-28">
                    {activeTab === 'design' && (() => {
                        const activeMeshes = Object.entries(meshConfig).filter(([_, cfg]) => cfg.maskUrl);
                        const currentIndex = activeMeshes.findIndex(([name]) => name === selectedMesh);
                        const effectiveIndex = currentIndex >= 0 ? currentIndex : 0;

                        const goToPrev = () => {
                            const prevIndex = effectiveIndex > 0 ? effectiveIndex - 1 : activeMeshes.length - 1;
                            setSelectedMesh(activeMeshes[prevIndex][0]);
                        };

                        const goToNext = () => {
                            const nextIndex = effectiveIndex < activeMeshes.length - 1 ? effectiveIndex + 1 : 0;
                            setSelectedMesh(activeMeshes[nextIndex][0]);
                        };

                        return (
                            <div className="space-y-4">
                                {/* Section Header */}
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-wider">Select Part</h3>
                                    <span className="text-[10px] text-slate-400">{activeMeshes.length} parts</span>
                                </div>

                                {/* 2-Column Grid Layout */}
                                <div className="grid grid-cols-2 gap-3">
                                    {activeMeshes.map(([meshName, cfg]) => {
                                        const isSelected = meshName === selectedMesh;
                                        return (
                                            <div
                                                key={meshName}
                                                className="transition-all duration-300"
                                            >
                                                <div
                                                    onClick={() => setSelectedMesh(meshName)}
                                                    className={`relative rounded-xl overflow-hidden shadow-md cursor-pointer bg-gray-800 flex items-center justify-center ${isSelected ? 'ring-2 ring-indigo-500 ring-offset-2' : ''}`}
                                                >
                                                    {isCloth ? (
                                                        <PatternZone
                                                            maxSize={120}
                                                            meshName={meshName}
                                                            maskUrl={cfg.maskUrl}
                                                            stickerUrl={null}
                                                            textToPlace={null}
                                                            onUpdateTexture={onUpdateTexture}
                                                            onUpdateNormal={applyNormal}
                                                            onUpdateColor={(c) => updateMeshColor(meshName, c)}
                                                            onSelect={handlePatternSelect}
                                                            fabricType={materialSettings.fabricType}
                                                            fabricScale={materialSettings.fabricScale}
                                                            bgColor={meshColors[meshName] || globalMaterial.color || "#ffffff"}
                                                            isSelected={isSelected}
                                                            onClick={() => setSelectedMesh(meshName)}
                                                            onPlaceSticker={() => { }}
                                                            onPlaceText={() => { }}
                                                            preview={true}
                                                            activeSelection={editingSelection}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="w-full h-full flex items-center justify-center"
                                                            style={{ backgroundColor: meshColors[meshName] || globalMaterial.color || "#ffffff" }}
                                                        >
                                                            {/* Simple Color Preview if PatternZone is hidden */}
                                                        </div>
                                                    )}
                                                </div>
                                                <p className={`text-center text-[10px] font-bold uppercase tracking-wide mt-2 ${isSelected ? 'text-indigo-600' : 'text-slate-500'}`}>
                                                    {meshName}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Quick Actions - Trigger Edit Mode */}
                                {isCloth && (
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-3">
                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Edit Selected Part</h4>
                                        <button
                                            onClick={() => setEditingMesh(selectedMesh || Object.keys(meshConfig).find(k => meshConfig[k].maskUrl))}
                                            className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/30 active:scale-[0.98] transition-all"
                                        >
                                            <Wand2 size={18} /> Open Editor
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })()}

                    {/* FULL-SCREEN MESH EDITING MODAL - Split View with 3D Preview */}
                    {editingMesh && meshConfig[editingMesh] && (
                        <div className="fixed inset-0 z-[300] bg-slate-900 flex flex-col animate-in fade-in duration-200">
                            {/* Compact Header */}
                            <div className="flex-none flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-white/5">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Editing:</span>
                                    <span className="text-xs font-bold text-white">{editingMesh}</span>
                                </div>
                                <button
                                    onClick={() => setEditingMesh(null)}
                                    className="px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full shadow-md"
                                >
                                    Done
                                </button>
                            </div>

                            {/* Split View: 3D Preview (Top) + 2D Editor (Bottom) */}
                            <div className="flex-1 flex flex-col overflow-hidden">
                                {/* 3D Preview - Compact, shows live changes */}
                                <div className="flex-none h-[35vh] bg-gradient-to-b from-slate-800 to-slate-900 relative">
                                    <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 bg-black/40 backdrop-blur px-2 py-1 rounded-full">
                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                        <span className="text-[8px] font-bold text-white/80 uppercase tracking-wider">Live Preview</span>
                                    </div>
                                    <Canvas
                                        shadows
                                        camera={{ position: [0, 0, 3], fov: 45 }}
                                        gl={{
                                            preserveDrawingBuffer: true,
                                            antialias: true,
                                            toneMapping: THREE.ACESFilmicToneMapping,
                                            toneMappingExposure: brightness,
                                            powerPreference: "high-performance"
                                        }}
                                        dpr={[1, 1.5]}
                                    >
                                        <Environment preset={envPreset} background={false} />
                                        <BackgroundHandler type={bgType} color={bgColor} imageUrl={bgImage} />
                                        <ambientLight intensity={0.6} />
                                        <spotLight position={[10, 15, 10]} angle={0.5} penumbra={1} intensity={1} castShadow />
                                        <React.Suspense fallback={null}>
                                            <Center position={[0, -0.15, 0]}>
                                                <DynamicModel
                                                    ref={modelRef}
                                                    url={glbUrl}
                                                    meshTextures={meshTextures}
                                                    meshNormals={meshNormals}
                                                    meshColors={meshColors}
                                                    materialProps={{ color: globalMaterial?.color }}
                                                    setMeshList={setMeshList}
                                                />
                                            </Center>
                                            <ContactShadows position={[0, -1.2, 0]} opacity={0.3} scale={15} blur={2} color="#000000" />
                                        </React.Suspense>
                                        <OrbitControls enablePan={false} enableDamping dampingFactor={0.05} minDistance={1.5} maxDistance={8} />
                                    </Canvas>
                                </div>

                                {/* 2D Editor Canvas - The main editing area */}
                                <div className="flex-1 bg-slate-950 flex items-center justify-center p-3 overflow-auto">
                                    <div className="bg-slate-800/50 rounded-2xl p-1.5 border border-white/5">
                                        <PatternZone
                                            maxSize={Math.min(window.innerWidth - 32, window.innerHeight * 0.35)}
                                            meshName={editingMesh}
                                            maskUrl={meshConfig[editingMesh].maskUrl}
                                            stickerUrl={activeStickerUrl}
                                            textToPlace={activeTextToPlace}
                                            onUpdateTexture={onUpdateTexture}
                                            onUpdateNormal={applyNormal}
                                            onUpdateColor={(c) => updateMeshColor(editingMesh, c)}
                                            onSelect={handlePatternSelect}
                                            fabricType={materialSettings.fabricType}
                                            fabricScale={materialSettings.fabricScale}
                                            bgColor={meshColors[editingMesh] || globalMaterial.color || "#ffffff"}
                                            isSelected={true}
                                            onClick={() => { }}
                                            onPlaceSticker={() => setActiveStickerUrl(null)}
                                            onPlaceText={() => setActiveTextToPlace(null)}
                                            preview={showMobileTextInput || showMobileColorPicker}
                                            activeSelection={editingSelection}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Bottom Toolbar - Mesh Switcher + Actions */}
                            <div className="flex-none bg-slate-800 border-t border-white/5 p-3 space-y-3">
                                {/* Mesh Switcher (Horizontal Scroll) */}
                                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                                    {Object.entries(meshConfig).filter(([_, cfg]) => cfg.maskUrl).map(([meshName, cfg]) => {
                                        const isActive = editingMesh === meshName;
                                        return (
                                            <button
                                                key={meshName}
                                                onClick={() => setEditingMesh(meshName)}
                                                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] font-bold transition-all ${isActive
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}
                                            >
                                                {meshName}
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Action Buttons */}
                                {isCloth && (
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setShowMobileColorPicker(true)}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/15 rounded-xl text-white text-xs font-bold transition-all active:scale-[0.98]"
                                        >
                                            <Palette size={16} /> Color
                                        </button>
                                        <button
                                            onClick={() => { setMobileTextValue(''); setShowMobileTextInput(true); }}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/15 rounded-xl text-white text-xs font-bold transition-all active:scale-[0.98]"
                                        >
                                            <Type size={16} /> Text
                                        </button>
                                        <label className="flex-1 flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/15 rounded-xl text-white text-xs font-bold transition-all active:scale-[0.98] cursor-pointer">
                                            <Upload size={16} /> Image
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleStickerFileChange}
                                                className="hidden"
                                            />
                                        </label>
                                        <button
                                            onClick={handleOpenAiPrompt}
                                            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl text-white text-xs font-bold shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.98]"
                                        >
                                            <Wand2 size={16} /> AI
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Mobile Text Input Modal */}
                            {showMobileTextInput && (
                                <div className="absolute inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                                    <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
                                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                            <Type size={18} className="text-indigo-400" />
                                            Add Text
                                        </h3>
                                        <input
                                            type="text"
                                            value={mobileTextValue}
                                            onChange={(e) => setMobileTextValue(e.target.value)}
                                            placeholder="Enter your text..."
                                            autoFocus
                                            className="w-full px-4 py-3 bg-slate-900 border border-white/10 rounded-xl text-white text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && mobileTextValue.trim()) {
                                                    setActiveTextToPlace({ text: mobileTextValue.trim(), fontFamily: selectedFont, color: textColor, opacity });
                                                    setShowMobileTextInput(false);
                                                }
                                            }}
                                        />
                                        <div className="flex gap-3 mt-4">
                                            <button
                                                onClick={() => setShowMobileTextInput(false)}
                                                className="flex-1 py-3 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl text-xs font-bold transition-all"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                onClick={() => {
                                                    if (mobileTextValue.trim()) {
                                                        setActiveTextToPlace({ text: mobileTextValue.trim(), fontFamily: selectedFont, color: textColor, opacity });
                                                        setShowMobileTextInput(false);
                                                    }
                                                }}
                                                disabled={!mobileTextValue.trim()}
                                                className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-xl text-xs font-bold transition-all"
                                            >
                                                Add Text
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Mobile Base Color Picker Modal */}
                            {showMobileColorPicker && (
                                <div className="absolute inset-0 z-[400] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                                    <div className="bg-slate-800 rounded-2xl p-5 w-full max-w-sm shadow-2xl border border-white/10 animate-in zoom-in-95 duration-200">
                                        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                            <Palette size={18} className="text-pink-500" />
                                            Base Color
                                        </h3>

                                        <div className="space-y-4">
                                            <div className="flex gap-2 flex-wrap justify-center">
                                                {PRESET_COLORS.map(color => (
                                                    <button
                                                        key={color}
                                                        onClick={() => setGlobalMaterial({ ...globalMaterial, color })}
                                                        className={`w-8 h-8 rounded-full border-2 transition-transform active:scale-95 ${globalMaterial?.color === color ? 'border-white ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900' : 'border-transparent'}`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>

                                            <div className="pt-4 border-t border-white/10 flex flex-col gap-2">
                                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Custom Color</span>
                                                <div className="flex gap-3">
                                                    <input
                                                        type="color"
                                                        value={globalMaterial?.color || '#ffffff'}
                                                        onChange={(e) => setGlobalMaterial({ ...globalMaterial, color: e.target.value })}
                                                        className="w-full h-10 rounded-lg cursor-pointer bg-slate-700 border border-white/10 p-1"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-end gap-2 mt-6">
                                            <button
                                                onClick={() => setShowMobileColorPicker(false)}
                                                className="w-full py-3 bg-indigo-600 rounded-xl text-white text-xs font-bold shadow-lg shadow-indigo-500/20"
                                            >
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'studio' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Environment */}
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 space-y-6">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Environment</h3>
                                    <button
                                        onClick={() => setShowAuxLights(!showAuxLights)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all ${showAuxLights ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-400'}`}
                                    >
                                        <Lightbulb size={12} />
                                        {showAuxLights ? 'Aux ON' : 'Aux OFF'}
                                    </button>
                                </div>

                                {/* Brightness slider */}
                                <div className="space-y-3">
                                    <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                                        <span>Intensity</span>
                                        <span>{brightness.toFixed(1)}x</span>
                                    </div>
                                    <input
                                        type="range"
                                        min="0.2"
                                        max="3"
                                        step="0.1"
                                        value={brightness}
                                        onChange={(e) => setBrightness(Number(e.target.value))}
                                        className="w-full h-1.5 bg-zinc-100 rounded-lg appearance-none accent-indigo-600"
                                    />
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <PresetBtn label="Studio" icon={Sun} active={envPreset === 'studio'} onClick={() => setEnvPreset('studio')} />
                                    <PresetBtn label="City" icon={Building2} active={envPreset === 'city'} onClick={() => setEnvPreset('city')} />
                                    <PresetBtn label="Dawn" icon={Cloud} active={envPreset === 'dawn'} onClick={() => setEnvPreset('dawn')} />
                                    <PresetBtn label="Forest" icon={Trees} active={envPreset === 'forest'} onClick={() => setEnvPreset('forest')} />
                                    <PresetBtn label="Night" icon={Moon} active={envPreset === 'warehouse'} onClick={() => setEnvPreset('warehouse')} />
                                    <PresetBtn label="Sunset" icon={Sunset} active={envPreset === 'sunset'} onClick={() => setEnvPreset('sunset')} />
                                </div>
                            </div>

                            {/* Background */}
                            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-zinc-100 space-y-4">
                                <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Background</h3>
                                <div className="grid grid-cols-4 gap-2">
                                    <button onClick={() => { setBgType('solid'); setBgColor('#FFFFFF'); }} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${bgType === 'solid' && bgColor === '#FFFFFF' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-zinc-100'}`}>
                                        <div className="w-5 h-5 rounded-full bg-white border border-zinc-200" />
                                        <span className="text-[8px] font-bold uppercase">Light</span>
                                    </button>
                                    <button onClick={() => { setBgType('solid'); setBgColor('#262626'); }} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${bgType === 'solid' && bgColor === '#262626' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-zinc-100'}`}>
                                        <div className="w-5 h-5 rounded-full bg-[#262626] border border-zinc-200" />
                                        <span className="text-[8px] font-bold uppercase">Dark</span>
                                    </button>
                                    <button onClick={() => { setBgType('transparent'); }} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${bgType === 'transparent' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-zinc-100'}`}>
                                        <Scan size={16} className="text-zinc-400" />
                                        <span className="text-[8px] font-bold uppercase">Trans</span>
                                    </button>
                                    <button onClick={() => bgImageFileInputRef.current?.click()} className={`p-2 rounded-xl border flex flex-col items-center gap-1 transition-all ${bgType === 'image' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-zinc-100'}`}>
                                        <ImageIcon size={16} className="text-zinc-400" />
                                        <span className="text-[8px] font-bold uppercase">Image</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'uploads' && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block mb-2">Uploads</label>
                            <label className="flex flex-col items-center justify-center h-48 border-2 border-dashed border-zinc-200 rounded-[2.5rem] bg-zinc-50/50 hover:bg-white transition-all cursor-pointer group shadow-inner">
                                <Upload size={32} className="text-zinc-300 group-hover:text-indigo-500 mb-4 transition-colors" />
                                <span className="text-xs font-bold text-zinc-500 group-hover:text-indigo-600 uppercase tracking-widest">Upload Image</span>
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleStickerFileChange}
                                />
                            </label>

                            {activeStickerUrl && (
                                <div className="bg-white border border-zinc-100 rounded-[2rem] p-4 shadow-xl shadow-indigo-100/50 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-zinc-50 border border-zinc-100 overflow-hidden shrink-0">
                                            <img src={activeStickerUrl} alt="Active" className="w-full h-full object-contain" />
                                        </div>
                                        <div>
                                            <p className="text-xs font-bold text-zinc-900">Active Sticker</p>
                                            <p className="text-[10px] text-zinc-400">Ready to place in Design tab</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setActiveStickerUrl(null)}
                                        className="text-red-500 bg-red-50 w-10 h-10 rounded-full flex items-center justify-center hover:bg-red-100 transition-colors"
                                    >
                                        <Trash size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div className="flex w-full h-full relative bg-[#f8f9fc] overflow-hidden">
            {!preview && (
                <>
                    <button
                        onClick={() => setSidebarOpen(!sidebarOpen)}
                        className="lg:hidden fixed top-4 left-4 z-50 bg-white p-3 rounded-xl shadow-lg border border-zinc-200"
                    >
                        <Menu size={20} className="text-zinc-700" />
                    </button>

                    {/* Mobile 3D Preview Toggle */}
                    <button
                        onClick={() => setPreviewOpen(!previewOpen)}
                        className="lg:hidden fixed top-4 right-4 z-50 bg-white p-3 rounded-xl shadow-lg border border-zinc-200"
                    >
                        {previewOpen ? <EyeOff size={20} className="text-zinc-700" /> : <Eye size={20} className="text-zinc-700" />}
                    </button>
                </>
            )}

            {/* MAIN SIDEBAR PANEL (Replaces Strip + Drawer) */}
            {!preview && (
                <div className={`
                    w-full sm:w-[300px] 
                    bg-[#f8f9fc] border-r border-zinc-200 
                    flex flex-col z-40 h-full shadow-xl
                    transition-transform duration-300
                    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                `}>
                    {/* TABS HEADER */}
                    <div className="flex items-center p-2 gap-1 bg-white border-b border-zinc-100 mx-4 mt-4 rounded-xl shadow-sm">
                        {['design', 'studio', 'uploads'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${activeTab === tab ? 'bg-white text-indigo-600 shadow-md ring-1 ring-zinc-100' : 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-50'}`}
                            >
                                {tab === 'design' && <Layers size={14} />}
                                {tab === 'studio' && <Settings size={14} />}
                                {tab === 'uploads' && <ImageIcon size={14} />}
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>

                    {/* SCROLLABLE CONTENT */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">

                        {/* --- DESIGN TAB --- */}
                        {activeTab === 'design' && (
                            <>
                                {/* TEXT LAYER SECTION */}
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Text Layer</h3>
                                    </div>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <input
                                                type="text"
                                                value={textInput}
                                                onChange={(e) => {
                                                    setTextInput(e.target.value);
                                                    if (editingSelection) updateEditingItem('text', e.target.value);
                                                    if (activeTextToPlace) setActiveTextToPlace(prev => ({ ...prev, text: e.target.value }));
                                                }}
                                                className="w-full bg-zinc-50 border border-zinc-200 text-zinc-800 text-sm font-medium rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:bg-white transition-all"
                                                placeholder="Add text..."
                                            />
                                            <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center bg-green-100 text-green-600 rounded-lg">
                                                <Check size={16} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <button
                                            onClick={() => {
                                                // Ensure placement mode if not editing
                                                if (!editingSelection) {
                                                    setActiveTextToPlace({ text: textInput, fontFamily: selectedFont, color: textColor, opacity });
                                                } else {
                                                    // If editing, start fresh but maybe keep the text or cleared?
                                                    // User wants what they typed to be added as NEW text if they click Add.
                                                    setEditingSelection(null);
                                                    setActiveTextToPlace({ text: textInput, fontFamily: selectedFont, color: textColor, opacity });
                                                    // We do NOT reset textInput to "New Text" here, so it keeps what they typed.
                                                }
                                            }}
                                            className="col-span-2 bg-[#3B82F6] hover:bg-blue-600 text-white py-3 rounded-xl text-sm font-semibold shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-95"
                                        >
                                            <Plus size={16} /> Add Text
                                        </button>
                                    </div>
                                </div>

                                {/* MATERIAL / FABRIC SECTION */}
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
                                    <div className="flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-purple-500"></span>
                                        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Material</h3>
                                    </div>

                                    <div className="space-y-4">
                                        {/* Basic Material Props */}
                                        <div className="grid grid-cols-2 gap-4 pt-2">
                                            <div className="space-y-2">
                                                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Roughness</span>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.05"
                                                    value={materialSettings.roughness}
                                                    onChange={(e) => setMaterialSetting("roughness", Number(e.target.value))}
                                                    className="w-full h-1 bg-zinc-200 rounded-lg appearance-none accent-purple-500"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Sheen</span>
                                                <input
                                                    type="range"
                                                    min="0"
                                                    max="1"
                                                    step="0.05"
                                                    value={materialSettings.sheen}
                                                    onChange={(e) => setMaterialSetting("sheen", Number(e.target.value))}
                                                    className="w-full h-1 bg-zinc-200 rounded-lg appearance-none accent-purple-500"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* REMOVE LAYER */}
                                {editingSelection && (
                                    <button
                                        onClick={handleDeleteLayer}
                                        className="w-full py-3.5 border border-red-100 text-red-500 hover:bg-red-50 font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all mt-4"
                                    >
                                        <Trash size={16} /> Remove Layer
                                    </button>
                                )}
                            </>
                        )}

                        {/* --- UPLOADS TAB --- */}
                        {activeTab === 'uploads' && (
                            <div className="space-y-4">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest block">Uploads</label>
                                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-zinc-200 rounded-2xl hover:border-blue-400 hover:bg-blue-50/50 transition-all cursor-pointer group bg-zinc-50/50">
                                    <Upload size={24} className="text-zinc-300 group-hover:text-blue-500 mb-2 transition-colors" />
                                    <span className="text-xs font-bold text-zinc-500 group-hover:text-blue-600">Upload Image</span>
                                    <input type="file" accept="image/*" onChange={handleStickerFileChange} className="hidden" />
                                </label>

                                {activeStickerUrl && (
                                    <div className="bg-white border border-zinc-200 rounded-xl p-3 shadow-sm flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-zinc-100 border border-zinc-200 overflow-hidden shrink-0">
                                                <img src={activeStickerUrl} alt="Active" className="w-full h-full object-contain" />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-zinc-700">Active Sticker</p>
                                                <p className="text-[10px] text-zinc-400">Ready to place</p>
                                            </div>
                                        </div>
                                        <button onClick={() => setActiveStickerUrl(null)} className="text-red-500 bg-red-50 p-2 rounded-lg"><Trash size={14} /></button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* --- STUDIO TAB (Lighting & Background) --- */}
                        {activeTab === 'studio' && (
                            <div className="space-y-6">
                                {/* Environment */}
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Environment & Lighting</h3>
                                        <button
                                            onClick={() => setShowAuxLights(!showAuxLights)}
                                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${showAuxLights ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-400'}`}
                                        >
                                            <Lightbulb size={12} />
                                            {showAuxLights ? 'Aux Lights ON' : 'Aux Lights OFF'}
                                        </button>
                                    </div>

                                    {/* Brightness Slider */}
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs text-zinc-500 font-medium">
                                            <span>Scene Brightness</span>
                                            <span>{brightness.toFixed(1)}</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0.2"
                                            max="3"
                                            step="0.1"
                                            value={brightness}
                                            onChange={(e) => setBrightness(Number(e.target.value))}
                                            className="w-full h-1.5 bg-zinc-200 rounded-lg appearance-none accent-indigo-600"
                                        />
                                    </div>

                                    {/* Base Color Picker */}
                                    <div className="bg-white rounded-2xl p-4 shadow-sm border border-zinc-100 space-y-3">
                                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Base Color</h4>
                                        <div className="space-y-3">
                                            <div className="flex gap-2 flex-wrap">
                                                {PRESET_COLORS.map(color => (
                                                    <button
                                                        key={color}
                                                        onClick={() => setGlobalMaterial({ ...globalMaterial, color })}
                                                        className={`w-6 h-6 rounded-full border border-slate-200 shadow-sm transition-transform hover:scale-110 ${globalMaterial?.color === color ? 'ring-2 ring-indigo-500 ring-offset-1' : ''}`}
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                            <div className="flex items-center gap-3 pt-2 border-t border-slate-50">
                                                <div className="w-8 h-8 rounded-full border border-slate-200 shadow-inner flex items-center justify-center overflow-hidden">
                                                    <input
                                                        type="color"
                                                        value={globalMaterial?.color || '#ffffff'}
                                                        onChange={(e) => setGlobalMaterial({ ...globalMaterial, color: e.target.value })}
                                                        className="w-[150%] h-[150%] -m-[25%] cursor-pointer p-0 border-0"
                                                    />
                                                </div>
                                                <div className="flex-1">
                                                    <span className="text-xs font-bold text-slate-700 block">Custom Color</span>
                                                    <span className="text-[10px] text-slate-400 font-mono uppercase">{globalMaterial?.color}</span>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-slate-400 italic">
                                                Applies to all white/default parts only.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                        <PresetBtn
                                            label="Studio"
                                            icon={Sun}
                                            active={envPreset === 'studio'}
                                            onClick={() => setEnvPreset('studio')}
                                        />
                                        <PresetBtn
                                            label="City"
                                            icon={Building2}
                                            active={envPreset === 'city'}
                                            onClick={() => setEnvPreset('city')}
                                        />
                                        <PresetBtn
                                            label="Dawn"
                                            icon={Cloud}
                                            active={envPreset === 'dawn'}
                                            onClick={() => setEnvPreset('dawn')}
                                        />
                                        <PresetBtn
                                            label="Forest"
                                            icon={Trees}
                                            active={envPreset === 'forest'}
                                            onClick={() => setEnvPreset('forest')}
                                        />
                                        <PresetBtn
                                            label="Night"
                                            icon={Moon}
                                            active={envPreset === 'warehouse'}
                                            onClick={() => setEnvPreset('warehouse')}
                                        />
                                        <PresetBtn
                                            label="Sunset"
                                            icon={Sunset}
                                            active={envPreset === 'sunset'}
                                            onClick={() => setEnvPreset('sunset')}
                                        />
                                    </div>
                                </div>

                                {/* Background */}
                                <div className="bg-white p-4 rounded-2xl shadow-sm border border-zinc-100 space-y-4">
                                    <h3 className="text-xs font-bold text-zinc-900 uppercase tracking-widest">Background</h3>
                                    <div className="grid grid-cols-4 gap-2">
                                        {/* Light Preset */}
                                        <button
                                            onClick={() => { setBgType('solid'); setBgColor('#FFFFFF'); }}
                                            className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all ${bgType === 'solid' && bgColor === '#FFFFFF' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
                                        >
                                            <div className="w-4 h-4 rounded-full border border-zinc-200 bg-white" />
                                            <span className="text-[9px] font-bold uppercase">Light</span>
                                        </button>

                                        {/* Dark Preset (Ash) */}
                                        <button
                                            onClick={() => { setBgType('solid'); setBgColor('#262626'); }}
                                            className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all ${bgType === 'solid' && bgColor === '#262626' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
                                        >
                                            <div className="w-4 h-4 rounded-full border border-zinc-200 bg-[#262626]" />
                                            <span className="text-[9px] font-bold uppercase">Dark</span>
                                        </button>

                                        {/* Custom Color Popover */}
                                        <div className="relative">
                                            <button
                                                ref={customBgBtnRef}
                                                onClick={() => { setBgType('solid'); setShowBgPicker(!showBgPicker); }}
                                                className={`relative flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all cursor-pointer ${bgType === 'solid' && bgColor !== '#FFFFFF' && bgColor !== '#262626' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
                                            >
                                                <div className="w-4 h-4 rounded-full border border-zinc-200" style={{ backgroundColor: bgColor }} />
                                                <span className="text-[9px] font-bold uppercase">Custom</span>
                                            </button>
                                            {showBgPicker && createPortal(
                                                <div
                                                    className="fixed z-[100] -translate-y-full mb-2"
                                                    style={{
                                                        top: pickerPos.top,
                                                        left: pickerPos.left
                                                    }}
                                                >
                                                    <div className="relative">
                                                        <AttractiveColorPicker
                                                            color={bgColor}
                                                            onChange={(color) => { setBgColor(color); setBgType('solid'); }}
                                                            className="w-56"
                                                        />
                                                        {/* Backdrop to close when clicking outside */}
                                                        <div
                                                            className="fixed inset-0 -z-10"
                                                            onClick={() => setShowBgPicker(false)}
                                                        />
                                                    </div>
                                                </div>,
                                                document.body
                                            )}
                                        </div>

                                        {/* Image Upload / Toggle */}
                                        <div
                                            onClick={() => {
                                                if (bgImage) {
                                                    setBgType('image');
                                                } else {
                                                    bgImageFileInputRef.current?.click();
                                                }
                                            }}
                                            className={`relative flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all cursor-pointer group ${bgType === 'image' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
                                        >
                                            {bgImage ? (
                                                <>
                                                    {/* Preview Thumbnail */}
                                                    <div className="w-4 h-4 rounded-md overflow-hidden border border-zinc-200">
                                                        <img src={bgImage} alt="bg" className="w-full h-full object-cover" />
                                                    </div>
                                                    <span className="text-[9px] font-bold uppercase">Image</span>

                                                    {/* Replace Button (Small Overlay) */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevent toggling logic
                                                            bgImageFileInputRef.current?.click();
                                                        }}
                                                        className="absolute -top-1 -right-1 w-4 h-4 bg-zinc-600 text-white rounded-full flex items-center justify-center shadow-sm hover:bg-zinc-800 transition-colors z-10"
                                                        title="Replace Image"
                                                    >
                                                        <ImageIcon size={8} />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <ImageIcon size={16} />
                                                    <span className="text-[9px] font-bold uppercase">Image</span>
                                                </>
                                            )}

                                            <input
                                                ref={bgImageFileInputRef}
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => {
                                                    if (e.target.files[0]) {
                                                        setBgImage(URL.createObjectURL(e.target.files[0]));
                                                        setBgType('image');
                                                    }
                                                    // Reset value to allow re-uploading same file
                                                    e.target.value = null;
                                                }}
                                                className="hidden"
                                            />
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => { setBgType('transparent'); }}
                                        className={`w-full flex items-center justify-center gap-2 px-3 py-3 rounded-xl border transition-all ${bgType === 'transparent' ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-600 hover:border-zinc-300'}`}
                                    >
                                        <Scan size={14} />
                                        <span className="text-xs font-bold">Transparent BG</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ... CENTER WORKSPACE ... */}
            <div className={`flex-1 bg-[#f8f9fc] relative overflow-hidden ml-0 lg:ml-0 ${preview ? 'opacity-0 pointer-events-none absolute inset-0 -z-10' : ''}`}>
                {!preview && (
                    <div className="absolute top-8 left-8 z-10 flex items-center gap-4">
                        <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-white/50 inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <h1 className="font-bold text-zinc-800 text-xs">
                                <span className="hidden sm:inline">Editor Live <span className="text-zinc-300 mx-2">|</span> </span>
                                <span className="text-indigo-600">{productName || 'Untitled Project'}</span>
                            </h1>
                        </div>

                        {/* Undo/Redo Controls */}
                        <div className="flex bg-white/90 backdrop-blur-md p-1 rounded-full shadow-sm border border-white/50 pointer-events-auto">
                            <button
                                onClick={() => undo()}
                                className="p-1.5 hover:bg-zinc-100 rounded-full text-zinc-600 transition-colors"
                                title="Undo (Ctrl+Z)"
                            >
                                <RotateCcw size={16} />
                            </button>
                            <button
                                onClick={() => redo()}
                                className="p-1.5 hover:bg-zinc-100 rounded-full text-zinc-600 transition-colors"
                                title="Redo (Ctrl+Y)"
                            >
                                <RotateCw size={16} />
                            </button>
                            <div className="w-[1px] h-4 bg-zinc-200 mx-1" />
                            <button
                                onClick={handleSave}
                                disabled={isSaving}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full transition-all ${isSaving ? 'opacity-50 cursor-not-allowed bg-zinc-100' : 'hover:bg-indigo-50 hover:text-indigo-600 text-zinc-600'}`}
                                title={isSaving ? "Saving..." : "Save to Cloud"}
                            >
                                {isSaving ? (
                                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <Save size={16} className={saveSuccess ? "text-green-500" : ""} />
                                )}
                                <span className="text-xs font-semibold">{isSaving ? "Saving..." : "Saves"}</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Save Feedback Toast */}
                {!preview && (saveError || saveSuccess) && (
                    <div className={`absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full shadow-lg border text-xs font-bold transition-all ${saveError ? 'bg-red-50 border-red-200 text-red-600' : 'bg-green-50 border-green-200 text-green-600'}`}>
                        {saveError ? `Error: ${saveError}` : 'Design saved to cloud!'}
                        <button onClick={() => useStore.setState({ saveError: null, saveSuccess: false })} className="ml-2 hover:opacity-70">
                            <X size={12} />
                        </button>
                    </div>
                )}

                {/* Canvas Area - Grid Layout for Pattern Zones */}
                <div className="w-full h-full overflow-auto bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] bg-[length:32px_32px] p-4 sm:p-8 lg:p-12 lg:pr-[410px]">
                    <div className="min-h-full grid grid-cols-2 gap-4 lg:gap-6 content-start justify-items-center pb-20 pt-10 max-w-3xl mx-auto">
                        {Object.entries(meshConfig).filter(([_, cfg]) => cfg.maskUrl).map(([meshName, cfg]) => {
                            const isSelected = selectedMesh === meshName || (!selectedMesh && meshName === Object.keys(meshConfig)[0]);
                            return (
                                <PatternZone
                                    key={meshName}
                                    meshName={meshName}
                                    maskUrl={cfg.maskUrl}
                                    stickerUrl={activeStickerUrl}
                                    textToPlace={activeTextToPlace}
                                    onUpdateTexture={onUpdateTexture}
                                    onUpdateNormal={applyNormal}
                                    onUpdateColor={(c) => updateMeshColor(meshName, c)}
                                    onSelect={handlePatternSelect}
                                    fabricType={materialSettings.fabricType}
                                    fabricScale={materialSettings.fabricScale}
                                    bgColor={meshColors[meshName] || globalMaterial.color || "#ffffff"}
                                    isSelected={isSelected}
                                    onClick={() => setSelectedMesh(meshName)}
                                    onPlaceSticker={() => setActiveStickerUrl(null)}
                                    onPlaceText={() => setActiveTextToPlace(null)}
                                    preview={preview}
                                    maxSize={160}
                                    activeSelection={editingSelection}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>


            {/* RIGHT: FLOATING 3D CARD */}
            <div className={`
                fixed ${preview ? 'inset-0' : 'lg:absolute top-0 lg:top-6 right-0 lg:right-6 bottom-0 lg:bottom-6 w-full sm:w-[340px] lg:w-[380px]'} 
                pointer-events-none flex flex-col justify-start 
                z-40
                transition-transform duration-300
                ${previewOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
            `}>
                <div className={`bg-white ${preview ? 'rounded-none bg-[#f4f7fa]' : 'rounded-none lg:rounded-[2.5rem]'} shadow-2xl overflow-hidden pointer-events-auto flex flex-col h-full ${preview ? 'lg:h-full' : 'lg:h-[580px]'} relative transition-all border border-zinc-100`}>
                    {/* TOP OVERLAYS (PREVIEW MODE) */}
                    <div className="absolute top-8 left-8 z-50 pointer-events-auto">
                        <div className="bg-white/80 backdrop-blur-xl px-4 py-2 rounded-full flex items-center gap-2 shadow-sm border border-white/50">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            <span className="text-[10px] font-bold tracking-widest text-zinc-900 uppercase">Live Render</span>
                        </div>
                    </div>

                    {preview && (
                        <>
                            <div className="absolute top-8 right-8 z-50 pointer-events-auto flex items-center gap-4">
                                <div className="bg-white/80 backdrop-blur-xl p-1.5 rounded-2xl flex items-center gap-1 shadow-sm border border-white/50">
                                    <button onClick={() => undo()} className="p-2 hover:bg-zinc-100/50 rounded-xl text-zinc-600 transition-colors">
                                        <RotateCcw size={18} />
                                    </button>
                                    <button onClick={() => redo()} className="p-2 hover:bg-zinc-100/50 rounded-xl text-zinc-600 transition-colors">
                                        <RotateCw size={18} />
                                    </button>
                                    <div className="w-[1px] h-4 bg-zinc-200/50 mx-1" />
                                    <button className="p-2 hover:bg-zinc-100/50 rounded-xl text-zinc-600 transition-colors">
                                        <Layers size={18} />
                                    </button>
                                </div>
                                <button className="bg-white/80 backdrop-blur-xl p-3 rounded-2xl shadow-sm border border-white/50 text-zinc-600 transition-colors">
                                    <Moon size={18} />
                                </button>
                            </div>

                            {/* FOOTER INFO */}
                            <div className="absolute bottom-10 left-10 z-50 pointer-events-none opacity-40">
                                <span className="text-[10px] font-bold text-zinc-900 tracking-wider">
                                    Â© 2024 DESIGN ENGINE V2.4.0
                                </span>
                            </div>

                            <div className="absolute bottom-10 right-10 z-50 pointer-events-none opacity-40 text-right space-y-0.5">
                                <div className="text-[10px] font-bold text-zinc-900 tracking-wider">POLYCOUNT: 24.5K</div>
                                <div className="text-[10px] font-bold text-zinc-900 tracking-wider">RESOLUTION: 4096PX</div>
                                <div className="text-[10px] font-bold text-zinc-900 tracking-wider">FORMAT: GLTF / USDZ</div>
                            </div>
                        </>
                    )}

                    {/* Main Canvas Container with Transition */}
                    <div
                        id="three-d-canvas-container"
                        className={`p-4 flex-1 min-h-0 ${preview ? 'bg-transparent' : 'bg-[#1e1e1e]'} transition-all duration-700 ease-[cubic-bezier(0.19,1,0.22,1)]`}
                        style={{
                            width: showAiPrompt ? '60%' : '100%',
                            flex: showAiPrompt ? '0 0 60%' : '1 1 0%'
                        }}
                    >
                        <div className={`w-full h-full rounded-2xl overflow-hidden relative ${preview ? '' : 'shadow-inner ring-1 ring-white/10'}`}>
                            <Canvas
                                shadows
                                camera={{ position: [0, 0, 3.5], fov: 40 }}
                                gl={{
                                    preserveDrawingBuffer: true,
                                    antialias: true,
                                    toneMapping: THREE.ACESFilmicToneMapping,
                                    toneMappingExposure: brightness,
                                    powerPreference: "high-performance"
                                }}
                                dpr={[1, 2]}
                            >
                                <Environment preset={envPreset} background={false} />
                                {bgType === 'solid' && <color attach="background" args={[bgColor]} />}
                                {bgType === 'image' && bgImage && <BackgroundTexture url={bgImage} />}
                                {showAuxLights && (
                                    <>
                                        <ambientLight intensity={0.5} />
                                        <spotLight
                                            position={[10, 15, 10]}
                                            angle={0.5}
                                            penumbra={1}
                                            intensity={1}
                                            castShadow
                                            shadow-mapSize={[2048, 2048]}
                                            shadow-bias={-0.0001}
                                        />
                                        <pointLight position={[-10, 5, -10]} intensity={0.5} color="#eef2ff" />
                                    </>
                                )}

                                <React.Suspense fallback={<Loader />}>
                                    <Center position={[0, -0.2, 0]}>
                                        <DynamicModel
                                            ref={modelRef}
                                            url={glbUrl}
                                            meshTextures={meshTextures}
                                            meshNormals={meshNormals}
                                            meshColors={meshColors}
                                            materialProps={{ color: globalMaterial?.color }}
                                            setMeshList={setMeshList}
                                        />
                                    </Center>
                                    <CaptureController ref={captureRef} />
                                    <ContactShadows
                                        position={[0, -1.4, 0]}
                                        opacity={0.4}
                                        scale={20}
                                        blur={2.5}
                                        color="#000000"
                                    />
                                </React.Suspense>
                                <OrbitControls
                                    makeDefault
                                    minDistance={1.5}
                                    maxDistance={10}
                                    enablePan={false}
                                    enableDamping
                                    dampingFactor={0.05}
                                    minPolarAngle={Math.PI / 4}
                                    maxPolarAngle={Math.PI / 1.8}
                                />
                            </Canvas>

                            {/* FLOATING PREVIEW TOOLBAR (Moved Inside Canvas) */}
                            {preview && (
                                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-auto">
                                    <div className="bg-white px-2 py-2 rounded-full flex items-center gap-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-zinc-100 scale-90 sm:scale-100 origin-bottom transition-all">
                                        <div className="flex items-center gap-1 px-2">
                                            <button
                                                onClick={handleOpenAiPrompt}
                                                className={`p-2.5 hover:bg-zinc-100 rounded-full transition-colors tooltip-trigger ${showAiPrompt ? 'text-indigo-600 bg-indigo-50' : 'text-zinc-600 hover:text-indigo-600'}`}
                                                title="AI Gen"
                                            >
                                                <Wand2 size={20} />
                                            </button>
                                            <button className="p-2.5 hover:bg-zinc-100 rounded-full text-zinc-600 transition-colors">
                                                <Camera size={20} />
                                            </button>
                                            <button className="p-2.5 hover:bg-zinc-100 rounded-full text-zinc-600 transition-colors">
                                                <Share2 size={20} />
                                            </button>
                                        </div>

                                        <div className="w-[1px] h-8 bg-zinc-200" />

                                        <button
                                            onClick={onBack}
                                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-full font-bold text-xs tracking-wide shadow-md shadow-indigo-200 transition-all flex items-center gap-2 ml-1"
                                        >
                                            <X size={14} />
                                            CLOSE PREVIEW
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <AIPanel
                    isOpen={showAiPrompt}
                    screenshot={screenshotUrl}
                    onClose={() => setShowAiPrompt(false)}
                    onSubmit={handleAiSubmit}
                />

            </div>
        </div >
    );
};

const PresetBtn = ({ label, icon: Icon, active, onClick }) => (
    <button
        onClick={onClick}
        className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all ${active ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-zinc-200 text-zinc-500 hover:border-zinc-300'}`}
    >
        <Icon size={16} />
        <span className="text-[9px] font-bold uppercase tracking-wide">{label}</span>
    </button>
);

const TooltipButton = ({ icon: Icon, onClick, isActive }) => (
    <div className="group relative flex justify-center">
        <button onClick={onClick} className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${isActive ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600'}`}>
            <Icon size={22} />
        </button>
    </div>
);

export default DesignPhase;
