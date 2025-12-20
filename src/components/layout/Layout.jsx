import React, { useState } from "react";
// 1. Import NavLink
import { NavLink } from "react-router-dom";
import {
  User,
  Settings,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  ShoppingBag,
  PieChart,
  Box,
  Palette,
  Layers,
  GitMerge
} from "lucide-react";

// Sidebar configuration
const SIDEBAR_ITEMS = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/" },
  { icon: Layers, label: "Categories", href: "/categories" },
  { icon: GitMerge, label: "Subcategories", href: "/subcategories" },
  { icon: ShoppingBag, label: "Product List", href: "/products" },
  { icon: Box, label: "Product Catalog", href: "/catalog" },
  { icon: Palette, label: "Customization Studio", href: "/studio" },
  { icon: Settings, label: "UvMap", href: "/uvMap" },
];

const Sidebar = ({ isOpen, toggleSidebar }) => {
  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-black/50 transition-opacity lg:hidden ${isOpen ? "opacity-100 visible" : "opacity-0 invisible"
          }`}
        onClick={toggleSidebar}
      ></div>

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-auto ${isOpen ? "translate-x-0" : "-translate-x-full"
          }`}
      >
        <div className="flex items-center justify-between h-16 px-6 bg-slate-950 border-b border-slate-800">
          <span className="text-xl font-bold tracking-wider text-white">
            NEXUS<span className="text-indigo-500">app</span>
          </span>
          <button onClick={toggleSidebar} className="lg:hidden text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {SIDEBAR_ITEMS.map((item, index) => (
            // 2. Use NavLink instead of <a>
            <NavLink
              key={index}
              to={item.href}
              onClick={() => window.innerWidth < 1024 && toggleSidebar()} // Close sidebar on mobile click
              className={({ isActive }) =>
                `flex items-center px-4 py-3 transition-all duration-200 rounded-lg group ${isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-900/20" // Active Style
                  : "text-slate-300 hover:bg-slate-800 hover:text-white"      // Inactive Style
                }`
              }
            >
              <item.icon size={20} className="mr-3 transition-transform group-hover:scale-110" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button className="flex items-center w-full px-4 py-2 text-sm font-medium text-slate-400 transition-colors rounded-lg hover:text-white hover:bg-slate-800">
            <LogOut size={18} className="mr-3" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
};

const Header = ({ toggleSidebar }) => {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-6 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center">
        <button
          onClick={toggleSidebar}
          className="p-2 mr-4 text-gray-600 rounded-md lg:hidden hover:bg-gray-100 focus:outline-none"
        >
          <Menu size={24} />
        </button>
        <h2 className="text-lg font-semibold text-gray-800">Overview</h2>
      </div>
      <div className="flex items-center space-x-4">
        <div className="hidden md:block text-right">
          <p className="text-sm font-medium text-gray-700">John Doe</p>
          <p className="text-xs text-gray-500">Admin</p>
        </div>
        <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold">
          J
        </div>
      </div>
    </header>
  );
};

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const toggleSidebar = () => setSidebarOpen(!sidebarOpen);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 font-sans text-gray-900">
      <Sidebar isOpen={sidebarOpen} toggleSidebar={toggleSidebar} />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Header toggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;