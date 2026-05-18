import React from "react";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./route/AppRoutes";
import LoaderModal from "./components/loader/LoaderModal";

function App() {
  return (
    <BrowserRouter>
      {/* AppRoutes handles whether or not the Layout is shown */}
      <AppRoutes />
      <LoaderModal />
    </BrowserRouter>
  );
}

export default App;