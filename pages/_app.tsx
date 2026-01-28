import type { AppProps } from "next/app";
import { useEffect } from "react";
import "../src/styles/main.css";

export default function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {
        // Service worker registration failed - not critical
      });
    }
  }, []);

  return <Component {...pageProps} />;
}
