import { Download, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandalone() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    ("standalone" in window.navigator && Boolean(window.navigator.standalone))
  );
}

export default function PwaInstallButton({ compact = false }: { compact?: boolean }) {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      toast.success("Aplicativo instalado");
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function handleInstall() {
    if (installed) {
      toast.success("O app já está instalado neste dispositivo");
      return;
    }

    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        toast.success("Instalação iniciada");
      }
      setPromptEvent(null);
      return;
    }

    toast.info("No celular, abra o menu do navegador e toque em Adicionar à tela inicial.");
  }

  const Icon = compact ? Smartphone : Download;

  return (
    <button
      type="button"
      onClick={handleInstall}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 bg-card/70 text-foreground backdrop-blur transition-colors hover:border-primary/40 hover:bg-muted/70 press-down ${
        compact ? "h-9 w-9 px-0" : "h-9 px-3 text-xs font-semibold"
      }`}
      title="Instalar aplicativo"
      aria-label="Instalar aplicativo"
    >
      <Icon size={compact ? 16 : 14} />
      {!compact && <span>Instalar app</span>}
    </button>
  );
}
