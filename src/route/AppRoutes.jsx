import React from "react";
import { Routes, Route, Navigate, Outlet } from "react-router-dom";
import Layout from "../components/layout/Layout"; // <--- Import Layout here

// --- Import your components ---
import { Logins } from "../components/auth/Logins"; 
import ModularStudio from "../3d/ModularStudio";
import ProTShirtStudio from "../3d/ProTShirtStudio";

// --- Dummy Components for Demo ---
const Dashboard = () => <h1 className="text-2xl font-bold">Dashboard Page</h1>;
const Orders = () => <h1 className="text-2xl font-bold">Orders Page</h1>;
const Customers = () => <h1 className="text-2xl font-bold">Customers Page</h1>;
const Analytics = () => <h1 className="text-2xl font-bold">Analytics Page</h1>;
const Settings = () => <h1 className="text-2xl font-bold">Settings Page</h1>;
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
      {/* 1. Standalone Routes (NO Layout)
        These routes will be full-width, like Logins. 
      */}
      <Route path="/Logins" element={<Logins />} />
      
      {/* 2. Routes WITH Layout (Nested Routes)
        The parent route uses the Layout component, and its child routes 
        render *inside* the <Layout> via the <Outlet /> in ProtectedRoutesWithLayout.
      */}
      <Route element={<ProtectedRoutesWithLayout />}>
        {/* Redirect root path to admin/dashboard for logged-in users */}
        <Route path="/" element={<Navigate to="/admin" replace />} /> 

        <Route path="/admin" element={<ProTShirtStudio />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      {/* Catch-all route for 404 */}
      <Route path="*" element={<h1 className="text-2xl font-bold text-red-500">404 - Page Not Found</h1>} />
    </Routes>
  );
};

export default AppRoutes;