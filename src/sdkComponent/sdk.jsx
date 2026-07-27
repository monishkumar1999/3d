import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import axios from "axios";
import {
    Search, Box, Clock, ChevronRight, Package, Plus
} from "lucide-react";

/**
 * Standalone ProductConfigList component for SDK use.
 * No react-router dependency — uses callbacks instead.
 */
function ProductConfigListStandalone({ apiBaseUrl, onProductClick, onNewConfig }) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await axios.get(`${apiBaseUrl}/product/list-all`);
                if (response.data.success) {
                    setProducts(response.data.products);
                }
            } catch (error) {
                console.error("Failed to fetch products", error);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, [apiBaseUrl]);

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleProductClick = (product) => {
        if (onProductClick) {
            onProductClick(product);
        }
    };

    const handleNewConfig = () => {
        if (onNewConfig) {
            onNewConfig();
        }
    };

    return (
        <div style={{ maxWidth: "1152px", margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
            {/* Header */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "24px", background: "#fff", padding: "32px", borderRadius: "24px", border: "1px solid #f4f4f5", marginBottom: "32px" }}>
                <div>
                    <h1 style={{ fontSize: "1.875rem", fontWeight: 900, color: "#18181b", margin: 0 }}>3D Configurator</h1>
                    <p style={{ color: "#71717a", fontWeight: 500, margin: "4px 0 0" }}>Select a product to manage its 3D PBR configurations</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ position: "relative" }}>
                        <Search style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#a1a1aa" }} size={20} />
                        <input
                            type="text"
                            placeholder="Search models..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ paddingLeft: "48px", paddingRight: "24px", paddingTop: "14px", paddingBottom: "14px", background: "#fafafa", border: "none", borderRadius: "16px", width: "320px", fontWeight: 500, color: "#18181b", outline: "none", fontSize: "14px" }}
                        />
                    </div>
                    <button
                        onClick={handleNewConfig}
                        style={{ display: "flex", alignItems: "center", gap: "8px", padding: "14px 24px", background: "#4f46e5", color: "#fff", borderRadius: "16px", fontWeight: 700, border: "none", cursor: "pointer", fontSize: "14px" }}
                    >
                        <Plus size={20} />
                        New Config
                    </button>
                </div>
            </div>

            {/* Grid */}
            {loading ? (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
                    {[1, 2, 3].map(i => (
                        <div key={i} style={{ height: "192px", background: "#fff", borderRadius: "24px", border: "1px solid #f4f4f5", animation: "pulse 2s infinite" }} />
                    ))}
                </div>
            ) : filteredProducts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "96px 0", background: "#fff", borderRadius: "24px", border: "2px dashed #f4f4f5" }}>
                    <div style={{ width: "64px", height: "64px", background: "#fafafa", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                        <Box style={{ color: "#d4d4d8" }} size={32} />
                    </div>
                    <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#18181b", margin: 0 }}>No products found</h3>
                    <p style={{ color: "#71717a", marginTop: "8px" }}>Try searching for a different product name</p>
                </div>
            ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "24px" }}>
                    {filteredProducts.map((product) => (
                        <div
                            key={product.id}
                            onClick={() => handleProductClick(product)}
                            style={{ background: "#fff", borderRadius: "24px", border: "1px solid #f4f4f5", padding: "24px", cursor: "pointer", transition: "all 0.3s" }}
                            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 20px 40px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#e0e7ff"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#f4f4f5"; }}
                        >
                            <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "24px" }}>
                                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                                    <div style={{ width: "56px", height: "56px", background: "#eef2ff", borderRadius: "16px", display: "flex", alignItems: "center", justifyContent: "center", color: "#4f46e5" }}>
                                        <Box size={28} />
                                    </div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", background: "#ecfdf5", color: "#15803d", borderRadius: "9999px", fontSize: "12px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                        <div style={{ width: "6px", height: "6px", background: "#22c55e", borderRadius: "50%" }} />
                                        Ready
                                    </div>
                                </div>

                                <div>
                                    <h3 style={{ fontSize: "1.25rem", fontWeight: 900, color: "#18181b", margin: 0 }}>{product.name}</h3>
                                    <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#a1a1aa", marginTop: "8px" }}>
                                        <Clock size={14} />
                                        <span style={{ fontSize: "12px", fontWeight: 700, fontFamily: "monospace", textTransform: "uppercase" }}>ID: {product.id.slice(0, 8)}</span>
                                    </div>
                                </div>

                                <div style={{ paddingTop: "16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #fafafa", marginTop: "auto" }}>
                                    <span style={{ fontSize: "12px", fontWeight: 900, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.1em" }}>Configure 3D</span>
                                    <div style={{ width: "40px", height: "40px", background: "#fafafa", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", color: "#a1a1aa" }}>
                                        <ChevronRight size={20} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}

/**
 * ProductConfigListSDK
 * 
 * Usage:
 *   <script src="product-config-list-sdk.umd.cjs"></script>
 *   <div id="app"></div>
 *   <script>
 *     ProductConfigListSDK.render("#app", {
 *       apiBaseUrl: "http://localhost:5000/api",
 *       onProductClick: function(product) {
 *         console.log("Clicked:", product.id, product.name);
 *       }
 *     });
 *   </script>
 */
const SDK = {
    render(selector, options = {}) {
        let container;
        if (typeof selector === "string") {
            container = document.querySelector(selector);
        } else if (selector instanceof HTMLElement) {
            container = selector;
        }

        if (!container) {
            console.error(`[ProductConfigListSDK] Container not found: ${selector}`);
            return null;
        }

        const {
            apiBaseUrl = "http://localhost:5000",
            onProductClick = (product) => console.log("Product clicked:", product),
            onNewConfig = () => console.log("New config clicked"),
        } = options;

        const root = createRoot(container);
        root.render(
            React.createElement(ProductConfigListStandalone, {
                apiBaseUrl,
                onProductClick,
                onNewConfig,
            })
        );

        return {
            destroy() { root.unmount(); },
            update(newOptions) {
                root.render(
                    React.createElement(ProductConfigListStandalone, {
                        apiBaseUrl: newOptions.apiBaseUrl || apiBaseUrl,
                        onProductClick: newOptions.onProductClick || onProductClick,
                        onNewConfig: newOptions.onNewConfig || onNewConfig,
                    })
                );
            },
        };
    },
    version: "1.0.0",
};

export default SDK;
