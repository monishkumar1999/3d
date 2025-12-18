import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Plus, Edit2, Trash2, X, Save, GitMerge } from 'lucide-react';

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-100">
                    <h3 className="font-bold text-lg text-gray-800">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">{children}</div>
            </div>
        </div>
    );
};

const SubCategoryManager = () => {
    const [subCategories, setSubCategories] = useState([]);
    const [categories, setCategories] = useState([]); // Needed for dropdown
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSub, setEditingSub] = useState(null);

    // Form State
    const [name, setName] = useState("");
    const [categoryId, setCategoryId] = useState("");

    // Fetch Data
    const fetchData = async () => {
        try {
            const [subsRes, catsRes] = await Promise.all([
                api.get('/admin-subcategory'), // Check routes prefix!
                // Wait, server.js says: app.use("/admin-subcategory", subCategoryRoutes);
                // And subCategoryRoutes has router.get("/", getSubCategories);
                // So GET /admin-subcategory/ should work.
                api.get('/admin-category/view')
            ]);
            setSubCategories(subsRes.data);
            setCategories(catsRes.data.category);
        } catch (error) {
            console.error("Failed to fetch data", error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmit = async () => {
        try {
            if (editingSub) {
                // Update: router.put("/:id", updateSubCategory);
                await api.put(`/admin-subcategory/${editingSub.id}`, { name, categoryId });
            } else {
                // Create: router.post("/", createSubCategory);
                await api.post('/admin-subcategory/', { name, categoryId });
            }
            fetchData();
            handleClose();
        } catch (error) {
            console.error("Operation failed", error);
            alert("Failed to save subcategory");
        }
    };

    const handleDelete = async (id) => {
        if (confirm("Are you sure you want to delete this subcategory?")) {
            try {
                await api.delete(`/admin-subcategory/${id}`);
                fetchData();
            } catch (error) {
                console.error("Delete failed", error);
                alert("Failed to delete");
            }
        }
    };

    const openAdd = () => {
        setEditingSub(null);
        setName("");
        setCategoryId(categories[0]?.id || "");
        setIsModalOpen(true);
    };

    const openEdit = (sub) => {
        setEditingSub(sub);
        setName(sub.name);
        setCategoryId(sub.categoryId);
        setIsModalOpen(true);
    };

    const handleClose = () => {
        setIsModalOpen(false);
        setName("");
        setCategoryId("");
        setEditingSub(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Subcategories</h1>
                    <p className="text-sm text-gray-500">Manage nested categories</p>
                </div>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                >
                    <Plus size={18} />
                    Add Subcategory
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase text-gray-500 font-semibold tracking-wider">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Parent Category</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                        {subCategories.map((sub) => {
                            const parent = categories.find(c => c.id === sub.categoryId);
                            return (
                                <tr key={sub.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="p-4 font-medium text-gray-700">{sub.name}</td>
                                    <td className="p-4 text-gray-500">
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold">
                                            {parent ? parent.name : 'Unknown'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEdit(sub)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                                <Edit2 size={16} />
                                            </button>
                                            <button onClick={() => handleDelete(sub.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                        {subCategories.length === 0 && (
                            <tr>
                                <td colSpan={3} className="p-8 text-center text-gray-400">No subcategories found.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={isModalOpen} onClose={handleClose} title={editingSub ? "Edit Subcategory" : "New Subcategory"}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                            type="text"
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Crew Neck"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Parent Category</label>
                        <select
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white"
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                        >
                            <option value="" disabled>Select Category</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                    <button
                        onClick={handleSubmit}
                        className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                        disabled={!categoryId}
                    >
                        <Save size={18} />
                        Save Subcategory
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default SubCategoryManager;
