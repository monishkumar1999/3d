import React, { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useDispatch } from "react-redux";
import SetupPhase from "./SetupPhase/SetupPhase";
import DesignPhase from "./DesignPhase/DesignPhase";
import { useProductLoader } from "./hooks/useProductLoader";
import { useVariantTextures } from "./hooks/useVariantTextures";
import { useUvHandlers } from "./hooks/useUvHandlers";
import { VariantSelector } from "./Toolbar/VariantSelector";
import { loadDesignData } from "../../store/redux/uvMapSlice";
import api from "../../api/axios";

export default function UvMap() {
    const { productId } = useParams();
    const [searchParams] = useSearchParams();
    const designId = searchParams.get("designId");
    const dispatch = useDispatch();

    const [phase, setPhase] = useState("setup");
    const [meshList, setMeshList] = useState([]);
    const [meshTextures, setMeshTextures] = useState({});
    const [globalMaterial, setGlobalMaterial] = useState({ color: "#ffffff", roughness: 0.5, metalness: 0, wireframe: false });
    const [activeStickerUrl, setActiveStickerUrl] = useState(null);

    const { productData, glbUrl, setGlbUrl, meshConfig, setMeshConfig, selectedVariantId, setSelectedVariantId } = useProductLoader(productId);
    const { variantTextures, loadingTextures } = useVariantTextures(productData, selectedVariantId);
    const { handleGlb, handleMaskUpload, applyTexture } = useUvHandlers(glbUrl, setGlbUrl, setMeshList, setMeshConfig, setMeshTextures);

    const checkedProductRef = useRef(null);

    // Fetch design details if designId query param is provided
    useEffect(() => {
        if (!designId) return;
        const fetchDesign = async () => {
            try {
                const res = await api.get(`/product/design/${designId}`);
                const data = res.data;
                if (data && data.designData) {
                    const parsedData = typeof data.designData === 'string' ? JSON.parse(data.designData) : data.designData;
                    dispatch(loadDesignData(parsedData));
                    if (parsedData.globalMaterial) {
                        setGlobalMaterial(prev => ({ ...prev, ...parsedData.globalMaterial }));
                    }
                    setPhase("design");
                }
            } catch (err) {
                console.error("Failed to load design:", err);
            }
        };
        fetchDesign();
    }, [designId, dispatch]);

    // Auto-jump to design phase if the product already has saved meshes
    useEffect(() => {
        if (!productId || !productData) return;
        if (checkedProductRef.current === productId) return;

        const hasSavedMeshes = Object.values(meshConfig).some(cfg => cfg.maskUrl);
        if (hasSavedMeshes) {
            setPhase("design");
        }
        checkedProductRef.current = productId;
    }, [meshConfig, productId, productData]);

    return (
        <div className="w-full h-screen bg-[#f8f9fc] text-zinc-900 font-sans overflow-hidden relative">
            <VariantSelector
                productId={productId}
                variants={productData?.variants}
                selectedVariantId={selectedVariantId}
                setSelectedVariantId={setSelectedVariantId}
                loadingTextures={loadingTextures}
            />

            {phase === "setup" ? (
                <SetupPhase
                    glbUrl={glbUrl}
                    meshList={meshList}
                    meshConfig={meshConfig}
                    globalMaterial={globalMaterial}
                    setGlbUrl={setGlbUrl}
                    handleGlb={handleGlb}
                    handleMaskUpload={handleMaskUpload}
                    setMeshList={setMeshList}
                    onLaunch={() => setPhase("design")}
                    baseTextures={variantTextures}
                    autoPlaceMeshes={!!productId}
                />
            ) : (
                <DesignPhase
                    productId={productId}
                    glbUrl={glbUrl}
                    meshConfig={meshConfig}
                    meshTextures={meshTextures}
                    baseTextures={variantTextures}
                    globalMaterial={globalMaterial}
                    activeStickerUrl={activeStickerUrl}
                    setGlobalMaterial={setGlobalMaterial}
                    setActiveStickerUrl={setActiveStickerUrl}
                    onBack={() => setPhase("setup")}
                    onUpdateTexture={applyTexture}
                />
            )}
        </div>
    );
}
