import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

if (import.meta.env.PROD && "serviceWorker" in navigator && window.location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* PWA remains usable without offline cache. */
    });
  });
} else if (import.meta.env.DEV && "serviceWorker" in navigator) {
  void navigator.serviceWorker.getRegistrations().then((registrations) =>
    Promise.all(registrations.map((registration) => registration.unregister())),
  );
  if ("caches" in window) {
    void caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith("direct-promocoes-")).map((key) => caches.delete(key))),
    );
  }
}
