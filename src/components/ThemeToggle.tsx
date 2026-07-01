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
      className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-border/60 bg-card/60 text-foreground hover:bg-muted/60 hover:border-primary/40 transition-all press-down"
    >
      {mounted ? (
        isDark ? <Sun size={16} className="text-warning" /> : <Moon size={16} className="text-primary" />
      ) : (
        <span className="w-4 h-4" />
      )}
    </button>
  );
}
