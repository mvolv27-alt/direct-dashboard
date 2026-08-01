import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const current = (theme === "system" ? resolvedTheme : theme) ?? "dark";
  const isDark = current === "dark";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Mudar para tema claro" : "Mudar para tema escuro"}
      title={isDark ? "Tema claro" : "Tema escuro"}
      className="relative inline-flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-border/80 bg-card/90 text-foreground shadow-2xs backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary-glow/45 hover:bg-card hover:shadow-[0_6px_16px_hsl(var(--primary)/0.16)] dark:border-white/12 press-down"
    >
      {mounted ? (
        isDark ? <Sun size={16} className="text-warning" /> : <Moon size={16} className="text-primary" />
      ) : (
        <span className="w-4 h-4" />
      )}
    </button>
  );
}
