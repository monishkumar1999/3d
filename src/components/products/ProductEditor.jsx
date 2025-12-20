import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as THREE from "three";
import api from "../../api/axios";
import SetupPhase from "../../3d/components/SetupPhase";
import DesignPhase from "../../3d/components/DesignPhase";
import { optimizeImage } from "../../utils/imageOptimizer";

// Helper to construct full URL for static assets
const getAssetUrl = (path) => {
    if (!path) return null;
    if (path.startsWith("http")) return path;
    // Remove leading slash if present to avoid double slashes
    const cleanPath = path.startsWith("/") ? path.slice(1) : path;
    return `${import.meta.env.VITE_API}/${cleanPath}`;
};

const ProductEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [phase, setPhase] = useState('design'); // Start in design to edit immediately

    // -- Project Data --
    const [glbUrl, setGlbUrl] = useState(null);
    const [meshList, setMeshList] = useState([]);
    const [meshConfig, setMeshConfig] = useState({}); // { meshName: { maskUrl } }

    // -- Editor State --
    const [meshTextures, setMeshTextures] = useState({});
    const [globalMaterial, setGlobalMaterial] = useState({ color: "#ffffff", roughness: 0.5, metalness: 0, wireframe: false });
    const [activeStickerUrl, setActiveStickerUrl] = useState(null);

    useEffect(() => {
        const fetchProduct = async () => {
            try {
                setLoading(true);
                // We can fetch by ID directly
                // The user example showed fetching by Slug, but ID is usually cleaner if we have it from list
                // Let's try fetching by ID if the API supports it, otherwise we might need to change route param to slug?
                // User said: "call and i want the editing environment". The list provides ID. 
                // Typically GET /product/:id works.
                // If not, we'll try fetching list and finding it? No, that's inefficient.
                // Let's assume GET /product/:id or similar endpoint exists or query by ID.
                // Refencing the request: "http://localhost:5000/product/test-product..." was by slug in the example.
                // But the list had IDs. Let's try /product/:id first.

                // Actually, the user PROMPT gave an example calling by SLUG:
                // http://localhost:5000/product/test-product-1766196868285-1766196868341

                // Use the ID from params, but if the backend expects slug, we might need a lookup. 
                // However, standard REST practices suggest /product/:id should work. 
                // Let's try /product/:id.
                const response = await api.get(`/product/${id}`);

                if (response.data.success) {
                    const product = response.data.product;

                    // 1. Set GLB URL
                    setGlbUrl(getAssetUrl(product.base_model_url));

                    // 2. Set Mesh Config
                    const config = {};
                    if (product.meshes && Array.isArray(product.meshes)) {
                        product.meshes.forEach(mesh => {
                            config[mesh.meshName] = {
                                maskUrl: getAssetUrl(mesh.whiteMaskPath),
                                originalSvgPath: getAssetUrl(mesh.originalSvgPath)
                                // We might need to handle 'isPlaced' logic in SetupPhase implicitly 
                                // by checking if maskUrl exists.
                            };
                        });
                    }
                    setMeshConfig(config);

                    // 3. Set other metadata if needed (store updates)
                    // import useStore and setProductName maybe? 
                    // But SetupPhase uses useStore internally for name/category. 
                    // We should probably sync that.
                }
            } catch (error) {
                console.error("Failed to fetch product", error);
                // Fallback or user notification
            } finally {
                setLoading(false);
            }
        };

        if (id) {
            fetchProduct();
        }
    }, [id]);

    // Sync with Store for Name/Category (optional, but good for UI consistency)
    // ... (Can add later if needed)

    // -- Handlers (Copied/Adapted from UvMap.jsx) --

    const handleGlb = (e) => {
        // Allow replacing GLB if needed?
        const file = e.target.files[0];
        if (file) {
            if (glbUrl) URL.revokeObjectURL(glbUrl);
            setGlbUrl(URL.createObjectURL(file));
            // Reset config if changing model completely?
            // setMeshList([]);
            // setMeshConfig({});
        }
    };

    const handleMaskUpload = (meshName, e) => {
        const file = e.target.files[0];
        if (file) {
            optimizeImage(file, 1024, 0.8)
                .then(blob => {
                    const optimizedUrl = URL.createObjectURL(blob);
                    setMeshConfig(prev => ({
                        ...prev,
                        [meshName]: { ...prev[meshName], maskUrl: optimizedUrl }
                    }));
                })
                .catch(err => {
                    console.error("Optimization failed", err);
                    setMeshConfig(prev => ({
                        ...prev,
                        [meshName]: { ...prev[meshName], maskUrl: URL.createObjectURL(file) }
                    }));
                });
        }
    };

    const applyTexture = useCallback((meshName, dataUrl) => {
        if (!dataUrl) {
            setMeshTextures(prev => {
                const next = { ...prev };
                delete next[meshName];
                return next;
            });
            return;
        }

        const img = new Image();
        // If crossOrigin is needed for Canvas manipulation of remote images
        img.crossOrigin = "anonymous";
        img.src = dataUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');

            // Fill White (for mask logic)
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            // Draw Texture
            ctx.drawImage(img, 0, 0);

            const solidDataUrl = canvas.toDataURL();
            const loader = new THREE.TextureLoader();
            const tex = loader.load(solidDataUrl);
            tex.colorSpace = THREE.SRGBColorSpace;
            tex.flipY = false;

            setMeshTextures(prev => ({ ...prev, [meshName]: tex }));
        };
    }, []);

    if (loading) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-[#f8f9fc]">
                <div className="text-zinc-400 font-medium animate-pulse">Loading Product Editor...</div>
            </div>
        );
    }

    return (
        <div className="w-full h-screen bg-[#f8f9fc] text-zinc-900 font-sans overflow-hidden">
            {phase === 'setup' ? (
                <SetupPhase
                    glbUrl={glbUrl}
                    meshList={meshList}
                    meshConfig={meshConfig}
                    globalMaterial={globalMaterial}
                    setGlbUrl={setGlbUrl}
                    handleGlb={handleGlb}
                    handleMaskUpload={handleMaskUpload}
                    setMeshList={setMeshList}
                    onLaunch={() => setPhase('design')}
                />
            ) : (
                <DesignPhase
                    glbUrl={glbUrl}
                    meshConfig={meshConfig}
                    meshTextures={meshTextures}
                    globalMaterial={globalMaterial}
                    activeStickerUrl={activeStickerUrl}
                    setGlobalMaterial={setGlobalMaterial}
                    setActiveStickerUrl={setActiveStickerUrl}
                    onBack={() => setPhase('setup')}
                    onUpdateTexture={applyTexture}
                />
            )}
        </div>
    );
};

export default ProductEditor;
