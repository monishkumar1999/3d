import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

/* =========================================================
   REDIRECT TO PRODUCTS
   ========================================================= */
export default function ProTShirtStudio() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/products');
  }, [navigate]);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-[#f8f9fc]">
      <div className="text-zinc-400 font-medium">Redirecting to Products...</div>
    </div>
  );
}
