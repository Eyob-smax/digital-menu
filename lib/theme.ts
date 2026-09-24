/**
 * Light and dark theme.
 *
 * The theme lives on `<html data-theme="light|dark">`. On a first visit it
 * follows the operating system; once someone taps the toggle, their choice is
 * remembered and wins over the system from then on.
 *
 * The hard part is avoiding a flash of the wrong theme. React renders on the
 * server, which cannot know the visitor's choice, so a dark-mode visitor
 * would see a white page for a moment before hydration corrected it. The fix
 * is `THEME_SCRIPT` below: a few lines inlined into <head> that run
 * synchronously before the first paint, before any React code loads.
 */

export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "dm-theme";

/** Browser chrome colour per theme — matches each theme's surface-0. */
export const THEME_COLOR: Record<Theme, string> = {
  light: "#fefdfb",
  dark: "#130d09",
};

/**
 * Inlined into <head> by app/layout.tsx. Kept dependency-free and wrapped in
 * try/catch: it runs before everything else, so if it threw it would take the
 * whole page down, and localStorage throws in some private-browsing modes.
 */
export const THEME_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)},c=${JSON.stringify(THEME_COLOR)};
var s=null;try{s=localStorage.getItem(k)}catch(e){}
var t=(s==="light"||s==="dark")?s:(window.matchMedia&&matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");
var d=document.documentElement;d.setAttribute("data-theme",t);d.style.colorScheme=t;
var m=document.querySelectorAll('meta[name="theme-color"]');for(var i=0;i<m.length;i++)m[i].setAttribute("content",c[t]);
}catch(e){}})();`;

/** Reads the theme the inline script already applied. */
export function currentTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

/** True once the person has picked a theme, rather than inheriting the OS. */
export function hasExplicitTheme(): boolean {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark";
  } catch {
    return false;
  }
}

export function applyTheme(theme: Theme, persist: boolean): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    meta.setAttribute("content", THEME_COLOR[theme]);
  }

  if (persist) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage blocked: the theme still applies for this visit.
    }
  }
}
