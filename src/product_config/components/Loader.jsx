import { memo } from "react";
import { Html, useProgress } from "@react-three/drei";

const Loader = memo(() => {
    const { progress } = useProgress();
    return (
        <Html center>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <div style={{
                    width: 40, height: 40,
                    border: "3px solid rgba(139,92,246,0.2)",
                    borderTopColor: "#8b5cf6",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                }} />
                <p style={{ color: "#8b5cf6", fontSize: 11, fontWeight: 700, letterSpacing: 2, margin: 0 }}>
                    {Math.round(progress)}%
                </p>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
        </Html>
    );
});

Loader.displayName = "Loader";
export default Loader;
