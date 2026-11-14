import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

/**
 * Phase 5 contracts for the React example.
 *
 * The example must *demonstrate* adaptive theming — it must never grow a second
 * implementation. Everything below therefore asserts either "the sample calls the
 * SDK" or "the sample paints from `--youge-*` tokens", never "the sample computes
 * its own palette".
 */

const studioSource = readFileSync(new URL('../example/src/ThemeStudio.jsx', import.meta.url), 'utf8');
const widgetSource = readFileSync(new URL('../example/src/main.jsx', import.meta.url), 'utf8');
const exampleCss = readFileSync(new URL('../example/example.css', import.meta.url), 'utf8');
const exampleHtml = readFileSync(new URL('../example/index.html', import.meta.url), 'utf8');
const examplePkg = JSON.parse(readFileSync(new URL('../example/package.json', import.meta.url), 'utf8'));
const rootPkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const exampleSources = `${studioSource}\n${widgetSource}`;

test('the example resolves themes through the SDK, not a parallel implementation', () => {
  assert.match(studioSource, /import \{[^}]*resolveTheme[^}]*\} from '@youge\/assistant-sdk';/s, 'the studio imports the shared resolver');
  assert.match(widgetSource, /resolveAppearanceTheme/, 'the floating widget uses the SDK React adapter resolver');
  assert.match(widgetSource, /resolveAppearanceTheme\(appearance, \{ root: window, document \}\)/, 'the live widget resolves from real host context');
  assert.match(widgetSource, /import \{[^}]*resolveAppearanceTheme[^}]*\} from '@youge\/assistant-sdk\/react';/s);
  // Anti-duplication guards: no local hex palette in the theming code and no
  // hand-rolled contrast maths outside the SDK helper.
  assert.doesNotMatch(studioSource, /function\s+(contrastRatio|relativeLuminance|bestInk|resolveTheme)\s*\(/, 'the studio defines no resolver');
  assert.doesNotMatch(widgetSource, /function\s+(resolveTheme|themeToCssVariables)\s*\(/, 'the sample widget defines no resolver');
  assert.match(exampleSources, /contrastRatio/, 'contrast numbers come from the SDK helper');
  assert.doesNotMatch(exampleSources, /luminance/, 'no local WCAG maths');
});

test('all four modes are exposed and switch through public configuration', () => {
  assert.match(studioSource, /THEME_MODES/, 'the mode list comes from the SDK constant');
  assert.doesNotMatch(studioSource, /\['auto', 'light', 'dark', 'custom'\]/, 'the example does not re-declare the mode list');
  for (const mode of ['auto', 'light', 'dark', 'custom']) {
    assert.match(studioSource, new RegExp(`\\b${mode}:`), `${mode} has help text in the studio`);
    assert.match(studioSource, new RegExp(`'${mode}'`), `${mode} is selectable`);
  }
  assert.match(studioSource, /onChange\(\{ mode: 'custom', tokens: preset\.tokens \}\)/, 'custom mode sends tokens, not colours');
  assert.match(studioSource, /onChange\(mode\)/, 'the other modes send the mode id');
  assert.match(widgetSource, /function changeTheme\(theme\) \{\s*\n\s*YouGeAssistant\.attach\(\)\.configure\(\{ theme \}\);/, 'switching goes through the public configure() API');
});

test('the studio demonstrates host adaptation with authored host presets', () => {
  assert.match(studioSource, /inheritHost: true/, 'host adaptation is exercised');
  assert.match(studioSource, /host: \{ primary:/, 'host values are supplied through the documented host field');
  assert.match(studioSource, /'Low-contrast trap'/, 'an intentionally unreadable host is part of the demo');
  assert.match(studioSource, /resolved\.warnings/, 'the sample surfaces validator warnings instead of hiding them');
  assert.match(studioSource, /theme:contrast_guard|warnings\.map/, 'warnings are rendered');
  for (const token of ['primary', 'surface', 'text', 'mutedText', 'border']) {
    assert.match(studioSource, new RegExp(`${token}: '#`), `host preset supplies ${token}`);
  }
  assert.match(studioSource, /fontFamily: 'Georgia/, 'typography adaptation is demonstrated too');
});

test('custom mode is demonstrated with real tokens, not a fixed palette', () => {
  assert.match(studioSource, /CUSTOM_PRESETS/, 'two custom palettes are offered');
  for (const token of ['radius', 'radiusSmall', 'borderWidth', 'shadow', 'fontFamily']) {
    assert.doesNotMatch(studioSource, new RegExp(`${token}: undefined`));
  }
  assert.match(studioSource, /radius: 16/, 'custom radius is demonstrated');
  assert.match(studioSource, /shadow: '0 18px 40px/, 'custom elevation is demonstrated');
});

test('every preview is painted from the shared --youge-* tokens', () => {
  const previewBlocks = exampleCss.split('.theme-preview-surface')[1] || '';
  assert.ok(previewBlocks.length > 0, 'the preview surface is styled');
  for (const token of [
    '--youge-surface',
    '--youge-ink',
    '--youge-muted',
    '--youge-line',
    '--youge-brand',
    '--youge-primary-ink',
    '--youge-radius',
    '--youge-radius-small',
    '--youge-font',
    '--youge-shadow',
  ]) {
    assert.ok(exampleCss.includes(`var(${token}`), `${token} drives the example`);
  }
  // The example keeps its green identity as a fallback only.
  assert.match(exampleCss, /var\(--youge-surface, #ffffff\)/, 'tokens fall back to the sample palette');
});

test('the floating widget publishes the theme on its root element', () => {
  assert.match(widgetSource, /data-theme=\{resolvedTheme\.mode\}/, 'the mode is observable');
  assert.match(widgetSource, /data-scheme=\{resolvedTheme\.scheme\}/, 'the resolved scheme is observable');
  assert.match(widgetSource, /data-theme-inherit=\{resolvedTheme\.inheritHost \? '' : undefined\}/, 'host inheritance is observable');
  assert.match(widgetSource, /style=\{themeStyle\(resolvedTheme\)\}/, 'the variables are applied inline');
  assert.match(
    widgetSource,
    /function themeStyle\(resolved\) \{\s*\n\s*const style = \{\};\s*\n\s*Object\.keys\(resolved\.variables\)\.forEach\(\(name\) => \{\s*\n\s*style\[name\] = resolved\.variables\[name\];/,
    'only resolver-produced variables are written',
  );
  assert.match(widgetSource, /style\.colorScheme = resolved\.scheme/, 'native controls follow the scheme');
});

test('all five notification levels are demonstrated with icon, label and action', () => {
  assert.match(studioSource, /NOTIFICATION_LEVELS\.map/, 'the gallery iterates the SDK level list');
  assert.match(studioSource, /NOTIFICATION_LEVEL_LABELS\[level\]/, 'each demo is named in words');
  for (const level of ['critical', 'error', 'warning', 'info', 'success']) {
    assert.ok(studioSource.includes(`level === '${level}'`), `${level} has demonstration copy`);
    assert.match(exampleCss, new RegExp(`\\.notice-demo\\[data-level="${level}"\\]`), `${level} has its own presentation`);
  }
  assert.match(studioSource, />Acknowledge<\/button>/, 'critical is acknowledged');
  assert.match(studioSource, />Dismiss<\/button>/, 'non-critical levels are dismissible');
  assert.match(widgetSource, /data-level=\{notice\.level\}/, 'the live widget list uses the level attribute');
  assert.match(widgetSource, /aria-label=\{`\$\{notificationLevelLabel\(notice\.level\)\} notice`\}/, 'the level is announced');
});

test('severity never relies on colour alone', () => {
  assert.match(exampleCss, /\.notice-demo\[data-level="critical"\][^{]*\{[^}]*border-left-width: 4px/, 'critical gets a heavier stripe');
  assert.match(exampleCss, /\.notice-demo\[data-level="error"\][^{]*\{[^}]*border-left-width: 4px/, 'error gets a heavier stripe');
  assert.match(exampleCss, /\.notice-demo\[data-level="warning"\][^{]*\{ --youge-notice-accent/, 'warning keeps a standard stripe');
  assert.match(exampleCss, /\.assistant-notice\[data-level="critical"\][^{]*\{[^}]*border-left-width: 4px/, 'the live list matches the gallery');
  assert.match(exampleCss, /\.notice-demo-icon svg \{ width: 18px; height: 18px; \}/, 'each level carries a distinct glyph');
  assert.match(exampleCss, /\.notice-demo\[data-level="critical"\] \.notice-demo-body strong \{ font-weight: 800; \}/, 'critical also changes weight');
});

test('the example keeps accessibility: focus, grouping, labels and motion', () => {
  assert.match(studioSource, /role="radiogroup" aria-label="Theme mode"/, 'mode selection is a labelled radio group');
  assert.match(studioSource, /role="radiogroup" aria-label="Preview scheme"/, 'scheme override is a labelled radio group');
  assert.match(studioSource, /aria-labelledby="theme-studio-title"/, 'the section is labelled by its heading');
  assert.match(studioSource, /role="status"/, 'validator feedback is announced');
  assert.match(studioSource, /<legend>/, 'each control group has a legend');
  assert.match(studioSource, /aria-hidden="true"/, 'decorative glyphs stay hidden from AT');
  assert.doesNotMatch(exampleSources, /dangerouslySetInnerHTML/, 'no markup injection in the example');
  assert.match(widgetSource, /notificationLevelElement\(level, React\.createElement\)/, 'glyphs are built as real elements');

  assert.match(exampleCss, /\.theme-segmented label:focus-within \{ outline: 3px solid/, 'keyboard focus is visible on segmented controls');
  assert.match(exampleCss, /\.notice-demo-btn:focus-visible \{ outline: 3px solid var\(--youge-focus/, 'focus follows the theme accent');
  assert.match(exampleCss, /\.assistant-panel-close:focus-visible \{ outline: 3px solid/, 'the panel close button shows focus');
  assert.match(exampleCss, /\.assistant-panel-action:focus-visible \{ outline: 3px solid/, 'panel actions show focus');
  assert.match(exampleCss, /min-height: 44px/, 'touch targets stay at least 44px');
  assert.match(exampleCss, /\.theme-chip \{[^}]*min-height: 44px/s, 'chips are 44px tall');
  assert.match(exampleCss, /@media \(prefers-reduced-motion: reduce\) \{[\s\S]{0,400}transition-duration: 0\.01ms !important/, 'reduced motion is honoured');
  assert.doesNotMatch(exampleCss, /\.theme-studio[^{]*\{[^}]*animation:/, 'the studio paints no animation');
});

test('the example adds no dependency and changes no package version', () => {
  const deps = examplePkg.dependencies || {};
  // The local SDK and React were already part of the example (bindings);
  // theming must not add anything. The animated logo (and its `ogl` runtime)
  // was removed in favour of the static zoomed mark.
  assert.deepEqual(
    Object.keys(deps).sort(),
    ['@youge/assistant-sdk', 'react', 'react-dom'],
    'theming adds no dependency to the example',
  );
  assert.match(deps['@youge/assistant-sdk'], /^file:/, 'the example consumes the local SDK');
  assert.equal(rootPkg.version, '1.2.0', 'the kit version is bumped once, deliberately, by an owner-authorized PR');
  assert.deepEqual(
    Object.keys(rootPkg.dependencies || {}),
    [],
    'the shipped package still has zero runtime dependencies',
  );
  const sdkPkg = JSON.parse(
    readFileSync(new URL('../packages/assistant-sdk/package.json', import.meta.url), 'utf8'),
  );
  assert.equal(sdkPkg.version, '0.2.0', 'the SDK version is bumped only by the release PR');
  assert.deepEqual(Object.keys(sdkPkg.dependencies || {}), [], 'the embedded SDK stays dependency-free');
});

test('the theme studio is reachable from the shipped example page', () => {
  assert.match(exampleHtml, /id="assistant-theme-studio"/, 'the studio has a mount point');
  assert.match(exampleHtml, /One Assistant, four modes\./, 'the section is reachable without JavaScript');
  assert.match(widgetSource, /getElementById\('assistant-theme-studio'\)/, 'the example mounts into it');
  assert.match(widgetSource, /createRoot\(themeMount\)\.render\(<ThemeStudioHost \/>\)/, 'and renders the studio');
});
