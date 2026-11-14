import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { YouGeAssistant } from '../src/index.js';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const readPkg = (rel) => readFileSync(join(pkgRoot, rel), 'utf8');

function extractInterfaceBody(dts, name) {
  const marker = `export interface ${name} {`;
  const start = dts.indexOf(marker);
  assert.notEqual(start, -1, `interface ${name} exists`);
  let depth = 0;
  let end = -1;
  for (let i = start + marker.length - 1; i < dts.length; i += 1) {
    if (dts[i] === '{') depth += 1;
    else if (dts[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  assert.notEqual(end, -1, `interface ${name} closes cleanly`);
  return dts.slice(start, end + 1);
}

test('every package.json subpath export is documented in README.md and matches paired .d.ts exports', async () => {
  const pkg = JSON.parse(readPkg('package.json'));
  const readme = readPkg('README.md');
  const subpathHeader = readme.indexOf('### Subpath Exports');
  assert.notEqual(subpathHeader, -1, 'README.md includes Subpath Exports section');
  const nextSection = readme.indexOf('\n---', subpathHeader);
  const subpathSection = readme.slice(subpathHeader, nextSection === -1 ? undefined : nextSection);

  for (const [subpath, target] of Object.entries(pkg.exports)) {
    if (subpath === './package.json') continue;
    const expectedImport = subpath === '.' ? pkg.name : `${pkg.name}/${subpath.slice(2)}`;
    assert.ok(
      subpathSection.includes(`\`${expectedImport}\``),
      `README.md Subpath Exports documents ${expectedImport}`
    );

    const mod = await import(join(pkgRoot, target.default));
    const dts = readPkg(target.types);
    const runtimeExports = Object.keys(mod).filter((name) => name !== 'default');
    const missing = runtimeExports.filter((name) => !new RegExp(`\\b${name}\\b`).test(dts));
    assert.deepEqual(missing, [], `${target.types} declares every runtime export of ${target.default}`);
  }
});

test('YouGeAssistantStatic and AssistantConfigSummary in src/index.d.ts match runtime objects', () => {
  const indexDts = readPkg('src/index.d.ts');
  const staticBody = extractInterfaceBody(indexDts, 'YouGeAssistantStatic');
  const missingStatic = Object.keys(YouGeAssistant).filter(
    (key) => !new RegExp(`\\b${key}\\b`).test(staticBody)
  );
  assert.deepEqual(missingStatic, [], 'YouGeAssistantStatic declares every key on YouGeAssistant');

  const assistant = YouGeAssistant.create({ projectId: 'decl-check', bindEvents: false });
  const configKeys = Object.keys(assistant.getConfig());
  assistant.destroy();
  const configBody = extractInterfaceBody(indexDts, 'AssistantConfigSummary');
  const missingConfig = configKeys.filter((key) => !new RegExp(`\\b${key}\\s*:`).test(configBody));
  assert.deepEqual(missingConfig, [], 'AssistantConfigSummary declares every key returned by getConfig()');
});

test('installation and domain declaration interfaces reflect runtime hasUpdate, applyUpdate and diagnostics fields', () => {
  const installDts = readPkg('src/installation/index.d.ts');
  const pwaBody = extractInterfaceBody(installDts, 'PwaRuntimeLike');
  assert.match(pwaBody, /\bhasUpdate\?:\s*boolean\b/, 'PwaRuntimeLike.getState declares hasUpdate?: boolean');
  assert.match(pwaBody, /\bapplyUpdate\?:\s*\(\)\s*=>\s*Promise<boolean>/, 'PwaRuntimeLike.applyUpdate allows Promise<boolean>');

  const domainDts = readPkg('src/domain/index.d.ts');
  const resolvedDomainBody = extractInterfaceBody(domainDts, 'ResolvedDomainConfig');
  assert.match(resolvedDomainBody, /\bdiagnostics\?:/, 'ResolvedDomainConfig declares optional diagnostics probe config');
});
