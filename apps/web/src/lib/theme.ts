/** The site's theme (D133): kept in this browser. */
export type Theme = "light" | "dark" | "system";

export const THEME_KEY = "lfs-theme";

export function isTheme(value: unknown): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

/** Whether a theme shows dark, given whether the computer prefers dark. */
export function isDark(theme: Theme, systemDark: boolean): boolean {
  return theme === "dark" || (theme === "system" && systemDark);
}

/**
 * Runs before the page draws (inlined in the root layout): sets the "dark"
 * class from the saved choice, and follows the computer while on System.
 */
export const THEME_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_KEY)};var m=window.matchMedia("(prefers-color-scheme: dark)");var apply=function(){var t=localStorage.getItem(k);if(t!=="light"&&t!=="dark")t="system";document.documentElement.classList.toggle("dark",t==="dark"||(t==="system"&&m.matches));};apply();m.addEventListener("change",apply);window.addEventListener("storage",function(e){if(e.key===k)apply();});}catch(e){}})();`;
