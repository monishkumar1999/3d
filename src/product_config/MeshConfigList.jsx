/**
 * MeshConfigList.jsx — Mesh Configuration page
 * - Lists products, shows 3D model with backend textures
 * - Mesh names extracted client-side from GLB
 * - UV map upload (white mask + original SVG) per mesh
 */
import React, { useState, useEffect, useCallback, memo, useMemo, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Search, Box, ChevronRight, Clock, Loader2, Layers,
    Hexagon, ArrowLeft, Settings2, Eye, Upload, CheckCircle, Image, X,
} from 'lucide-react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Center, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { getProductNames, getProductDetails, uploadMeshUv } from '../api/productConfigApi';

const PBR_SLOTS = [
    { key: 'map', colorSpace: THREE.SRGBColorSpace },
    { key: 'normalMap', colorSpace: THREE.LinearSRGBColorSpace },
    { key: 'roughnessMap', colorSpace: THREE.LinearSRGBColorSpace },
    { key: 'metalnessMap', colorSpace: THREE.LinearSRGBColorSpace },
    { key: 'aoMap', colorSpace: THREE.LinearSRGBColorSpace },
];

function loadTextureFromUrl(url, colorSpace) {
    return new Promise((resolve) => {
        new THREE.TextureLoader().load(url, (tex) => {
            tex.colorSpace = colorSpace;
            tex.flipY = false;
            tex.wrapS = THREE.RepeatWrapping;
            tex.wrapT = THREE.RepeatWrapping;
            tex.needsUpdate = true;
            resolve(tex);
        }, undefined, () => resolve(null));
    });
}

/* ── 3D Model component ── */
const MeshModel = memo(({ url, configuration, onMeshesExtracted, selectedMesh }) => {
    const { scene } = useGLTF(url);
    const cloned = useMemo(() => scene.clone(true), [scene]);

    useEffect(() => {
        const rawMeshes = [];
        const nameCounts = new Map();
        let meshIndex = 0;

        cloned.traverse((child) => {
            if (!child.isMesh) return;
            meshIndex += 1;
            const name = child.name?.trim() || `Mesh ${String(meshIndex).padStart(2, '0')}`;
            rawMeshes.push({ id: `mesh-${meshIndex}`, name, ref: child });
            nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
            if (child.material) child.material = child.material.clone();
        });

        const nameIndexes = new Map();
        const meshes = rawMeshes.map((mesh) => {
            const occurrence = (nameIndexes.get(mesh.name) ?? 0) + 1;
            nameIndexes.set(mesh.name, occurrence);
            const geo = mesh.ref.geometry;
            return {
                id: mesh.id, name: mesh.name,
                label: (nameCounts.get(mesh.name) ?? 0) > 1 ? `${mesh.name} (${occurrence})` : mesh.name,
                vertices: geo?.attributes?.position?.count ?? 0,
                faces: geo?.index ? geo.index.count / 3 : (geo?.attributes?.position?.count ?? 0) / 3,
                materialName: Array.isArray(mesh.ref.material)
                    ? mesh.ref.material.map(m => m.name || 'Unnamed').join(', ')
                    : mesh.ref.material?.name || 'Standard',
                ref: mesh.ref,
            };
        });

        onMeshesExtracted(meshes);

        const applyTextures = async () => {
            for (const meshConf of (configuration?.meshes || [])) {
                const actual = meshes.find(m => m.label === meshConf.name || m.name === meshConf.name);
                if (!actual) continue;
                const firstSet = meshConf.sets?.[0];
                if (!firstSet?.maps) continue;
                const mat = actual.ref.material;
                if (!mat) continue;
                const repeat = firstSet.textureRepeat || 1;
                for (const slot of PBR_SLOTS) {
                    const texUrl = firstSet.maps[slot.key];
                    if (!texUrl) continue;
                    const tex = await loadTextureFromUrl(texUrl, slot.colorSpace);
                    if (!tex) continue;
                    tex.repeat.set(repeat, repeat);
                    mat[slot.key] = tex;
                }
                if (mat.normalMap) mat.normalScale = new THREE.Vector2(firstSet.normalIntensity || 1, firstSet.normalIntensity || 1);
                if (mat.aoMap && actual.ref.geometry.attributes.uv && !actual.ref.geometry.attributes.uv2)
                    actual.ref.geometry.setAttribute('uv2', actual.ref.geometry.attributes.uv);
                mat.side = THREE.DoubleSide;
                mat.needsUpdate = true;
            }
        };
        applyTextures();
    }, [cloned, configuration, onMeshesExtracted]);

    useEffect(() => {
        cloned.traverse((child) => {
            if (!child.isMesh || !child.material) return;
            const mat = child.material;
            if (child.name === selectedMesh) {
                mat.emissive = new THREE.Color(0x4f46e5);
                mat.emissiveIntensity = 0.3;
            } else {
                mat.emissive = new THREE.Color(0x000000);
                mat.emissiveIntensity = 0;
            }
            mat.needsUpdate = true;
        });
    }, [cloned, selectedMesh]);

    return <Center><primitive object={cloned} /></Center>;
});
MeshModel.displayName = 'MeshModel';

const ViewerLoader = () => (
    <mesh><sphereGeometry args={[0.3, 16, 16]} /><meshStandardMaterial color="#818cf8" wireframe /></mesh>
);

/* ── UV Upload slot for a single mesh ── */
const UvUploadSlot = ({ label, fieldName, currentUrl, productId, meshName, onUploaded }) => {
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(currentUrl);

    useEffect(() => { setPreviewUrl(currentUrl); }, [currentUrl]);

    const handleUpload = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setPreviewUrl(URL.createObjectURL(file));
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('productId', productId);
            fd.append('meshName', meshName);
            fd.append(fieldName, file);
            const res = await uploadMeshUv(fd);
            if (res.data?.success) onUploaded(res.data.mesh);
        } catch (err) {
            console.error('UV upload failed:', err);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{label}</span>
            {previewUrl ? (
                <div className="relative group w-full h-20 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-200">
                    <img src={previewUrl} className="w-full h-full object-contain p-1.5 opacity-80" alt={label} />
                    <label className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/40 transition-all cursor-pointer opacity-0 group-hover:opacity-100">
                        <span className="text-[10px] font-black text-white bg-violet-600 px-3 py-1 rounded-lg">
                            {uploading ? 'Uploading…' : 'Replace'}
                        </span>
                        <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
                    </label>
                    {uploading && (
                        <div className="absolute top-1 right-1">
                            <Loader2 size={14} className="animate-spin text-violet-400" />
                        </div>
                    )}
                </div>
            ) : (
                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-zinc-200 rounded-xl hover:border-violet-400 hover:bg-violet-50/30 transition-all cursor-pointer text-zinc-400 hover:text-violet-600">
                    {uploading ? (
                        <Loader2 size={18} className="animate-spin" />
                    ) : (
                        <>
                            <Upload size={16} className="mb-1" />
                            <span className="text-[9px] font-bold uppercase">Upload {label}</span>
                        </>
                    )}
                    <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
                </label>
            )}
        </div>
    );
};

/* ── ProductDetail — 3D viewer + mesh list + UV upload ── */
const ProductDetail = ({ product, onBack }) => {
    const navigate = useNavigate();
    const [glbUrl, setGlbUrl] = useState(null);
    const [configuration, setConfiguration] = useState(null);
    const [backendMeshes, setBackendMeshes] = useState([]); // meshes from DB with UV paths
    const [meshes, setMeshes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMesh, setSelectedMesh] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await getProductDetails(product.id);
                if (!res.data?.success) throw new Error('Failed to load product');
                setGlbUrl(res.data.product.base_model_url);
                setConfiguration(res.data.product.configuration);
                setBackendMeshes(res.data.product.meshes || []);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [product.id]);

    const handleMeshesExtracted = useCallback((extracted) => setMeshes(extracted), []);

    // Get backend UV data for a mesh by name
    const getBackendMesh = useCallback((meshName) => {
        return backendMeshes.find(bm => bm.meshName === meshName);
    }, [backendMeshes]);

    const handleMeshUvUploaded = useCallback((updatedMesh) => {
        setBackendMeshes(prev => {
            const idx = prev.findIndex(m => m.id === updatedMesh.id);
            if (idx >= 0) {
                const next = [...prev];
                next[idx] = updatedMesh;
                return next;
            }
            return [...prev, updatedMesh];
        });
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-[70vh] bg-white rounded-3xl border border-zinc-100">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 size={32} className="animate-spin text-violet-500" />
                    <span className="text-sm font-bold text-zinc-400">Loading 3D model…</span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded-3xl border border-zinc-100 p-12 text-center">
                <p className="text-red-500 font-bold">{error}</p>
                <button onClick={onBack} className="mt-4 text-sm text-violet-600 font-bold underline">Go back</button>
            </div>
        );
    }

    return (
        <div className="space-y-0 animate-in fade-in duration-300">
            {/* Header Bar */}
            <div className="flex items-center justify-between bg-white p-5 rounded-t-3xl border border-zinc-100 border-b-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="w-10 h-10 rounded-xl bg-zinc-50 flex items-center justify-center text-zinc-500 hover:bg-violet-50 hover:text-violet-600 transition-all active:scale-95">
                        <ArrowLeft size={18} />
                    </button>
                    <div>
                        <h2 className="text-xl font-black text-zinc-900">{product.name}</h2>
                        <p className="text-xs text-zinc-400 font-mono mt-0.5">ID: {product.id}</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {meshes.length > 0 && (
                        <span className="px-4 py-1.5 bg-violet-50 text-violet-700 text-xs font-black rounded-full">
                            {meshes.length} mesh{meshes.length !== 1 ? 'es' : ''}
                        </span>
                    )}
                    <button onClick={() => navigate(`/uvMap/${product.id}`)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 active:scale-95 transition-all">
                        <Image size={14} /> Open UV Editor
                    </button>
                    <button onClick={() => navigate(`/product-config/${product.id}`)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white rounded-xl text-xs font-black shadow-lg shadow-violet-200 hover:bg-violet-700 active:scale-95 transition-all">
                        <Settings2 size={14} /> Configure Textures
                    </button>
                </div>
            </div>

            {/* Body — viewport + mesh panel */}
            <div className="flex rounded-b-3xl border border-zinc-100 border-t-0 overflow-hidden bg-white" style={{ height: '65vh' }}>
                {/* LEFT — 3D Viewport */}
                <div className="flex-1 relative bg-gradient-to-br from-zinc-50 to-zinc-100">
                    {glbUrl && (
                        <Canvas camera={{ position: [0, 0, 4.5], fov: 45 }} gl={{ antialias: true }} dpr={[1, 1.5]} style={{ width: '100%', height: '100%' }}>
                            <ambientLight intensity={0.4} />
                            <directionalLight position={[5, 10, 5]} intensity={0.9} castShadow />
                            <Environment preset="city" background={false} />
                            <Suspense fallback={<ViewerLoader />}>
                                <MeshModel url={glbUrl} configuration={configuration} onMeshesExtracted={handleMeshesExtracted} selectedMesh={selectedMesh} />
                                <ContactShadows position={[0, -1.2, 0]} opacity={0.35} scale={10} blur={2.5} far={4} />
                            </Suspense>
                            <OrbitControls enablePan={false} minDistance={1.5} maxDistance={14} autoRotate autoRotateSpeed={0.5} makeDefault />
                        </Canvas>
                    )}
                </div>

                {/* RIGHT — Mesh List + UV Upload Panel */}
                <div className="w-[380px] flex-shrink-0 border-l border-zinc-100 flex flex-col bg-white">
                    <div className="px-5 py-4 border-b border-zinc-100 flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <Layers size={16} className="text-violet-500" />
                            <h3 className="text-sm font-black text-zinc-800">Mesh List & UV Maps</h3>
                        </div>
                        <p className="text-[10px] text-zinc-400 mt-1 font-bold uppercase tracking-widest">
                            Click a mesh to upload UV maps
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {meshes.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-zinc-300">
                                <Loader2 size={20} className="animate-spin" />
                            </div>
                        ) : (
                            <div className="divide-y divide-zinc-50">
                                {meshes.map((mesh, i) => {
                                    const isSelected = selectedMesh === mesh.name;
                                    const bm = getBackendMesh(mesh.name) || getBackendMesh(mesh.label);
                                    const hasUv = bm?.whiteMaskPath || bm?.originalSvgPath;

                                    return (
                                        <div key={mesh.id}>
                                            {/* Mesh row */}
                                            <div
                                                onClick={() => setSelectedMesh(isSelected ? null : mesh.name)}
                                                className={`px-5 py-3.5 cursor-pointer transition-all duration-200 group ${
                                                    isSelected
                                                        ? 'bg-violet-50 border-l-[3px] border-l-violet-500'
                                                        : 'hover:bg-zinc-50 border-l-[3px] border-l-transparent'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black flex-shrink-0 ${
                                                        isSelected ? 'bg-violet-200 text-violet-700' : 'bg-zinc-100 text-zinc-500'
                                                    }`}>{i + 1}</span>

                                                    <div className="flex-1 min-w-0">
                                                        <p className={`text-sm font-bold truncate ${isSelected ? 'text-violet-700' : 'text-zinc-800'}`}>
                                                            {mesh.label}
                                                        </p>
                                                        <div className="flex items-center gap-3 mt-0.5">
                                                            <span className="text-[10px] font-bold text-zinc-400">{mesh.vertices.toLocaleString()} verts</span>
                                                            <span className="text-[10px] font-bold text-zinc-400">{Math.round(mesh.faces).toLocaleString()} faces</span>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 flex-shrink-0">
                                                        {hasUv && (
                                                            <CheckCircle size={14} className="text-emerald-500" />
                                                        )}
                                                        <Eye size={14} className={isSelected ? 'text-violet-500' : 'text-zinc-300 group-hover:text-zinc-500'} />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* UV Upload panel (expanded when selected) */}
                                            {isSelected && (
                                                <div className="px-5 py-4 bg-violet-50/50 border-t border-violet-100 space-y-3">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Image size={14} className="text-violet-600" />
                                                        <span className="text-xs font-black text-violet-700">UV Map Upload</span>
                                                    </div>

                                                    <div className="grid grid-cols-2 gap-3">
                                                        <UvUploadSlot
                                                            label="White Mask"
                                                            fieldName="whiteMask"
                                                            currentUrl={bm?.whiteMaskPath || null}
                                                            productId={product.id}
                                                            meshName={mesh.name}
                                                            onUploaded={handleMeshUvUploaded}
                                                        />
                                                        <UvUploadSlot
                                                            label="Original SVG"
                                                            fieldName="originalSvg"
                                                            currentUrl={bm?.originalSvgPath || null}
                                                            productId={product.id}
                                                            meshName={mesh.name}
                                                            onUploaded={handleMeshUvUploaded}
                                                        />
                                                    </div>

                                                    <p className="text-[9px] text-zinc-400 font-medium mt-1">
                                                        Upload UV layout images for the design editor
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {meshes.length > 0 && (
                        <div className="px-5 py-3 border-t border-zinc-100 bg-zinc-50/50 flex-shrink-0">
                            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-zinc-400">
                                <span>Total: {meshes.length}</span>
                                <span>{meshes.reduce((s, m) => s + m.vertices, 0).toLocaleString()} verts</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ── Product Card ── */
const ProductCard = ({ product, onSelect, onUvOpen }) => (
    <div className="group relative bg-white rounded-3xl border border-zinc-100 p-6 hover:shadow-xl hover:shadow-zinc-200/50 hover:border-violet-100 transition-all duration-300 cursor-pointer"
        onClick={() => onSelect(product)}>
        <div className="flex flex-col h-full space-y-6">
            <div className="flex items-start justify-between">
                <div className="w-14 h-14 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition-all duration-500">
                    <Hexagon size={28} />
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-black uppercase tracking-wider">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" /> Ready
                </div>
            </div>
            <div className="space-y-2">
                <h3 className="text-xl font-black text-zinc-900 leading-tight group-hover:text-violet-600 transition-colors">{product.name}</h3>
                <div className="flex items-center gap-2 text-zinc-400">
                    <Clock size={14} />
                    <span className="text-xs font-bold font-mono tracking-tighter uppercase">ID: {product.id.slice(0, 8)}</span>
                </div>
            </div>
            <div className="pt-4 flex items-center justify-between border-t border-zinc-50 mt-auto">
                <span className="text-xs font-black text-zinc-400 uppercase tracking-widest">View Meshes</span>
                <div className="flex items-center gap-2">
                    <button onClick={(e) => { e.stopPropagation(); onUvOpen(product); }}
                        className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-black hover:bg-indigo-100 transition-all" title="Open UV Editor">
                        UV Editor
                    </button>
                    <div className="w-10 h-10 bg-zinc-50 rounded-xl flex items-center justify-center text-zinc-400 group-hover:bg-violet-50 group-hover:text-violet-600 transition-all">
                        <ChevronRight size={20} />
                    </div>
                </div>
            </div>
        </div>
    </div>
);

/* ── Main Page ── */
const MeshConfigList = () => {
    const navigate = useNavigate();
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await getProductNames();
                if (response.data.success) setProducts(response.data.products);
            } catch (error) {
                console.error('Failed to fetch products', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProducts();
    }, []);

    const filteredProducts = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));

    if (selectedProduct) {
        return (
            <div className="max-w-7xl mx-auto animate-in fade-in duration-300">
                <ProductDetail product={selectedProduct} onBack={() => setSelectedProduct(null)} />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-3xl border border-zinc-100 shadow-sm">
                <div className="space-y-1">
                    <h1 className="text-3xl font-black text-zinc-900 tracking-tight flex items-center gap-3">
                        <Layers size={28} className="text-violet-600" /> Mesh Configuration
                    </h1>
                    <p className="text-zinc-500 font-medium">Select a product to inspect meshes and upload UV maps</p>
                </div>
                <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-violet-500 transition-colors" size={20} />
                    <input type="text" placeholder="Search models..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-12 pr-6 py-3.5 bg-zinc-50 border-none rounded-2xl focus:ring-2 focus:ring-violet-500/20 w-full md:w-80 font-medium text-zinc-900 transition-all outline-none placeholder:text-zinc-400" />
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="h-48 bg-white rounded-3xl border border-zinc-100 animate-pulse" />)}
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="text-center py-24 bg-white rounded-3xl border border-zinc-100 border-dashed">
                    <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center mx-auto mb-4"><Box className="text-zinc-300" size={32} /></div>
                    <h3 className="text-xl font-bold text-zinc-900">No products found</h3>
                    <p className="text-zinc-500 mt-2">Try searching for a different product name</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map((p) => <ProductCard key={p.id} product={p} onSelect={setSelectedProduct} onUvOpen={(prod) => navigate(`/uvMap/${prod.id}`)} />)}
                </div>
            )}
        </div>
    );
};

export default MeshConfigList;
