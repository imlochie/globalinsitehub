import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type InstallInstructions = {
  heading: string;
  steps: string[];
};

export function PwaInstallControl({
  isSectorPreview,
}: {
  isSectorPreview: boolean;
}) {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(
    null,
  );
  const [isInstalled, setIsInstalled] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const standaloneDisplay =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone =
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsInstalled(standaloneDisplay || iosStandalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      const promptEvent = event as InstallPromptEvent;
      if (typeof promptEvent.prompt !== "function") return;
      event.preventDefault();
      setInstallPrompt(promptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setHelpOpen(false);
    };

    window.addEventListener(
      "beforeinstallprompt",
      handleBeforeInstallPrompt,
    );
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const instructions = getInstallInstructions();

  async function handleInstall() {
    if (!import.meta.env.PROD) {
      setHelpOpen(true);
      return;
    }

    if (!installPrompt) {
      setHelpOpen(true);
      return;
    }

    const promptEvent = installPrompt;
    setInstallPrompt(null);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
      } else {
        setHelpOpen(true);
      }
    } catch {
      setHelpOpen(true);
    }
  }

  return (
    <>
      <button
        type="button"
        data-testid="button-install-app"
        aria-label="Install Signalwatch"
        title="Install Signalwatch"
        onClick={() => void handleInstall()}
        className={`inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-md border px-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9 sm:w-auto sm:px-2.5 ${
          isSectorPreview
            ? "border-cyan-200/20 text-cyan-100 hover:bg-white/5"
            : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
      >
        <Download className="size-4" aria-hidden="true" />
        <span className="hidden text-xs font-medium sm:inline">Install</span>
      </button>

      <Dialog open={helpOpen} onOpenChange={setHelpOpen}>
        <DialogContent
          className={
            isSectorPreview
              ? "border-white/10 bg-[#0d131d] text-slate-100"
              : undefined
          }
        >
          <DialogHeader>
            <DialogTitle>Install Signalwatch</DialogTitle>
            <DialogDescription
              className={isSectorPreview ? "text-slate-400" : undefined}
            >
              Add the existing Signalwatch app to your device. Installation
              keeps the same live services; it does not make provider data
              available offline.
            </DialogDescription>
          </DialogHeader>
          {!import.meta.env.PROD && (
            <p
              role="note"
              className={`rounded-lg border px-3 py-2 text-xs leading-5 ${
                isSectorPreview
                  ? "border-amber-200/15 bg-amber-300/10 text-amber-100"
                  : "border-amber-300/30 bg-amber-50 text-amber-950"
              }`}
            >
              This development preview does not register the production service
              worker. Install from the deployed HTTPS app to get the cached
              app shell and offline notice behavior.
            </p>
          )}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">{instructions.heading}</h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
              {instructions.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function getInstallInstructions(): InstallInstructions {
  const userAgent = navigator.userAgent;
  const isIOS =
    /iPhone|iPad|iPod/i.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  if (isIOS) {
    return {
      heading: "On iPhone or iPad",
      steps: [
        "Open this page in Safari, not inside another app.",
        "Tap the Share button.",
        "Choose Add to Home Screen, then tap Add.",
      ],
    };
  }

  if (/Edg\//i.test(userAgent)) {
    return {
      heading: "In Microsoft Edge",
      steps: [
        "Select the install icon in the address bar if it appears.",
        "Otherwise open Settings and more, then Apps, then Install this site as an app.",
      ],
    };
  }

  if (/Chrome|Chromium/i.test(userAgent)) {
    return {
      heading: "In Chrome",
      steps: [
        "Select the install icon in the address bar if it appears.",
        "Otherwise open the browser menu and choose Install Signalwatch or Install page as app.",
      ],
    };
  }

  return {
    heading: "Use a supported browser",
    steps: [
      "On iPhone or iPad, open this page in Safari, tap Share, then Add to Home Screen.",
      "On Windows, open this page in Microsoft Edge or Chrome and choose Install from the browser menu.",
    ],
  };
}