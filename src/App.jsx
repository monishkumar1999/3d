import React from "react";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./route/AppRoutes";

function App() {
  return (
    <BrowserRouter>
      {/* AppRoutes handles whether or not the Layout is shown */}
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;