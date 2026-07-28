import { createRoot } from "react-dom/client";
import { App } from "./app";
import { NoumiErrorBoundary } from "./noumi-error-boundary";
import "./styles.css";

window.__LIGHT_SYSTEM_REACT_SPA_READY__ = false;
createRoot(document.getElementById("root")!).render(
	<NoumiErrorBoundary>
		<App />
	</NoumiErrorBoundary>,
);
window.__LIGHT_SYSTEM_REACT_SPA_READY__ = true;
