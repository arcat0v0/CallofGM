import { useEffect, useState } from "react";
import type { PlayViewport } from "@cogm/theme-sdk";

function readViewport(): PlayViewport {
  if (typeof window === "undefined") {
    return "desktop";
  }
  if (window.matchMedia("(min-width: 1024px)").matches) {
    return "desktop";
  }
  if (window.matchMedia("(orientation: landscape)").matches) {
    return "landscape";
  }
  return "portrait";
}

export function usePlayViewport(): PlayViewport {
  const [viewport, setViewport] = useState<PlayViewport>(readViewport);

  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const landscape = window.matchMedia("(orientation: landscape)");
    const update = () => setViewport(readViewport());
    wide.addEventListener("change", update);
    landscape.addEventListener("change", update);
    return () => {
      wide.removeEventListener("change", update);
      landscape.removeEventListener("change", update);
    };
  }, []);

  return viewport;
}