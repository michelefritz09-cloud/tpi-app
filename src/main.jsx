// Point d'entrée de ton app React

import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./App.css"; // ton CSS existant

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);