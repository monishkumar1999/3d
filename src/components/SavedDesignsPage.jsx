import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FolderHeart, RefreshCw, Layers, Search, Sparkles, ExternalLink } from "lucide-react";
import api from "../api/axios";

const SavedDesignsPage = () => {
  const navigate = useNavigate();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchDesigns = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/product/saved-designs-list");
      if (res.data && res.data.designs) {
        setDesigns(res.data.designs);
      }
    } catch (err) {
      console.error("Failed to fetch saved designs:", err);
      setError("Failed to load saved designs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDesigns();
  }, []);

  const handleOpenDesign = (item) => {
    if (item.productId) {
      navigate(`/uvMap/${item.productId}?designId=${item.id}`);
    }
  };

  const filteredDesigns = designs.filter(item =>
    (item.designName || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.modelName || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-zinc-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 text-indigo-600 flex items-center justify-center">
            <FolderHeart size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-zinc-900 tracking-tight">Saved Designs</h1>
            <p className="text-xs text-zinc-500 font-medium">Click any design row below to open and edit in 3D studio</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search design or model..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-xl text-xs text-zinc-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all w-64"
            />
          </div>
          <button
            onClick={fetchDesigns}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-3xl shadow-sm border border-zinc-100 overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400 gap-3">
            <RefreshCw size={28} className="animate-spin text-indigo-600" />
            <span className="text-xs font-medium">Loading saved designs list...</span>
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-500 text-sm font-medium">
            {error}
          </div>
        ) : filteredDesigns.length === 0 ? (
          <div className="text-center py-20 text-zinc-400 flex flex-col items-center gap-2">
            <Sparkles size={32} className="text-zinc-300" />
            <p className="text-base font-bold text-zinc-800">No Saved Designs Found</p>
            <p className="text-xs text-zinc-400">No custom designs match your search filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-100 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  <th className="py-4 px-6">#</th>
                  <th className="py-4 px-6">Design Name</th>
                  <th className="py-4 px-6">Model Name</th>
                  <th className="py-4 px-6">Saved Date</th>
                  <th className="py-4 px-6 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 text-xs">
                {filteredDesigns.map((item, index) => (
                  <tr
                    key={item.id}
                    onClick={() => handleOpenDesign(item)}
                    className="hover:bg-indigo-50/40 cursor-pointer transition-colors group"
                  >
                    <td className="py-4 px-6 font-semibold text-zinc-400">{index + 1}</td>
                    <td className="py-4 px-6 font-bold text-zinc-900 group-hover:text-indigo-600 transition-colors">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                        {item.designName}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-100 group-hover:bg-white text-zinc-700 font-medium border border-zinc-200/50">
                        <Layers size={13} className="text-indigo-600" />
                        {item.modelName}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-zinc-400">
                      {item.createdAt ? new Date(item.createdAt).toLocaleDateString("en-US", {
                        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                      }) : "N/A"}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDesign(item);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 group-hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-sm transition-all"
                      >
                        <span>Open</span>
                        <ExternalLink size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SavedDesignsPage;
