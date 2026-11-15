// Compile-time check for the documented SDK 0.3 PWA controls and host adapter.
import { YouGeAssistant, type PwaRuntimeLike } from '@youge/assistant-sdk';

const adapter: PwaRuntimeLike = {
  getState: () => ({ hasUpdate: false }),
  onChange: () => () => {},
  applyUpdate: () => false,
};
const assistant = YouGeAssistant.create({
  projectId: 'typecheck',
  modules: {
    installationDetection: false, installationGuidance: true,
    updateDetection: true, updateNotifications: true, autoUpdate: false,
    userUpdate: true, offlineDiagnostics: true, cacheDiagnostics: true,
    extensions: { exampleReports: false },
  },
}, { pwa: adapter, bindEvents: false });
void assistant.runOfflineDiagnostics();
void assistant.runCacheDiagnostics();
assistant.destroy();
