import type { AppProps } from "next/app";
import Head from "next/head";
import { useEffect } from "react";
import "@fontsource-variable/ibm-plex-sans";
import "../src/styles/main.css";
import { getClientApiBase } from "../src/lib/runtimeConfig";

if (
  typeof window !== "undefined" &&
  !(window as any).__soundcloudyFetchWithCredentialsPatched
) {
  const apiBase = getClientApiBase(window.location.origin);
  const originalFetch = window.fetch.bind(window) as typeof window.fetch;

  window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
    const requestUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    const shouldIncludeCredentials =
      requestUrl.startsWith("/api/") ||
      requestUrl.startsWith(`${window.location.origin}/api/`) ||
      (apiBase ? requestUrl.startsWith(`${apiBase}/api/`) : false);

    const requestInit = shouldIncludeCredentials
      ? {
          ...init,
          credentials:
            init?.credentials === "omit"
              ? init.credentials
              : ("include" as RequestCredentials),
        }
      : init;

    if (typeof input === "string" || input instanceof URL) {
      return originalFetch(input, requestInit);
    }

    return originalFetch(new Request(input, requestInit));
  } as typeof window.fetch;

  (window as any).__soundcloudyFetchWithCredentialsPatched = true;
}

export default function MyApp({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch(() => {
        // Service worker registration failed - not critical
      });
    }

    if (typeof window !== "undefined") {
      const existingDeviceId = localStorage.getItem("soundcloudy_device_id");
      if (!existingDeviceId) {
        const id = Math.random().toString(36).slice(2);
        localStorage.setItem("soundcloudy_device_id", id);
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const root = document.documentElement;
    const body = document.body;

    const updateAppMode = () => {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)")?.matches ||
        (window.navigator as Navigator & { standalone?: boolean })
          .standalone === true;

      root.classList.toggle("ios-standalone-app", Boolean(standalone));
      body.classList.toggle("ios-standalone-app", Boolean(standalone));
    };

    const updateVisibilityClass = () => {
      const hidden = document.visibilityState === "hidden";
      root.classList.toggle("app-page-hidden", hidden);
      body.classList.toggle("app-page-hidden", hidden);
    };

    updateAppMode();
    updateVisibilityClass();

    window.addEventListener("resize", updateAppMode);
    window.addEventListener("orientationchange", updateAppMode);
    document.addEventListener("visibilitychange", updateVisibilityClass);

    return () => {
      window.removeEventListener("resize", updateAppMode);
      window.removeEventListener("orientationchange", updateAppMode);
      document.removeEventListener("visibilitychange", updateVisibilityClass);
      root.classList.remove("ios-standalone-app", "app-page-hidden");
      body.classList.remove("ios-standalone-app", "app-page-hidden");
    };
  }, []);

  return (
    <>
      <Head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="Soundcloudy" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}
