import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./styles.css";

window.__LIGHT_SYSTEM_REACT_SPA_READY__ = false;
createRoot(document.getElementById("root")!).render(<App />);
window.__LIGHT_SYSTEM_REACT_SPA_READY__ = true;
