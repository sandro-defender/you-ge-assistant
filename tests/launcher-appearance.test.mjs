import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const classic = readFileSync(new URL('../src/assistant/assistant-widget.js', import.meta.url), 'utf8');
const classicCss = readFileSync(new URL('../src/assistant/assistant-widget.css', import.meta.url), 'utf8');
const react = readFileSync(new URL('../examples/example/src/main.jsx', import.meta.url), 'utf8');
const reactCss = readFileSync(new URL('../examples/example/example.css', import.meta.url), 'utf8');

test('built-in renderers consume the shared launcher appearance and preserve shape/logo controls', () => {
  for (const [source, label] of [[classic, 'classic widget'], [react, 'React example']]) {
    assert.match(source, /appearance\.launcher|launcher = appearance\.launcher/, `${label} reads launcher state`);
    assert.match(source, /logoFit|logo-fit|logoFit/, `${label} applies logo fit`);
    assert.match(source, /logoScale|logo-scale|logoScale/, `${label} applies logo scale`);
    assert.match(source, /logoPosition|logo-position|logoPosition/, `${label} applies logo position`);
    assert.match(source, /rounded-square|data-shape/, `${label} handles non-circle shapes`);
  }
});

test('electric outline extends beyond the launcher without clipping and only renders for active or static attention', () => {
  assert.match(classicCss, /\.youge-fab\s*\{[^}]*overflow:\s*visible/);
  assert.match(classicCss, /\.youge-electric-border\s*\{[^}]*inset:\s*-10px;[^}]*width:\s*calc\(100% \+ 20px\);[^}]*overflow:\s*visible/);
  assert.match(classicCss, /\.youge-electric-border[\s\S]*?pointer-events:\s*none/);
  assert.match(classicCss, /data-attention="active"[\s\S]*?youge-electric-border/);
  assert.match(reactCss, /\.assistant-electric-border\s*\{[^}]*inset:\s*-10px;[^}]*width:\s*calc\(100% \+ 20px\);[^}]*overflow:\s*visible/);
  assert.match(reactCss, /\.assistant-electric-border[\s\S]*?pointer-events:\s*none/);
  assert.match(reactCss, /\.assistant-fab\s*\{[^}]*overflow:\s*visible/);
  assert.match(react, /assistant-electric-border/);
});

test('mobile coarse-pointer launchers keep a static cue without continuous SVG or filter work', () => {
  assert.match(classicCss, /@media \(hover: none\) and \(pointer: coarse\)[\s\S]*?youge-electric-border path \{ animation: none; stroke-dasharray: none; filter: none;/);
  assert.match(reactCss, /@media \(hover: none\) and \(pointer: coarse\)[\s\S]*?assistant-electric-border path \{ animation: none; stroke-dasharray: none; filter: none;/);
});

test('both launcher renderers provide a non-animated reduced-motion attention ring', () => {
  assert.match(classicCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?youge-electric-border path[\s\S]*?animation:\s*none/);
  assert.match(reactCss, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*?assistant-electric-border path[\s\S]*?animation:\s*none/);
  assert.match(classic, /reducedMotion\(\) \? 'static' : 'active'/);
  assert.match(react, /launcherReducedMotion \? 'static' : 'active'/);
});

test('classic launcher remains a named semantic button with an expanded state', () => {
  assert.match(classic, /fab = el\('button', 'youge-fab'\)/);
  assert.match(classic, /aria-label/);
  assert.match(classic, /aria-expanded/);
  assert.match(classicCss, /\.youge-fab:focus-visible/);
  assert.match(react, /aria-expanded=\{open\}/);
});
