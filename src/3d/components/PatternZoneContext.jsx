import React, { createContext, useContext, useState, useRef } from "react";
import { usePatternMasks } from "../hooks/usePatternMasks";
import { usePatternExport } from "../hooks/usePatternExport";

const PatternZoneContext = createContext(null);

export const PatternZoneProvider = ({ children, meshName, maskUrl, stickerUrl, onUpdateTexture, onStickerAdded, isSelected, onClick }) => {
    const stageRef = useRef(null);
    const uiContainerRef = useRef(null);
    const trRef = useRef(null);

    const { maskImg, wireframeImg } = usePatternMasks(maskUrl);

    const [stickers, setStickers] = useState([]);
    const [textNodes, setTextNodes] = useState([]);
    const stickersRef = useRef(stickers); stickersRef.current = stickers;
    const textNodesRef = useRef(textNodes); textNodesRef.current = textNodes;

    const [selectedId, setSelectedId] = useState(null);
    const [zones, setZones] = useState([]);
    const zonesRef = useRef(zones); zonesRef.current = zones;

    const [zoneMode, setZoneMode] = useState(null);
    const [drawingRect, setDrawingRect] = useState(null);
    const [polyPoints, setPolyPoints] = useState([]);
    const [cursorPos, setCursorPos] = useState(null);
    const [selectedZoneId, setSelectedZoneId] = useState(null);

    const maxSize = 340;
    const uiScale = maskImg ? Math.min(maxSize / maskImg.naturalWidth, maxSize / maskImg.naturalHeight) : 1;
    const displayW = maskImg ? maskImg.naturalWidth * uiScale : 300;
    const displayH = maskImg ? maskImg.naturalHeight * uiScale : 300;

    const { triggerExport } = usePatternExport({
        stageRef, maskImg, uiScale, displayW, displayH,
        stickersRef, textNodesRef, zonesRef, meshName, onUpdateTexture, selectedId, trRef
    });

    const value = {
        meshName, maskUrl, stickerUrl, onUpdateTexture, onStickerAdded, isSelected, onClick,
        stageRef, uiContainerRef, trRef, maskImg, wireframeImg,
        stickers, setStickers, textNodes, setTextNodes,
        selectedId, setSelectedId, zones, setZones,
        zoneMode, setZoneMode, drawingRect, setDrawingRect,
        polyPoints, setPolyPoints, cursorPos, setCursorPos,
        selectedZoneId, setSelectedZoneId,
        uiScale, displayW, displayH, triggerExport
    };

    return (
        <PatternZoneContext.Provider value={value}>
            {children}
        </PatternZoneContext.Provider>
    );
};

export const usePatternZone = () => {
    const context = useContext(PatternZoneContext);
    if (!context) {
        throw new Error("usePatternZone must be used within a PatternZoneProvider");
    }
    return context;
};
