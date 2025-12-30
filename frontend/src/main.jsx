// /frontend/src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import { AudioPlayerProvider } from './AudioPlayerContext';
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")).render(
    <AudioPlayerProvider>
            <App />
    </AudioPlayerProvider>
   );
