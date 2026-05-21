import { useState, useEffect } from "react";
import { getProductDetails } from "../../../api/productConfigApi";

export const useProductLoader = (productId) => {
  const [productData, setProductData] = useState(null);
  const [glbUrl, setGlbUrl] = useState(null);
  const [meshConfig, setMeshConfig] = useState({});
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  useEffect(() => {
    if (!productId) return;
    const loadProduct = async () => {
      try {
        const res = await getProductDetails(productId);
        if (!res.data?.success) return;
        const product = res.data.product;
        setProductData(product);

        if (product.base_model_url) setGlbUrl(product.base_model_url);
        
        if (product.meshes && Array.isArray(product.meshes)) {
          const config = {};
          product.meshes.forEach(mesh => {
            if (mesh.whiteMaskPath) config[mesh.meshName] = { maskUrl: mesh.whiteMaskPath };
          });
          if (Object.keys(config).length > 0) setMeshConfig(config);
        }
        
        if (product.variants?.length > 0) setSelectedVariantId(product.variants[0].id);
      } catch (err) {
        console.error("Failed to load product for UvMap:", err);
      }
    };
    loadProduct();
  }, [productId]);

  return { productData, glbUrl, setGlbUrl, meshConfig, setMeshConfig, selectedVariantId, setSelectedVariantId };
};
