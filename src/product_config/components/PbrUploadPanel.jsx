/**
 * PbrUploadPanel.jsx
 * clean wrapper for the modular PBR Panel
 */
import { memo } from "react";
import PbrPanel from "./PbrPanel";

const PbrUploadPanel = memo(() => {
    return <PbrPanel />;
});

PbrUploadPanel.displayName = "PbrUploadPanel";
export default PbrUploadPanel;
