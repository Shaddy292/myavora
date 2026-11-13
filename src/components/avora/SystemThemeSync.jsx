import { useEffect } from "react";

// Keeps the app's `.dark` class in step with the device's system theme,
// including live changes while the app is open (WebView friendly).
export default function SystemThemeSync() {
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (isDark) => document.documentElement.classList.toggle("dark", isDark);
    apply(query.matches);
    const onChange = (event) => apply(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return null;
}