"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";

import { applyTheme, currentTheme, hasExplicitTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

/**
 * Light/dark switch.
 *
 * Holds no React state for what it displays. Both icons and both labels are
 * always rendered, and the `dark:` variant — keyed to the data-theme
 * attribute the inline head script already set — decides which is shown.
 * That means the server markup and the first client render are identical, so
 * there is never a hydration mismatch or a flicker of the wrong icon, even
 * though the server has no idea which theme the visitor uses.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // Follow the OS live, but only until the person makes their own choice.
  React.useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      if (!hasExplicitTheme()) applyTheme(event.matches ? "dark" : "light", false);
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return (
    <button
      type="button"
      onClick={() =>
        applyTheme(currentTheme() === "dark" ? "light" : "dark", true)
      }
      className={cn(
        "relative flex h-10 w-10 items-center justify-center rounded-full",
        "text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink",
        "active:scale-95",
        className,
      )}
    >
      <Moon className="h-5 w-5 dark:hidden" aria-hidden="true" />
      <Sun className="hidden h-5 w-5 dark:block" aria-hidden="true" />

      {/* Only one of these is ever displayed, so exactly one is announced. */}
      <span className="sr-only dark:hidden">Switch to dark theme</span>
      <span className="sr-only hidden dark:inline">Switch to light theme</span>
    </button>
  );
}
