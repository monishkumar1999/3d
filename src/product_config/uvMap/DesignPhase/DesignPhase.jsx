import React, { useState } from "react";
import { useSelector } from "react-redux";
import store from "../../../store/redux/store";
import SidebarStrip from "./SidebarStrip";
import AssetsLibrary from "./AssetsLibrary";
import WorkspaceArea from "./WorkspaceArea";
import ThreeDCanvas from "./ThreeDCanvas";
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

    const productName = useSelector(state => state.uvMap.productName);

    const handleSaveClick = async () => {
        if (!productId) {
            alert("No Product ID found! Cannot save meshes.");
            return;
        }
        setIsSaving(true);
        try {
            const activeConfigs = Object.entries(meshConfig).filter(([_, cfg]) => cfg.maskUrl);
            const promises = activeConfigs.map(async ([meshName, cfg]) => {
                // Get zones (drawingRect values) for this mesh from Redux store
                const patternState = store.getState().uvMap.patternStates[meshName];
                const zones = patternState?.zones || [];

                const formData = new FormData();
                formData.append("productId", productId);
                formData.append("meshName", meshName);

                // White mask PNG file
                const solidDataUrl = await processWireframeToSolid(cfg.maskUrl);
                const res = await fetch(solidDataUrl);
                const blob = await res.blob();
                formData.append("whiteMask", blob, `${meshName}_white.png`);

                // Zones / drawingRect data as JSON string
                formData.append("zones", JSON.stringify(zones));

                await api.post("/product/mesh/save-path", formData, {
                    headers: { "Content-Type": "multipart/form-data" }
                });

                console.log(`[Save] Sent for mesh: "${meshName}"`, {
                    productId,
                    meshName,
                    whiteMaskFileName: `${meshName}_white.png`,
                    zones,
                });
            });
            await Promise.all(promises);
            alert("Meshes Saved Successfully!");
        } catch (error) {
            console.error("Save failed", error);
            alert("Failed to save meshes. Check console.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex w-full h-full relative bg-[#f8f9fc] overflow-hidden">
            <SidebarStrip sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} onBack={onBack} />
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
        </div>
    );
};

export default DesignPhase;
