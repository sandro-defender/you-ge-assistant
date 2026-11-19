import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const source = readFileSync(resolve(root, 'examples/sdk-demo/src/main.ts'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'packages/assistant-sdk/package.json'), 'utf8'));

test('SDK experience consumes only explicitly exported SDK package entrypoints', () => {
  const imports = [...source.matchAll(/from\s+['"](@youge\/assistant-sdk(?:\/[^'"]*)?)['"]/g)].map(match => match[1]);
  assert.deepEqual(new Set(imports), new Set(['@youge/assistant-sdk', '@youge/assistant-sdk/i18n', '@youge/assistant-sdk/installation']));
  for (const specifier of imports) assert.ok(packageJson.exports[specifier.replace('@youge/assistant-sdk', '.')], `${specifier} is exported`);
  assert.doesNotMatch(source, /@youge\/assistant-sdk\/src\//);
});

test('demo source has no assistant runtime script, copied runtime or CDN module import', () => {
  const html = readFileSync(resolve(root, 'examples/sdk-demo/index.html'), 'utf8');
  assert.doesNotMatch(html, /pwa\.js|assistant-state\.js|assistant-widget\.js/);
  assert.doesNotMatch(source, /from\s+['"]https?:\/\//);
  assert.doesNotMatch(source, /serviceWorker\.register|beforeinstallprompt/);
});

test('Pages and verification workflows build the isolated /sdk-demo before assembly/tests', () => {
  const assembler = readFileSync(resolve(root, 'scripts/assemble-pages.mjs'), 'utf8');
  assert.match(assembler, /examples\/sdk-demo\/dist/);
  assert.match(assembler, /join\(safeOutputDir, 'sdk-demo'\)/);
  assert.ok(existsSync(resolve(root, 'examples/sdk-demo/package-lock.json')));
  for (const workflow of ['check.yml', 'sdk-release-prep.yml', 'pages.yml']) {
    const yaml = readFileSync(resolve(root, '.github/workflows', workflow), 'utf8');
    assert.match(yaml, /working-directory: examples\/sdk-demo/);
    assert.match(yaml, /npm ci && npm run typecheck && npm run build/);
  }
});

test('all twelve public SDK locale helpers work and no SDK RTL locale is invented', () => {
  const script = `import assert from 'node:assert/strict'; import {SUPPORTED_LOCALES, normalizeLocaleTag, resolveLocale, translate, isRtlLocale, localizeDnsClassification, localizeDnsMessage, formatAlertCount, chromeHandoffLabels} from '@youge/assistant-sdk/i18n'; import {resolveInstallationCopy} from '@youge/assistant-sdk/installation'; assert.equal(SUPPORTED_LOCALES.length,12); for(const locale of SUPPORTED_LOCALES){ assert.equal(normalizeLocaleTag(locale),locale); assert.equal(resolveLocale({explicit:locale}),locale); assert.ok(translate(locale,'installAvailableTitle')); assert.ok(resolveInstallationCopy(locale).installActionLabel); assert.ok(localizeDnsClassification(locale,'nxdomain')); assert.ok(localizeDnsMessage(locale,'nxdomain').message); assert.ok(formatAlertCount(locale,2)); assert.ok(chromeHandoffLabels(locale).title); assert.equal(isRtlLocale(locale),false); }`;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: resolve(root, 'examples/sdk-demo'), stdio: 'pipe' });
  assert.match(source, /SUPPORTED_LOCALES\.map/);
  assert.match(source, /document\.documentElement\.dir/);
  assert.match(source, /verified core list has no RTL locale/);
});

test('domain preset and host SDK overrides resolve through documented configuration exports', () => {
  const script = `import assert from 'node:assert/strict'; import {resolveAssistantConfig,resolveDomain} from '@youge/assistant-sdk'; const preset=resolveDomain('portal.example.test',{'portal.example.test':{identity:{name:'Domain preset',shortName:'Preset',description:'Host-specific'}}}); const resolved=resolveAssistantConfig({projectId:'demo-host',domain:'portal.example.test',branding:{name:'Explicit host override',shortName:'Host',icon:'',themeColor:'#4965e8'},installExperience:{enabled:false,presentation:'manual',locale:'en'}},{fallbackProjectId:'demo-host'}); assert.equal(preset.identity.name,'Domain preset'); assert.equal(resolved.config.branding.name,'Explicit host override'); assert.equal(resolved.config.installExperience.enabled,false); assert.equal(resolved.meta.source,'overrides');`;
  execFileSync(process.execPath, ['--input-type=module', '-e', script], { cwd: resolve(root, 'examples/sdk-demo'), stdio: 'pipe' });
});

test('installation buttons call SDK exports and retain actual result/error semantics', () => {
  for (const api of ['deriveInstallationState','resolveInstallationCopy','requestPwaInstall','showPwaInstallDialog','hidePwaInstallDialog','triggerPwaInstall','readInstalledRelatedApps']) assert.match(source, new RegExp(`\\b${api}\\(`));
  assert.match(source, /No native prompt is exposed/);
  assert.match(source, /unsupported/);
});
