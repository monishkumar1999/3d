import React from "react";
import { Html, useProgress } from "@react-three/drei";

export const Loader = () => {
    const { progress } = useProgress();
    console.log(" checking " + progress);
    return (
        <Html center>
            <div className="flex flex-col items-center gap-2">
                <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs font-bold text-indigo-600">{progress.toFixed(0)}%</p>
            </div>
        </Html>
    );
};

export default Loader;
