"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid a hydration mismatch — reserve the exact footprint until mounted.
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className="theme-toggle theme-toggle--ssr" aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="tt-ico" data-show={!isDark} aria-hidden>
        <Sun size={18} strokeWidth={2} />
      </span>
      <span className="tt-ico" data-show={isDark} aria-hidden>
        <Moon size={18} strokeWidth={2} />
      </span>
    </button>
  );
}
