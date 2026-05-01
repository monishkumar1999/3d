import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import Layout from "../components/layout/Layout"; // <--- Import Layout here
import UvMap from "../3d/UvMap";
import { Logins } from "../components/auth/Logins";
import CategoryManager from "../components/admin/CategoryManager";
import SubCategoryManager from "../components/admin/SubCategoryManager";
import ProductList from "../components/products/ProductList";
import ProductEditor from "../components/products/ProductEditor";
import TestUVWorkflow from "../3d/components/TestUVWorkflow";
import MainTestComponent from "../3d/components/mainTestCOmponent";
import SvgConverter from "../components/SvgConverter";
import GlbMeshInspector from "../product_config/GlbMeshInspector";
import ProductConfigList from "../product_config/ProductConfigList";
import MeshConfigList from "../product_config/MeshConfigList";

// ----------------------------------

// This component acts as a wrapper for all routes that need the Layout
const ProtectedRoutesWithLayout = () => (
  <Layout>
    <Outlet /> {/* Renders the nested child route's element */}
  </Layout>
);

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/login" element={<Logins />} />
      <Route element={<ProtectedRoutesWithLayout />}>
        {/* Redirect root path to catalog for logged-in users */}
        <Route path="/test-uv" element={<TestUVWorkflow />} />
        <Route path="/mainTest" element={<MainTestComponent />} />

        <Route path="/categories" element={<CategoryManager />} />
        <Route path="/subcategories" element={<SubCategoryManager />} />
        <Route path="/products" element={<ProductList />} />
        <Route path="/product/edit/:id" element={<ProductEditor />} />
        <Route path="/uvMap/:productId" element={<UvMap />} />
        <Route path="/uvMap" element={<UvMap />} />
        <Route path="/svg-converter" element={<SvgConverter />} />
        <Route path="/product-config/:productId" element={<GlbMeshInspector />} />
        <Route path="/product-config" element={<GlbMeshInspector />} />
        <Route path="/product-config-list" element={<ProductConfigList />} />
        <Route path="/mesh-config" element={<MeshConfigList />} />

      </Route>

      {/* Catch-all route for 404 */}
      <Route path="*" element={<h1 className="text-2xl font-bold text-red-500">404 - Page Not Found</h1>} />
    </Routes>
  );
};

export default AppRoutes;