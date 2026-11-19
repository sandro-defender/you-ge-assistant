export type InAppBrowserName = 'facebook' | 'messenger' | 'instagram' | 'webview' | 'none';

export interface InAppBrowserDetection {
  /** The user agent that was classified ('' when unavailable). */
  ua: string;
  android: boolean;
  ios: boolean;
  /** A known in-app webview (Facebook, Messenger, Instagram or Android WebView). */
  inApp: boolean;
  /** The in-app browser is known to be unsupported/restricted for this flow. */
  restricted: boolean;
  /** No usable user agent was provided — never a handoff candidate. */
  uncertain: boolean;
  browser: InAppBrowserName;
}

export interface ChromeIntentOptions {
  /** Android package that should receive the intent. Defaults to Chrome. */
  packageName?: string;
}

export interface ChromeHandoffLabels {
  locale?: string;
  title?: string;
  intro?: string;
  stepCopy?: string;
  stepSwitch?: string;
  stepPaste?: string;
  openLabel?: string;
  dismissLabel?: string;
  copyLabel?: string;
  copiedLabel?: string;
}

export interface ChromeHandoffInstructions {
  title: string;
  intro: string;
  steps: readonly string[];
  /** The original URL, including pathname, query string and hash. */
  url: string;
  openLabel: string;
  dismissLabel: string;
  copyLabel: string;
  copiedLabel: string;
}

export interface ChromeHandoffOpenResult {
  /**
   * 'attempted' — the intent URL was handed to the runtime;
   * 'failed'    — the attempt threw or could not run (manual fallback fired);
   * 'unsupported' — detection is not a confident candidate; nothing navigated.
   */
  status: 'attempted' | 'failed' | 'unsupported';
  intentUrl: string | null;
  instructions: ChromeHandoffInstructions;
}

export interface ChromeHandoffEnvironment {
  userAgent?: string;
  location?: { href?: string; assign?: (url: string) => void } | null;
  document?: { visibilityState?: string } | null;
  assign?: (url: string) => void;
  setTimeout?: (fn: () => void, ms: number) => unknown;
  clearTimeout?: (id: unknown) => void;
  fallbackDelayMs?: number;
  packageName?: string;
  locale?: string;
  labels?: ChromeHandoffLabels;
}

export interface ChromeHandoffController {
  detection: InAppBrowserDetection;
  /** True only for a confident Android restricted in-app browser. */
  shouldOffer(): boolean;
  intentUrl(url?: string): string | null;
  instructions(url?: string): ChromeHandoffInstructions;
  /**
   * Best-effort handoff. Never navigates for unsupported/uncertain
   * detections. `onFallback` receives manual instructions when the attempt
   * fails immediately or when the page is still visible after the delay.
   */
  open(url?: string, onFallback?: (instructions: ChromeHandoffInstructions) => void): ChromeHandoffOpenResult;
  /** Clears the pending fallback timer; safe to call more than once. */
  destroy(): void;
}

export declare const CHROME_PACKAGE: string;
export declare const CHROME_OFFER_STORAGE_KEY: string;

export declare function detectInAppBrowser(userAgent?: string): InAppBrowserDetection;
export declare function isChromeHandoffCandidate(detection: InAppBrowserDetection | null | undefined): boolean;
export declare function buildChromeIntentUrl(url: string, options?: ChromeIntentOptions): string | null;
export declare function chromeHandoffInstructions(url: string, labels?: ChromeHandoffLabels): ChromeHandoffInstructions;
export declare function createChromeHandoff(options?: ChromeHandoffEnvironment): ChromeHandoffController;
