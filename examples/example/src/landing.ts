import { YouGeAssistant } from "@youge/assistant-sdk";
import {
  applyLandingStaticTranslations,
  buildLocaleOptions,
  resolveExampleLocale,
  syncExampleLocale,
  tExample,
} from "./i18n.js";
import "./landing.css";

let currentLocale = resolveExampleLocale();

const copy = document.querySelector<HTMLButtonElement>("[data-copy-install]");
if (copy && navigator.clipboard) {
  copy.hidden = false;
  copy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText("npm install @youge/assistant-sdk");
      copy.textContent = tExample(currentLocale, "copied");
    } catch {
      copy.textContent = tExample(currentLocale, "copySelect");
    }
    window.setTimeout(() => {
      copy.textContent = tExample(currentLocale, "copy");
    }, 2200);
  });
}

// Deferred classic scripts initialize the configured singleton first.
function connectDemo() {
  const assistant = YouGeAssistant.attach();
  const put = (id: string, value: string) => {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  };
  const render = () => {
    const state = assistant.getState();
    currentLocale = resolveExampleLocale(state.locale);
    applyLandingStaticTranslations(currentLocale);
    put("live-project", state.project.name);
    put(
      "live-connectivity",
      state.network.online ? tExample(currentLocale, "online") : tExample(currentLocale, "offline"),
    );
    put("live-notices", String(state.badge.count));
    put("live-theme", state.appearance.theme);
    const themeLabel = document.getElementById("demo-theme-label");
    if (themeLabel) themeLabel.textContent = tExample(currentLocale, "appearanceLabel");
    const langLabel = document.getElementById("demo-language-label");
    if (langLabel) langLabel.textContent = tExample(currentLocale, "languageLabel");
    if (addNoticeBtn) addNoticeBtn.textContent = tExample(currentLocale, "addTestNotice");
    if (clearNoticesBtn) clearNoticesBtn.textContent = tExample(currentLocale, "clearNotices");
  };

  // --- Badge / Notice Controls ---
  const addNoticeBtn = document.createElement("button");
  addNoticeBtn.type = "button";
  addNoticeBtn.className = "secondary-button";
  addNoticeBtn.textContent = tExample(currentLocale, "addTestNotice");
  addNoticeBtn.style.margin = "4px 0";
  addNoticeBtn.addEventListener("click", () => {
    assistant.configure({
      features: [
        {
          id: "demo-test",
          label: tExample(currentLocale, "demoNoticeLabel"),
          message: tExample(currentLocale, "demoNoticeMessage"),
        },
      ],
    });
    put("demo-feedback", tExample(currentLocale, "feedbackAdded"));
  });
  const controls = document.querySelector(".live-panel");
  if (controls) controls.appendChild(addNoticeBtn);

  const clearNoticesBtn = document.createElement("button");
  clearNoticesBtn.type = "button";
  clearNoticesBtn.className = "secondary-button";
  clearNoticesBtn.textContent = tExample(currentLocale, "clearNotices");
  clearNoticesBtn.style.margin = "4px 0";
  clearNoticesBtn.addEventListener("click", () => {
    const state = assistant.getState();
    let success = 0;
    let failed = 0;
    state.notifications.forEach((n) => {
      if (assistant.dismiss(n.id)) {
        success++;
      } else {
        failed++;
      }
    });
    if (failed > 0) {
      put("demo-feedback", tExample(currentLocale, "feedbackClearedMixed", { success, failed }));
    } else {
      put("demo-feedback", tExample(currentLocale, "feedbackCleared", { success }));
    }
  });
  if (controls) controls.appendChild(clearNoticesBtn);

  const langSelect = document.querySelector<HTMLSelectElement>("#demo-language");
  const refreshLanguageOptions = (locale: string, configuredLocale?: unknown) => {
    if (!langSelect) return;
    const active = resolveExampleLocale(locale);
    const targetConfigured =
      typeof configuredLocale === "string"
        ? configuredLocale
        : assistant.getConfig().locale;
    const desiredVal = targetConfigured === "auto" ? "auto" : active;
    const options = buildLocaleOptions(active);
    langSelect.textContent = "";
    options.forEach((opt) => {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.label;
      langSelect.appendChild(el);
    });
    const exists = options.some((o) => o.value === desiredVal);
    langSelect.value = exists ? desiredVal : active;
  };
  if (langSelect) {
    refreshLanguageOptions(assistant.getLocale());
    langSelect.addEventListener("change", () => {
      const selected = langSelect.value;
      syncExampleLocale(selected, assistant);
      refreshLanguageOptions(assistant.getLocale(), selected);
      render();
      put(
        "demo-feedback",
        tExample(resolveExampleLocale(assistant.getLocale()), "feedbackLanguageChanged", {
          locale: assistant.getLocale(),
        }),
      );
    });
  }

  render();
  let unsubscribe = assistant.subscribe(render);
  const theme = document.querySelector<HTMLSelectElement>("#demo-theme");
  if (theme) {
    theme.disabled = false;
    theme.addEventListener("change", () => {
      if (
        theme.value === "light" ||
        theme.value === "dark" ||
        theme.value === "auto"
      ) {
        assistant.configure({ theme: theme.value });
        put("demo-feedback", tExample(currentLocale, "feedbackChanged", { theme: theme.value }));
      }
    });
  }

  window.addEventListener("youge:locale-change", (event) => {
    const detail = (event as CustomEvent<{ configuredLocale?: string }>).detail;
    render();
    refreshLanguageOptions(assistant.getLocale(), detail?.configuredLocale);
  });
  window.addEventListener("pagehide", () => unsubscribe());
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
      unsubscribe = assistant.subscribe(render);
      render();
    }
  });
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", connectDemo, { once: true });
else connectDemo();

if (navigator.clipboard) {
  for (const block of document.querySelectorAll<HTMLElement>(".code-block")) {
    const code = block.querySelector("code");
    const header = block.querySelector(".code-header");
    if (!code || !header) continue;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "copy-code";
    button.textContent = tExample(currentLocale, "copy");
    button.setAttribute("aria-label", tExample(currentLocale, "copyCodeAria"));
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent || "");
        button.textContent = tExample(currentLocale, "copied");
      } catch {
        button.textContent = tExample(currentLocale, "copyCodeSelect");
      }
      window.setTimeout(() => {
        button.textContent = tExample(currentLocale, "copy");
      }, 2200);
    });
    header.append(button);
  }
}
