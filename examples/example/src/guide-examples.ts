// Displayed verbatim on the landing page. Also compiled by `npm run typecheck`.
import { YouGeAssistant } from "@youge/assistant-sdk";

export function basicIntegration() {
  const assistant = YouGeAssistant.create({
    project: { id: "my-web-app" },
    theme: "auto",
    position: "bottom-right",
    branding: { name: "My web app", themeColor: "#6942d6" },
    modules: {
      installation: true,
      diagnostics: true,
      updates: true,
      autoUpdate: false,
      userUpdate: true,
    },
  });

  const unsubscribe = assistant.subscribe((state) => {
    console.log("Assistant notices:", state.badge.count);
  });

  // Call when this isolated integration unmounts.
  return () => {
    unsubscribe();
    assistant.destroy();
  };
}

export function updateConfiguration() {
  // Use attach() when sharing state with the classic toolkit/widget.
  const assistant = YouGeAssistant.attach();
  assistant.configure({
    theme: "dark",
    modules: {
      ...assistant.getConfig().modules,
      updateNotifications: false,
      cacheDiagnostics: false,
    },
  });
}

export function existingApplication() {
  const assistant = YouGeAssistant.attach();
  // Feed results from YOUR host's health/auth logic; the SDK doesn't fetch them.
  assistant.setEndpointStatus({ primary: "healthy", backup: "inactive" });
  assistant.setSessionStatus({ state: "ok" });
  const unsubscribe = assistant.subscribe((state) => {
    document
      .querySelector("[data-assistant-status]")
      ?.setAttribute("aria-label", state.badge.label);
  });
  return unsubscribe; // Remove this view's subscription on unmount.
}

export function disableAssistant() {
  const assistant = YouGeAssistant.attach();
  assistant.configure({ enabled: false });
  // Host worker, caches and host update lifecycle are unchanged.
  // Re-enable with assistant.configure({ enabled: true }).
  // Only the application owner should destroy a shared singleton at teardown.
}
