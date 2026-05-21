import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";

const ProductEditor = () => {
    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        if (id) {
            navigate(`/uvMap/${id}`, { replace: true });
        }
    }, [id, navigate]);

    return (
        <div className="w-full h-screen flex items-center justify-center bg-[#f8f9fc]">
            <div className="text-zinc-400 font-medium animate-pulse">Redirecting to UV Studio...</div>
        </div>
    );
};

export default ProductEditor;
