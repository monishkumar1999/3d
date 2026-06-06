import { useState, useEffect } from "react";
import { getProductDetails } from "../../../api/productConfigApi";
import { store as reduxStore } from "../../../store/redux/store";
import { startLoading, stopLoading, updateProgress, updateMessage } from "../../../store/redux/loaderSlice";

export const useProductLoader = (productId) => {
  const [productData, setProductData] = useState(null);
  const [glbUrl, setGlbUrl] = useState(null);
  const [meshConfig, setMeshConfig] = useState({});
  const [selectedVariantId, setSelectedVariantId] = useState(null);

  useEffect(() => {
    if (!productId) return;
    const loadProduct = async () => {
      reduxStore.dispatch(startLoading({
          title: "Fetching Product Data",
          message: "Retrieving configuration and variants from database...",
          type: "process",
          progress: 20
      }));
      try {
        const res = await getProductDetails(productId);
        reduxStore.dispatch(updateProgress(60));

        if (!res.data?.success) {
            reduxStore.dispatch(stopLoading());
            return;
        }

        const product = res.data.product;
        reduxStore.dispatch(updateMessage("Processing and loading 3D model..."));
        reduxStore.dispatch(updateProgress(80));

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

        reduxStore.dispatch(updateProgress(100));
        setTimeout(() => reduxStore.dispatch(stopLoading()), 300);
      } catch (err) {
        console.error("Failed to load product for UvMap:", err);
        reduxStore.dispatch(stopLoading());
      }
    };
    loadProduct();
  }, [productId]);

  return { productData, glbUrl, setGlbUrl, meshConfig, setMeshConfig, selectedVariantId, setSelectedVariantId };
};
