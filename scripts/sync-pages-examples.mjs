#!/usr/bin/env node
// Keep readable-without-JS documentation identical to typechecked examples.
import { readFileSync, writeFileSync } from "node:fs";
const htmlUrl = new URL("../examples/example/index.html", import.meta.url);
const source = readFileSync(
  new URL("../examples/example/src/guide-examples.ts", import.meta.url),
  "utf8",
);
const original = readFileSync(htmlUrl, "utf8");
let html = original;
const escape = (value) =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
for (const match of source.matchAll(
  /export function (\w+)\(\) \{([\s\S]*?)\n\}/g,
)) {
  const [, name, body] = match;
  const snippet = `import { YouGeAssistant } from '@youge/assistant-sdk';\n\nfunction ${name}() {${body}\n}`;
  const block = `<!-- guide:${name} --><div class="code-block"><div class="code-header">TypeScript / JavaScript · @youge/assistant-sdk</div><pre tabindex="0" role="region" aria-label="Code example"><code>${escape(snippet)}</code></pre></div><!-- /guide:${name} -->`;
  const placeholder = `<div data-guide-code="${name}"></div>`;
  if (html.includes(placeholder)) html = html.replace(placeholder, block);
  else {
    const pattern = new RegExp(
      `<!-- guide:${name} -->[\\s\\S]*?<!-- /guide:${name} -->`,
    );
    if (!pattern.test(html)) throw new Error(`Missing guide section: ${name}`);
    html = html.replace(pattern, () => block);
  }
}
if (process.argv.includes("--check")) {
  if (html !== original)
    throw new Error(
      "Pages samples differ from typechecked source. Run node scripts/sync-pages-examples.mjs",
    );
} else writeFileSync(htmlUrl, html);
