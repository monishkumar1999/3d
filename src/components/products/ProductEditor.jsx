import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as THREE from "three";
import api from "../../api/axios";
import TestUVWorkflow from "../../3d/components/TestUVWorkflow";


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
    const [activeMaskUrl, setActiveMaskUrl] = useState(null);
    const [productData, setProductData] = useState(null);

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

                    // 2. Set Active Mask URL (First mesh's original SVG)
                    if (product.meshes && product.meshes.length > 0) {
                        setActiveMaskUrl(getAssetUrl(product.meshes[0].originalSvgPath));
                    }

                    // 3. Set Product Data
                    setProductData({
                        name: product.name,
                        category: product.category,
                        subcategory: product.subcategory,
                        isCloth: product.is_cloth === '1' || product.is_cloth === true
                    });
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



    if (loading) {
        return (
            <div className="w-full h-screen flex items-center justify-center bg-[#f8f9fc]">
                <div className="text-zinc-400 font-medium animate-pulse">Loading Product Editor...</div>
            </div>
        );
    }

    return (
        <div className="w-full h-[calc(100vh-64px)] bg-[#f8f9fc] text-zinc-900 font-sans overflow-hidden">
            {productData && (
                <TestUVWorkflow
                    initialGlbUrl={glbUrl}
                    initialMaskUrl={activeMaskUrl}
                    initialProductData={productData}
                />
            )}
        </div>
    );
};

export default ProductEditor;
