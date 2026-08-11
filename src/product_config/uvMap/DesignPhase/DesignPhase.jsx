import React, { useState } from "react";
import { useSelector } from "react-redux";
import store from "../../../store/redux/store";
import SidebarStrip from "./SidebarStrip";
import AssetsLibrary from "./AssetsLibrary";
import WorkspaceArea from "./WorkspaceArea";
import ThreeDCanvas from "./ThreeDCanvas";
import SavedDesignsModal from "./SavedDesignsModal";
import api from "../../../api/axios";
import { processWireframeToSolid } from "../utils/maskProcessor";

export const DesignPhase = ({
    productId, glbUrl, meshConfig, meshTextures, baseTextures, globalMaterial,
    activeStickerUrl, setGlobalMaterial, setActiveStickerUrl, onBack, onUpdateTexture
}) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [selectedMesh, setSelectedMesh] = useState(null);
    const [meshColors, setMeshColors] = useState({});
    const [meshMaterials, setMeshMaterials] = useState({});
    const [envPreset, setEnvPreset] = useState("studio");
    const [brightness, setBrightness] = useState(1);
    const [showWireframe, setShowWireframe] = useState(true);
    const [pbrTextures, setPbrTextures] = useState({ normal: null, roughness: null, metalness: null, ao: null });
    const [isSaving, setIsSaving] = useState(false);
    const [isSavedDesignsModalOpen, setIsSavedDesignsModalOpen] = useState(false);

    // Sync meshMaterials with baseTextures on load
    React.useEffect(() => {
        if (baseTextures && Object.keys(baseTextures).length > 0) {
            const initialMaterials = {};
            Object.entries(baseTextures).forEach(([meshName, tex]) => {
                initialMaterials[meshName] = {
                    transmission: tex.transmission !== undefined ? Number(tex.transmission) : 0,
                    opacity: tex.opacity !== undefined ? Number(tex.opacity) : 1,
                    roughness: tex.roughness !== undefined ? Number(tex.roughness) : (globalMaterial?.roughness ?? 0.5),
                    metalness: tex.metalness !== undefined ? Number(tex.metalness) : (globalMaterial?.metalness ?? 0),
                };
            });
            setMeshMaterials(initialMaterials);
        }
    }, [baseTextures, globalMaterial]);

    const productName = useSelector(state => state.uvMap.productName);

    const handleSaveClick = async () => {
        if (!productId) {
            alert("No Product ID found! Cannot save design.");
            return;
        }
        setIsSaving(true);
        try {
            // 1. Save mesh white masks and zones to /product/mesh/save-path
            const activeConfigs = Object.entries(meshConfig).filter(([_, cfg]) => cfg.maskUrl);
            const promises = activeConfigs.map(async ([meshName, cfg]) => {
                const patternState = store.getState().uvMap.patternStates[meshName];
                const zones = patternState?.zones || [];

                const formData = new FormData();
                formData.append("productId", productId);
                formData.append("meshName", meshName);

                const solidDataUrl = await processWireframeToSolid(cfg.maskUrl);
                const res = await fetch(solidDataUrl);
                const blob = await res.blob();
                formData.append("whiteMask", blob, `${meshName}_white.png`);
                formData.append("zones", JSON.stringify(zones));

                await api.post("/product/mesh/save-path", formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });

                console.log(`[Save Mesh] Sent for mesh: "${meshName}"`, {
                    productId,
                    meshName,
                    whiteMaskFileName: `${meshName}_white.png`,
                    zones,
                });
            });
            await Promise.all(promises);

            // 2. Save full custom user design (stickers, textNodes, colors, materials) to user_designs table via /save-design
            const patternStates = store.getState().uvMap.patternStates || {};
            const meshStickers = {};
            const meshTextNodes = {};
            const meshZones = {};

            const designFormData = new FormData();
            designFormData.append("productId", productId);
            designFormData.append("designName", productName || "Custom Product Design");

            const blobToDataURL = (blob) => new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });

            for (const [mName, pState] of Object.entries(patternStates)) {
                if (pState.stickers && pState.stickers.length > 0) {
                    const processedStickers = await Promise.all(pState.stickers.map(async (s) => {
                        let stickerUrl = s.url || s.src || s.image?.src || "";

                        if (stickerUrl.startsWith("blob:") || stickerUrl.startsWith("data:")) {
                            try {
                                const response = await fetch(stickerUrl);
                                const blob = await response.blob();
                                designFormData.append(`sticker_${s.id}`, blob, `sticker_${s.id}.png`);
                                designFormData.append(s.id, blob, `${s.id}.png`);
                                stickerUrl = await blobToDataURL(blob);
                            } catch (e) {
                                console.error("Failed to process blob sticker:", e);
                            }
                        }

                        return {
                            id: s.id,
                            url: stickerUrl,
                            x: s.x,
                            y: s.y,
                            width: s.width,
                            height: s.height,
                            rotation: s.rotation || 0,
                            scaleX: s.scaleX || 1,
                            scaleY: s.scaleY || 1,
                            opacity: s.opacity !== undefined ? s.opacity : 1,
                        };
                    }));
                    meshStickers[mName] = processedStickers;
                }

                if (pState.textNodes && pState.textNodes.length > 0) {
                    meshTextNodes[mName] = pState.textNodes.map(t => ({
                        id: t.id,
                        text: t.text,
                        x: t.x,
                        y: t.y,
                        fontSize: t.fontSize,
                        fontFamily: t.fontFamily,
                        fill: t.fill,
                        rotation: t.rotation || 0,
                        scaleX: t.scaleX || 1,
                        scaleY: t.scaleY || 1,
                    }));
                }

                if (pState.zones && pState.zones.length > 0) {
                    meshZones[mName] = pState.zones;
                }
            }

            const designData = {
                meshColors,
                meshMaterials,
                meshStickers,
                meshTextNodes,
                meshZones,
                globalMaterial,
            };

            designFormData.append("designData", JSON.stringify(designData));

            await api.post("/product/save-design", designFormData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            console.log("[Save Design] Saved to user_designs table:", {
                productId,
                designName: productName || "Custom Product Design",
                designData
            });

            alert("Design Saved Successfully!");
        } catch (error) {
            console.error("Save failed", error);
            alert("Failed to save design. Check console.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex w-full h-full relative bg-[#f8f9fc] overflow-hidden">
            <SidebarStrip
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
                onBack={onBack}
                onOpenSavedDesigns={() => setIsSavedDesignsModalOpen(true)}
            />
            <AssetsLibrary
                sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} setActiveStickerUrl={setActiveStickerUrl}
                selectedMesh={selectedMesh} meshMaterials={meshMaterials} setMeshMaterials={setMeshMaterials}
                envPreset={envPreset} setEnvPreset={setEnvPreset} brightness={brightness} setBrightness={setBrightness}
                pbrTextures={pbrTextures} setPbrTextures={setPbrTextures}
            />
            <WorkspaceArea
                productName={productName} showWireframe={showWireframe} setShowWireframe={setShowWireframe}
                meshConfig={meshConfig} activeStickerUrl={activeStickerUrl} onUpdateTexture={onUpdateTexture}
                setActiveStickerUrl={setActiveStickerUrl} meshColors={meshColors} globalMaterial={globalMaterial}
                selectedMesh={selectedMesh} setSelectedMesh={setSelectedMesh}
            />
            <ThreeDCanvas
                glbUrl={glbUrl} meshTextures={meshTextures} baseTextures={baseTextures} pbrTextures={pbrTextures}
                meshMaterials={meshMaterials} globalMaterial={globalMaterial} brightness={brightness}
                envPreset={envPreset} handleSaveClick={handleSaveClick} isSaving={isSaving}
                selectedMesh={selectedMesh}
            />
            <SavedDesignsModal
                isOpen={isSavedDesignsModalOpen}
                onClose={() => setIsSavedDesignsModalOpen(false)}
            />
        </div>
    );
};

export default DesignPhase;
