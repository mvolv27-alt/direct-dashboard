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
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-2xs transition-colors hover:border-primary/40 hover:bg-muted press-down"
    >
      {mounted ? (
        isDark ? <Sun size={16} className="text-warning" /> : <Moon size={16} className="text-primary" />
      ) : (
        <span className="w-4 h-4" />
      )}
    </button>
  );
}
