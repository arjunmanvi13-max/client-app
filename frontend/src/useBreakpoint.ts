import { useEffect, useState } from "react";
import { Dimensions, ScaledSize } from "react-native";
import { BREAKPOINTS } from "./theme";

export type Breakpoint = "mobile" | "tablet" | "desktop";

function resolve(width: number): Breakpoint {
  if (width >= BREAKPOINTS.desktop) return "desktop";
  if (width >= BREAKPOINTS.tablet) return "tablet";
  return "mobile";
}

/**
 * useBreakpoint returns the current device class and width.
 * Resizing the browser will re-render consumers.
 */
export function useBreakpoint() {
  const [size, setSize] = useState<ScaledSize>(() => Dimensions.get("window"));
  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => setSize(window));
    return () => sub?.remove?.();
  }, []);
  const bp = resolve(size.width);
  return {
    width: size.width,
    height: size.height,
    bp,
    isMobile: bp === "mobile",
    isTablet: bp === "tablet",
    isDesktop: bp === "desktop",
    isWide: bp !== "mobile",
    /** Max content width for readable tablet/desktop layouts */
    contentMaxWidth: bp === "desktop" ? 1200 : bp === "tablet" ? 960 : undefined,
    horizontalPadding: bp === "mobile" ? 16 : bp === "tablet" ? 20 : 24,
  };
}
