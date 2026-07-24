import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:rounded-2xl group-[.toaster]:border-white/55 group-[.toaster]:bg-card/88 group-[.toaster]:text-foreground group-[.toaster]:shadow-xl group-[.toaster]:backdrop-blur-2xl dark:group-[.toaster]:border-white/14",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:rounded-xl group-[.toast]:bg-primary group-[.toast]:font-bold group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:rounded-xl group-[.toast]:bg-muted group-[.toast]:font-bold group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
