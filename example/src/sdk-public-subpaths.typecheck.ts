// Compile-only consumer fixture: this file is included by example/tsconfig.json
// and imports through the package's real `exports` map (not relative source paths).
import {
  YouGeAssistant,
  type AssistantState,
  type UpdateApplyOutcome,
} from '@youge/assistant-sdk';
import {
  resolveDomain,
  type DomainRegistry,
} from '@youge/assistant-sdk/domain';
import {
  resolveAssistantConfig,
  type AssistantConfigInput,
} from '@youge/assistant-sdk/config';
import {
  normalizeDnsResult,
  type DnsDiagnosticSnapshot,
} from '@youge/assistant-sdk/diagnostics';
import {
  deriveInstallationState,
  requestPwaInstall,
  requestPwaUpdate,
  type AssistantUpdateResult,
} from '@youge/assistant-sdk/installation';
import {
  detectInAppBrowser,
  type InAppBrowserDetection,
} from '@youge/assistant-sdk/browser';
import {
  resolveTheme,
  type ResolvedTheme,
} from '@youge/assistant-sdk/theme';
import {
  createReactAdapter,
  createUseAssistant,
  type UseSyncExternalStoreFn,
} from '@youge/assistant-sdk/react';
import sdkPackage from '@youge/assistant-sdk/package.json';

const packageName: string = sdkPackage.name;
const config: AssistantConfigInput = {
  projectId: 'public-subpath-typecheck',
  modules: { updates: false },
};
const registry: DomainRegistry = { 'example.test': { project: { id: 'typecheck' } } };
const assistantForDocs = YouGeAssistant.create({
  project: { id: 'customer-portal' },
  position: 'bottom-right',
  modules: { diagnostics: true, updates: true },
});
const state: AssistantState | null = assistantForDocs.getState();
const unsubscribe = assistantForDocs.subscribe((snapshot) => {
  console.log(snapshot.badge.label, snapshot.network.updateAvailable);
});
const diagnosticsResult = assistantForDocs.runDiagnostics({ signal: new AbortController().signal });
const disposeAssistant = () => { unsubscribe(); assistantForDocs.destroy(); };
const dns: DnsDiagnosticSnapshot = normalizeDnsResult({ cancelled: true });
const resolved = resolveAssistantConfig(config).config;
const domain = resolveDomain('https://example.test/', registry);
const browser: InAppBrowserDetection = detectInAppBrowser('');
const theme: ResolvedTheme = resolveTheme('auto');
const storeHook: UseSyncExternalStoreFn = <Snapshot>(
  _subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
): Snapshot => getSnapshot();
const react = createReactAdapter({ useSyncExternalStore: storeHook });
const useAssistant = createUseAssistant(storeHook, () => YouGeAssistant.create(config));
const selectedBadge = useAssistant((snapshot) => snapshot.badge);
const pwa = null;
const installState = deriveInstallationState({ pwa });
const installResult = requestPwaInstall({ pwa });
const outcome: Promise<AssistantUpdateResult> = requestPwaUpdate({ pwa });
const updateOutcome: Promise<UpdateApplyOutcome> = outcome.then((result) => result.outcome);
const integrationState: AssistantState = YouGeAssistant.create({
  ...config,
  services: { diagnostics: async () => ({ status: 'complete', classification: 'normal_connectivity' }) },
}).getState();

void [packageName, state, diagnosticsResult, disposeAssistant, dns, resolved, domain, browser, theme, react, selectedBadge, installState, installResult, updateOutcome, integrationState];
