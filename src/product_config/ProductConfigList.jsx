import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Search, 
    Box, 
    Settings2, 
    ArrowRight, 
    Clock, 
    ChevronRight,
    Package,
    Plus
} from 'lucide-react';
import { getProductNames } from '../api/productConfigApi';

const ProductConfigList = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await getProductNames();
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
    }, []);

    const filteredProducts = products.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight">3D Configurator</h1>
                    <p className="text-zinc-500 font-medium">Select a product to manage its 3D PBR configurations</p>
                </div>
                
                <div className="flex items-center gap-4">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-indigo-500 transition-colors" size={20} />
                        <input
                            type="text"
                            placeholder="Search models..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 pr-6 py-3.5 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-indigo-500/20 w-full md:w-80 font-medium text-zinc-900 transition-all outline-none placeholder:text-zinc-400"
                        />
                    </div>
                    <button 
                        onClick={() => navigate('/product-config')}
                        className="flex items-center gap-2 px-6 py-3.5 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all"
                    >
                        <Plus size={20} />
                        New Config
                    </button>
                </div>
            </div>

            {/* Grid Section */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-white rounded-3xl border border-zinc-100 animate-pulse" />
                    ))}
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-3xl border border-zinc-100 border-dashed">
                    <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Box className="text-zinc-300" size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900">No products found</h3>
                    <p className="text-zinc-500 mt-2">Try searching for a different product name</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map((product) => (
                        <div 
                            key={product.id}
                            className="group relative bg-white rounded-3xl border border-zinc-100 p-6 hover:shadow-xl hover:shadow-zinc-200/50 hover:border-indigo-100 transition-all duration-300 cursor-pointer"
                            onClick={() => navigate(`/product-config/${product.id}`)}
                        >
                            <div className="flex flex-col h-full space-y-6">
                                <div className="flex items-start justify-between">
                                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500">
                                        <Box size={28} />
                                    </div>
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black uppercase tracking-wider">
                                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                        Ready
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <h3 className="text-xl font-black text-zinc-900 leading-tight group-hover:text-indigo-600 transition-colors">
                                        {product.name}
                                    </h3>
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <Clock size={14} />
                                        <span className="text-xs font-bold font-mono tracking-tighter uppercase">ID: {product.id.slice(0, 8)}</span>
                                    </div>
                                </div>

                                <div className="pt-4 flex items-center justify-between border-t border-zinc-50 mt-auto">
                                    <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">Configure 3D</span>
                                    <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                                        <ChevronRight size={20} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProductConfigList;
