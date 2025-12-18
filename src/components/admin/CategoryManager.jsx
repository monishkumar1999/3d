import React, { useState, useEffect } from 'react';
import api from '../../api/axios';
import { Plus, Edit2, Trash2, X, Save } from 'lucide-react';

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

const CategoryManager = () => {
    const [categories, setCategories] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [categoryName, setCategoryName] = useState("");

    // Fetch Categories
    const fetchCategories = async () => {
        try {
            const response = await api.get('/admin-category/view');
            setCategories(response.data.category);
        } catch (error) {
            console.error("Failed to fetch categories", error);
        }
    };

    useEffect(() => {
        fetchCategories();
    }, []);

    // Create / Update
    const handleSubmit = async () => {
        try {
            if (editingCategory) {
                // Update
                await api.put('/category/edit', { id: editingCategory.id, name: categoryName });
            } else {
                // Create
                await api.post('/category/create', { name: categoryName });
            }
            fetchCategories();
            handleClose();
        } catch (error) {
            console.error("Operation failed", error);
            alert("Failed to save category");
        }
    };

    // Delete (If supported, else remove button)
    // Assuming delete might not be exposed easily or soft delete.
    // Making a guess on route or omitting if unsafe.
    // User asked for "delete option needed".
    // I'll assume DELETE /category/:id or similar, but looking at routes:
    // router.put('/edit',authMiddleware,editCategory);
    // router.post('/create',authMiddleware,createCategory);
    // router.get('/view',authMiddleware,viewCategory);
    // NO DELETE ROUTE VISIBLE in categoryRoute.js I viewed earlier!
    // I will add the UI but disable it or note it.
    // Wait, SubCategory has delete. Category routes checked earlier didn't show delete.
    // I will skip Delete for Category for now or mock it to avoid crash until confirmed.
    // Re-checking categoryRoute.js from context:
    // router.get('/view',authMiddleware,viewCategory);
    // router.post('/create',authMiddleware,createCategory);
    // router.put('/edit',authMiddleware,editCategory);
    // confirm: NO DELETE.

    const handleDelete = async (id) => {
        if (confirm("Delete feature not enabled on server for Categories yet.")) {
            // Logic would go here
        }
    };

    const openAdd = () => {
        setEditingCategory(null);
        setCategoryName("");
        setIsModalOpen(true);
    };

    const openEdit = (cat) => {
        setEditingCategory(cat);
        setCategoryName(cat.name);
        setIsModalOpen(true);
    };

    const handleClose = () => {
        setIsModalOpen(false);
        setCategoryName("");
        setEditingCategory(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
                    <p className="text-sm text-gray-500">Manage top-level product categories</p>
                </div>
                <button
                    onClick={openAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-600/20"
                >
                    <Plus size={18} />
                    Add Category
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories?.map((cat) => (
                    <div key={cat.id} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center group hover:shadow-md transition-all">
                        <span className="font-semibold text-gray-700">{cat.name}</span>
                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(cat)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg">
                                <Edit2 size={16} />
                            </button>
                            {/* Delete disabled as per route check */}
                            {/* <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                <Trash2 size={16} />
                            </button> */}
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={isModalOpen} onClose={handleClose} title={editingCategory ? "Edit Category" : "New Category"}>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input
                            type="text"
                            className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            value={categoryName}
                            onChange={(e) => setCategoryName(e.target.value)}
                            placeholder="e.g., T-Shirts"
                            autoFocus
                        />
                    </div>
                    <button
                        onClick={handleSubmit}
                        className="w-full py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                    >
                        <Save size={18} />
                        Save Category
                    </button>
                </div>
            </Modal>
        </div>
    );
};

export default CategoryManager;
