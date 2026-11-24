/*!
 * @youge/assistant-sdk/launcher — ElectricBorder renderer
 * --------------------------------------------------------
 * Framework-independent WebGL2 port of React Bits ElectricBorder. Attribution
 * and the upstream MIT + Commons Clause notice are in the package LICENSE.
 */
export function createElectricBorder(container, environment) {
  const root = environment && environment.window || globalThis;
  const doc = environment && environment.document || root.document;
  if (!container || !doc || !doc.createElement) return null;
  const createRenderer = (function () {
const ARCS = 4;
const PULSES = 3;
const MARGIN = 64;
const PIXEL_BUDGET = 3e6;
const SURGE_SPEED = 560;
const HALF_PI = Math.PI / 2;

const VERTEX = `#version 300 es
const vec2 corners[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
  gl_Position = vec4(corners[gl_VertexID], 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;

uniform vec2 uSize;
uniform float uRatio;
uniform vec2 uCenter;
uniform vec2 uHalf;
uniform float uRadius;
uniform vec3 uParam;
uniform float uPerimeter;
uniform vec4 uCells;
uniform vec2 uSoft;
uniform float uTime;
uniform float uPower;
uniform float uReveal;
uniform vec3 uHover;
uniform float uHoverRadius;
uniform vec4 uPulses[${PULSES}];
uniform vec3 uCore;
uniform vec3 uGlowColor;
uniform float uIntensity;
uniform float uGlow;
uniform float uThickness;
uniform float uStrands;
uniform float uChaos;
uniform float uSpread;
uniform float uFlicker;
uniform float uInk;
uniform vec4 uArcEnds[${ARCS}];
uniform vec4 uArcShape[${ARCS}];

out vec4 fragColor;

uint scramble(uint x) {
  x ^= x >> 16u;
  x *= 0x7feb352du;
  x ^= x >> 15u;
  x *= 0x846ca68bu;
  x ^= x >> 16u;
  return x;
}

vec2 slant(uint x, uint y, uint seed) {
  uint h = scramble(x * 0x8da6b343u + y * 0xd8163841u + seed * 0xcb1ab31fu);
  return vec2(uvec2(h, h >> 8u) & 255u) / 127.5 - 1.0;
}

vec2 ring(vec2 p, float period, uint seed) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float du = 30.0 * f.x * f.x * (f.x * (f.x - 2.0) + 1.0);
  uint x0 = uint(mod(i.x, period));
  uint x1 = uint(mod(i.x + 1.0, period));
  uint y0 = uint(i.y + 65536.0);
  vec2 ga = slant(x0, y0, seed);
  vec2 gb = slant(x1, y0, seed);
  vec2 gc = slant(x0, y0 + 1u, seed);
  vec2 gd = slant(x1, y0 + 1u, seed);
  float va = dot(ga, f);
  float vb = dot(gb, f - vec2(1.0, 0.0));
  float vc = dot(gc, f - vec2(0.0, 1.0));
  float vd = dot(gd, f - vec2(1.0, 1.0));
  float k = va - vb - vc + vd;
  float value = va + u.x * (vb - va) + u.y * (vc - va) + u.x * u.y * k;
  float gx = ga.x + u.x * (gb.x - ga.x) + u.y * (gc.x - ga.x) + u.x * u.y * (ga.x - gb.x - gc.x + gd.x);
  return vec2(value, gx + du * (vb - va + u.y * k));
}

float wobble(float x, uint seed) {
  return ring(vec2(x, 0.5), 1048576.0, seed).x;
}

vec2 frameAt(vec2 p) {
  vec2 inner = max(uHalf - uRadius, 0.0);
  vec2 q = abs(p) - inner;
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  float quarter = uPerimeter * 0.25;
  vec2 v = abs(p) - uParam.xy;
  float t;
  if (v.x > 0.0 && v.y > 0.0) t = uParam.x + uParam.z * atan(v.x, v.y);
  else if (v.x > v.y) t = uParam.x + 1.5707963 * uParam.z + uParam.y - abs(p.y);
  else t = abs(p.x);
  t = clamp(t, 0.0, quarter);
  float s = p.x >= 0.0 ? (p.y < 0.0 ? t : 2.0 * quarter - t) : (p.y < 0.0 ? 4.0 * quarter - t : 2.0 * quarter + t);
  return vec2(s, d);
}

vec2 glowShape(float line, float spread, float w) {
  float x = abs(line);
  float y = abs(spread);
  return vec2(exp(-x * x / (w * w * 0.5)) + exp(-y / (w * 2.2)) * 0.6, exp(-y / (w * 4.5)) * 0.5);
}

void addArc(vec2 p, vec4 ends, vec4 info, float t, inout vec3 light, inout float energy, inout float hot) {
  if (info.y < 0.002) return;
  vec2 ab = ends.zw - ends.xy;
  float len = max(length(ab), 1.0);
  vec2 dir = ab / len;
  vec2 rel = p - ends.xy;
  float along = dot(rel, dir);
  float side = dot(rel, vec2(-dir.y, dir.x));
  float margin = abs(info.x) + (0.6 + uChaos) * (2.0 + len * 0.08) + uThickness * 12.0 + 10.0;
  if (along < -margin || along > len + margin || abs(side) > margin) return;
  float u = clamp(along / len, 0.0, 1.0);
  float taper = sin(3.14159265 * u);
  float settle = smoothstep(0.0, 0.15, u) * smoothstep(1.0, 0.85, u);
  float bendSlope = 3.14159265 / len * cos(3.14159265 * u) * settle;
  float beyond = max(-along, 0.0) + max(along - len, 0.0);
  for (int c = 0; c < 2; c++) {
    uint seed = uint(info.z * 131.0) + uint(c) * 29u + 7u;
    float jag = 0.0;
    float jagSlope = 0.0;
    float wave = max(len * 0.3, 14.0);
    float weight = (0.6 + uChaos) * (1.5 + len * 0.05) * (c == 0 ? 1.0 : 1.5);
    for (int o = 0; o < 3; o++) {
      vec2 n = ring(vec2(along / wave + info.z * 3.0, t * (1.4 + float(o) * 1.1)), 1048576.0, seed + uint(o));
      jag += n.x * weight;
      jagSlope += n.y * weight / wave;
      wave *= 0.42;
      weight *= 0.4;
    }
    float offset = (info.x + jag) * taper;
    float offsetSlope = (info.x + jag) * bendSlope + jagSlope * taper * settle;
    float across = (side - offset) / sqrt(1.0 + offsetSlope * offsetSlope);
    float gap = length(vec2(beyond, across));
    float w = uThickness * (c == 0 ? 0.9 : 0.6);
    vec2 g = glowShape(gap, gap, w);
    float k = info.y * (c == 0 ? 1.0 : 0.45);
    light += (uCore * g.x + uGlowColor * g.y * uGlow) * k;
    energy += (g.x + g.y * uGlow) * k;
    hot += exp(-gap * gap / (w * w * 0.16)) * k * (c == 0 ? 1.0 : 0.0);
  }
}

void main() {
  vec2 p = vec2(gl_FragCoord.x / uRatio, uSize.y - gl_FragCoord.y / uRatio);
  vec2 frame = frameAt(p - uCenter);
  float s = frame.x;
  float d = frame.y;
  float t = uTime;
  vec3 light = vec3(0.0);
  float energy = 0.0;
  float hot = 0.0;

  float along = min(s, uPerimeter - s);
  float front = uReveal * (uPerimeter * 0.5 + 80.0);
  float shown = smoothstep(front, front - 70.0, along) * uPower;
  float flare = uReveal < 1.0 ? exp(-pow((along - front + 30.0) / 26.0, 2.0)) * uPower : 0.0;

  vec2 toHover = p - uHover.xy;
  float heat = uHover.z * exp(-dot(toHover, toHover) / (uHoverRadius * uHoverRadius));
  float surge = 0.0;
  for (int i = 0; i < ${PULSES}; i++) {
    vec4 pulse = uPulses[i];
    if (pulse.z <= 0.0) continue;
    float gap = abs(s - pulse.x);
    gap = min(gap, uPerimeter - gap);
    float wave = (gap - pulse.y * ${SURGE_SPEED}.0) / 46.0;
    surge += exp(-wave * wave) * pulse.z * exp(-pulse.y * 1.2);
  }
  heat = min(heat * 0.7 + surge * 0.8 + flare * 0.6, 1.2);
  vec2 inset = min(p, uSize - p);
  float frameFade = smoothstep(0.0, 14.0, min(inset.x, inset.y));

  float edge = abs(d);
  float inward = d < 0.0 ? exp(d / 14.0) : 1.0;
  float bloom = (exp(-edge / 3.0) * 0.1 + exp(-edge / 16.0) * 0.05 * inward) * uGlow * (1.0 + heat * 0.6) * shown;
  light += uGlowColor * bloom;
  energy += bloom;

  float bendAmp = uSpread * 16.0 * (1.0 + heat * 0.35);
  float rippleAmp = uSpread * 6.0 * (1.0 + heat * 0.3);
  float crinkleAmp = uChaos * 4.5 * (1.0 + heat * 0.3);
  float squeeze = min(1.0, 34.0 / max((bendAmp + rippleAmp) * 1.6 + crinkleAmp, 1e-3));
  bendAmp *= squeeze;
  rippleAmp *= squeeze;
  crinkleAmp *= squeeze;
  float reach = (bendAmp * 1.9 + rippleAmp + crinkleAmp * 1.6) * 1.3 + uThickness * 14.0 + 8.0;
  if (edge < reach && shown > 0.0) {
    float fade = smoothstep(reach, reach * 0.55, edge);
    float count = min(uStrands + heat * 1.2, 6.0);
    float slopeScale = 1.0 / uPerimeter;
    for (int i = 0; i < 6; i++) {
      float fi = float(i);
      if (fi >= ceil(count)) break;
      float present = clamp(count - fi, 0.0, 1.0);
      uint seed = uint(i) * 7u + 3u;
      float lead = i == 0 ? 1.0 : 0.0;
      float range = mix(1.35 + fi * 0.18, 0.7, lead);
      float x = s * slopeScale;
      vec2 a = ring(vec2(x * uCells.x, t * 0.7 + fi * 3.1), uCells.x, seed);
      vec2 b = ring(vec2(x * uCells.y, t * 1.9 + fi * 1.7), uCells.y, seed + 1u);
      vec2 c = ring(vec2(x * uCells.z, t * 4.6 + fi * 0.9), uCells.z, seed + 2u);
      vec2 e = ring(vec2(x * uCells.w, t * 6.8), uCells.w, seed + 3u);
      float offset = (a.x * bendAmp + b.x * rippleAmp) * range + (c.x + e.x * 0.35) * crinkleAmp;
      float slope =
        ((a.y * uCells.x * bendAmp + b.y * uCells.y * rippleAmp) * range +
          (c.y * uCells.z + e.y * 0.35 * uCells.w) * crinkleAmp) *
        slopeScale;
      float drift = lead > 0.5 ? 0.0 : wobble(fi * 7.3, seed + 9u) * 2.5 * uSpread;
      offset += drift;
      float across = (d - offset) / sqrt(1.0 + slope * slope);
      float spread = d - a.x * bendAmp * range - drift;
      float swell = 0.5 + 0.5 * ring(vec2(x * uSoft.y, t * 2.0 + fi * 5.1), uSoft.y, seed + 8u).x;
      float w = uThickness * mix(0.55, 1.0, lead) * (0.5 + swell);
      float vis = mix(0.3 + 0.45 * smoothstep(-0.25, 0.2, ring(vec2(x * uSoft.x, t * 0.5 + fi * 3.7), uSoft.x, seed + 5u).x), 1.0, lead);
      float spark = 1.0 - uFlicker * 0.3 * (0.5 + 0.5 * wobble(t * 13.0 + fi * 2.3, seed + 6u));
      float weight = max(vis, heat * 0.6) * spark * fade * present * (0.7 + 0.6 * swell);
      vec2 g = glowShape(across, spread, w) * weight;
      g.y *= inward;
      float haze = uGlow * (1.0 + heat * 0.5) * (1.0 - uInk * 0.7);
      light += uCore * g.x + uGlowColor * g.y * haze;
      energy += g.x + g.y * haze;
      hot += exp(-across * across / (w * w * 0.16)) * lead * weight;
    }
    light *= shown;
    energy *= shown;
    hot *= shown;
  }

  for (int i = 0; i < ${ARCS}; i++) addArc(p, uArcEnds[i], uArcShape[i], t, light, energy, hot);

  float breath = 1.0 + uFlicker * 0.5 * wobble(t * 4.6 + 7.0, 3u);
  float gain = uIntensity * breath * (1.0 + heat * 0.25) * 1.4;
  light *= frameFade;
  energy *= frameFade;
  hot *= frameFade;
  float alpha = 1.0 - exp(-energy * gain);
  vec3 color = mix(1.0 - exp(-light * gain), alpha * light / max(energy, 1e-4), uInk);
  color = mix(color, vec3(alpha), clamp(hot, 0.0, 1.0) * uInk * 0.85);
  float grain = (fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715)))) - 0.5) / 255.0;
  alpha = clamp(alpha + grain, 0.0, 1.0);
  fragColor = vec4(clamp(color + grain, 0.0, alpha), alpha);
}`;


const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseColor = value => {
  const text = String(value || '').trim();
  const hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
  if (hex) {
    const full = hex[1].length === 3 ? hex[1].replace(/./g, digit => digit + digit) : hex[1];
    return [0, 2, 4].map(index => parseInt(full.slice(index, index + 2), 16) / 255);
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(text);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map(channel => clamp(parseFloat(channel) / 255, 0, 1));
  if (typeof document !== 'undefined') {
    const context = document.createElement('canvas').getContext('2d');
    if (context) {
      context.fillStyle = '#000000';
      context.fillStyle = text;
      const normal = String(context.fillStyle);
      if (normal !== '#000000' || /^(#0{3}|#0{6}|black)$/i.test(text)) return parseColor(normal);
    }
  }
  return [0.49, 0.98, 1];
};

const compile = (gl, type, source) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  return shader;
};

const link = gl => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
  const program = vertex && fragment ? gl.createProgram() : null;
  if (!vertex || !fragment || !program) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  const uniforms = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let index = 0; index < count; index++) {
    const info = gl.getActiveUniform(program, index);
    if (info) uniforms[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
};

const roundBox = (x, y, hx, hy, r) => {
  const qx = Math.abs(x) - (hx - r);
  const qy = Math.abs(y) - (hy - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};

const pathOf = (width, height, radius, offset) => {
  const hx = Math.max(1, width / 2 + offset);
  const hy = Math.max(1, height / 2 + offset);
  const r = clamp(radius + offset, 0, Math.min(hx, hy));
  const vr = Math.min(r + 48, Math.min(hx, hy));
  const ax = hx - vr;
  const ay = hy - vr;
  const quarter = ax + ay + HALF_PI * vr;
  return { hx, hy, r, vr, ax, ay, quarter, perimeter: quarter * 4 };
};

const pointOn = (path, s) => {
  const { hx, hy, r, vr, ax, ay, quarter, perimeter } = path;
  const u = ((s % perimeter) + perimeter) % perimeter;
  const part = Math.min(3, Math.floor(u / quarter));
  const rest = u - part * quarter;
  const local = part % 2 ? quarter - rest : rest;
  let x;
  let y;
  if (local <= ax) {
    x = local;
    y = -hy;
  } else if (local <= ax + HALF_PI * vr) {
    const angle = vr > 0 ? (local - ax) / vr : 0;
    const dx = Math.sin(angle);
    const dy = -Math.cos(angle);
    let low = 0;
    let high = vr + r + 2;
    for (let step = 0; step < 18; step++) {
      const mid = (low + high) / 2;
      if (roundBox(ax + dx * mid, -ay + dy * mid, hx, hy, r) < 0) low = mid;
      else high = mid;
    }
    x = ax + dx * low;
    y = -ay + dy * low;
  } else {
    x = hx;
    y = -ay + (local - ax - HALF_PI * vr);
  }
  const flipX = part >= 2 ? -1 : 1;
  const flipY = part === 1 || part === 2 ? -1 : 1;
  const px = x * flipX;
  const py = y * flipY;
  const nx = roundBox(px + 0.5, py, hx, hy, r) - roundBox(px - 0.5, py, hx, hy, r);
  const ny = roundBox(px, py + 0.5, hx, hy, r) - roundBox(px, py - 0.5, hx, hy, r);
  const length = Math.hypot(nx, ny) || 1;
  return { x: px, y: py, nx: nx / length, ny: ny / length };
};

const nearestOn = (path, x, y) => {
  const { ax, ay, vr, quarter } = path;
  const qx = Math.abs(x) - ax;
  const qy = Math.abs(y) - ay;
  let t;
  if (qx > 0 && qy > 0) t = ax + vr * Math.atan2(qx, qy);
  else if (qx > qy) t = ax + HALF_PI * vr + ay - Math.abs(y);
  else t = Math.abs(x);
  t = clamp(t, 0, quarter);
  if (x >= 0) return y < 0 ? t : 2 * quarter - t;
  return y < 0 ? 4 * quarter - t : 2 * quarter + t;
};


  return function createElectricBorder(container) {
    if (!container || !doc.createElement) return null;
    var canvas = doc.createElement('canvas');
    canvas.className = 'youge-electric-webgl';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.setAttribute('focusable', 'false');
    canvas.style.position = 'absolute';
    canvas.style.zIndex = '3';
    canvas.style.display = 'block';
    canvas.style.pointerEvents = 'none';
    canvas.style.top = -MARGIN + 'px';
    canvas.style.left = -MARGIN + 'px';
    container.appendChild(canvas);

    var gl = null;
    try {
      gl = canvas.getContext('webgl2', {
        alpha: true,
        premultipliedAlpha: true,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: 'default',
      });
    } catch (error) {
      gl = null;
    }
    var program = gl && root.requestAnimationFrame ? link(gl) : null;
    if (!gl || !program) {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      return null;
    }

    var reduced = false;
    try { reduced = Boolean(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (error) { reduced = false; }
    var vao = gl.createVertexArray();
    if (!vao) {
      gl.deleteProgram(program.program);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      return null;
    }
    var arcEnds = new Float32Array(ARCS * 4);
    var arcShape = new Float32Array(ARCS * 4);
    var pulseData = new Float32Array(PULSES * 4);
    var size = { width: 1, height: 1, ratio: 1 };
    var pointer = { x: 0, y: 0, near: false };
    var hover = { x: 0, y: 0, vx: 0, vy: 0, power: 0 };
    var sparks = [];
    var pulses = [];
    var requestedActive = false;
    var settings = {
      color: '#7df9ff', speed: 1, intensity: 0.8, borderRadius: 24, shape: 'circle',
      active: false, light: false, cursorRadius: 90, interactive: true,
      chaos: 0.5, spread: 0.6, thickness: 1.5, strands: 3, glow: 0.6,
      arcs: 1, flicker: 0.5,
    };
    var coreColor = [1, 1, 1];
    var glowColor = [0.49, 0.98, 1];
    var power = 0;
    var reveal = 0;
    var wasActive = false;
    var ink = 0;
    var path = pathOf(1, 1, 0, 0);
    var time = Math.random() * 100;
    var raf = 0;
    var last = 0;
    var visible = true;
    var pageVisible = doc.visibilityState !== 'hidden';
    var lost = false;
    var destroyed = false;
    var resizePending = false;
    var resizeObserver = null;
    var intersection = null;

    function applyResize() {
      var width = Math.max(1, container.offsetWidth || 1);
      var height = Math.max(1, container.offsetHeight || 1);
      var canvasWidth = width + MARGIN * 2;
      var canvasHeight = height + MARGIN * 2;
      var ratio = Math.min(root.devicePixelRatio || 1, 2, Math.sqrt(PIXEL_BUDGET / (canvasWidth * canvasHeight)));
      var pixelWidth = Math.max(1, Math.round(canvasWidth * ratio));
      var pixelHeight = Math.max(1, Math.round(canvasHeight * ratio));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      canvas.style.width = canvasWidth + 'px';
      canvas.style.height = canvasHeight + 'px';
      size.width = width;
      size.height = height;
      size.ratio = pixelWidth / canvasWidth;
      var diameter = Math.min(width, height);
      var radius = settings.shape === 'circle' ? diameter / 2 : (settings.shape === 'rounded-square' ? diameter * 0.24 : diameter * 0.08);
      settings.borderRadius = radius;
      path = pathOf(width, height, radius, 0);
    }

    function spawnArc(now, near) {
      var span = Math.min(path.perimeter * 0.3, 60 + Math.random() * 90);
      var start = near == null ? Math.random() * path.perimeter : near;
      var from = start - span * (0.2 + Math.random() * 0.6);
      var to = from + span;
      var a = pointOn(path, from);
      var b = pointOn(path, to);
      var mid = pointOn(path, (from + to) / 2);
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var length = Math.hypot(dx, dy) || 1;
      var side = (-dy / length) * mid.nx + (dx / length) * mid.ny;
      var bow = Math.min(MARGIN - 30, length * (0.14 + Math.random() * 0.16) + 5);
      return {
        ax: a.x, ay: a.y, bx: b.x, by: b.y,
        bow: side >= 0 ? bow : -bow,
        seed: 1 + Math.random() * 60,
        born: now,
        life: 0.35 + Math.random() * 0.45,
      };
    }

    function render(heatPower) {
      var u = program.uniforms;
      var width = size.width + MARGIN * 2;
      var height = size.height + MARGIN * 2;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      if (power <= 0.001 && !sparks.length) return;
      gl.useProgram(program.program);
      gl.uniform2f(u.uSize, width, height);
      gl.uniform1f(u.uRatio, size.ratio);
      gl.uniform2f(u.uCenter, width / 2, height / 2);
      gl.uniform2f(u.uHalf, path.hx, path.hy);
      gl.uniform1f(u.uRadius, path.r);
      gl.uniform3f(u.uParam, path.ax, path.ay, path.vr);
      gl.uniform1f(u.uPerimeter, path.perimeter);
      gl.uniform4f(u.uCells,
        Math.max(1, Math.round(path.perimeter / 75)),
        Math.max(2, Math.round(path.perimeter / 25)),
        Math.max(3, Math.round(path.perimeter / 9)),
        Math.max(4, Math.round(path.perimeter / 4)));
      gl.uniform2f(u.uSoft,
        Math.max(1, Math.round(path.perimeter / 150)),
        Math.max(1, Math.round(path.perimeter / 50)));
      gl.uniform1f(u.uTime, time);
      gl.uniform1f(u.uPower, power * power * (3 - 2 * power));
      gl.uniform1f(u.uReveal, reveal);
      gl.uniform3f(u.uHover, hover.x + MARGIN, hover.y + MARGIN, heatPower);
      gl.uniform1f(u.uHoverRadius, settings.cursorRadius);
      gl.uniform4fv(u.uPulses, pulseData);
      gl.uniform3fv(u.uCore, coreColor);
      gl.uniform3fv(u.uGlowColor, glowColor);
      gl.uniform1f(u.uIntensity, settings.intensity);
      gl.uniform1f(u.uGlow, settings.glow);
      gl.uniform1f(u.uThickness, settings.thickness);
      gl.uniform1f(u.uStrands, settings.strands);
      gl.uniform1f(u.uChaos, settings.chaos);
      gl.uniform1f(u.uSpread, settings.spread);
      gl.uniform1f(u.uFlicker, reduced ? 0 : settings.flicker);
      gl.uniform1f(u.uInk, ink);
      gl.uniform4fv(u.uArcEnds, arcEnds);
      gl.uniform4fv(u.uArcShape, arcShape);
      gl.bindVertexArray(vao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    function frame(now) {
      raf = 0;
      if (resizePending) {
        resizePending = false;
        applyResize();
      }
      if (lost || destroyed) return;
      var dt = clamp((now - last) / 1000 || 0, 0, 0.05);
      last = Math.max(last, now);
      time += dt * settings.speed * (reduced ? 0 : 1);
      if (settings.active && !wasActive) reveal = 0;
      wasActive = settings.active;
      power += ((settings.active ? 1 : 0) - power) * (1 - Math.exp(-dt / (settings.active ? 0.28 : 0.4)));
      if (settings.active) reveal = reduced ? 1 : Math.min(1, reveal + dt / 0.9);
      ink += ((settings.light ? 1 : 0) - ink) * (1 - Math.exp(-dt / 0.25));
      var engaged = settings.interactive && pointer.near && settings.active && !reduced;
      if (engaged && hover.power < 0.01) {
        hover.x = pointer.x; hover.y = pointer.y; hover.vx = 0; hover.vy = 0;
      }
      hover.vx += ((pointer.x - hover.x) * 120 - hover.vx * 19) * dt;
      hover.vy += ((pointer.y - hover.y) * 120 - hover.vy * 19) * dt;
      hover.x += hover.vx * dt;
      hover.y += hover.vy * dt;
      hover.power += ((engaged ? 1 : 0) - hover.power) * (1 - Math.exp(-dt / (engaged ? 0.3 : 0.55)));
      for (var i = sparks.length - 1; i >= 0; i--) if (time - sparks[i].born > sparks[i].life) sparks.splice(i, 1);
      if (!reduced && settings.active && reveal >= 1 && settings.arcs > 0 && sparks.length < ARCS) {
        var chance = dt * settings.speed * settings.arcs;
        if (Math.random() < chance * 5 * hover.power) sparks.push(spawnArc(time, nearestOn(path, hover.x - size.width / 2, hover.y - size.height / 2)));
        else if (Math.random() < chance * (0.6 + path.perimeter / 2400)) sparks.push(spawnArc(time, null));
      }
      var fit = power * power * (3 - 2 * power);
      for (var index = 0; index < ARCS; index++) {
        var o = index * 4;
        var spark = sparks[index];
        if (!spark) { arcShape[o + 1] = 0; continue; }
        var k = clamp((time - spark.born) / spark.life, 0, 1);
        arcEnds[o] = spark.ax + size.width / 2 + MARGIN;
        arcEnds[o + 1] = spark.ay + size.height / 2 + MARGIN;
        arcEnds[o + 2] = spark.bx + size.width / 2 + MARGIN;
        arcEnds[o + 3] = spark.by + size.height / 2 + MARGIN;
        arcShape[o] = spark.bow;
        arcShape[o + 1] = Math.sin(Math.PI * k) * fit;
        arcShape[o + 2] = spark.seed;
      }
      for (var pulseIndex = pulses.length - 1; pulseIndex >= 0; pulseIndex--) if (now - pulses[pulseIndex].born > 2200) pulses.splice(pulseIndex, 1);
      for (var p = 0; p < PULSES; p++) {
        var po = p * 4;
        var pulse = pulses[p];
        if (!pulse) { pulseData[po + 2] = 0; continue; }
        pulseData[po] = pulse.s;
        pulseData[po + 1] = (now - pulse.born) / 1000;
        pulseData[po + 2] = 1;
      }
      render(hover.power * (settings.interactive ? 1 : 0));
      var busy = power > 0.002 || settings.active || sparks.length > 0;
      if (busy && visible && pageVisible) raf = root.requestAnimationFrame(frame);
    }

    function wake() {
      if (raf || lost || destroyed || !visible || !pageVisible || !root.requestAnimationFrame) return;
      last = root.performance && root.performance.now ? root.performance.now() : Date.now();
      raf = root.requestAnimationFrame(frame);
    }

    function resize() { resizePending = true; wake(); }
    function locate(event) {
      var rect = container.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.near = pointer.x >= -MARGIN / 2 && pointer.y >= -MARGIN / 2 && pointer.x <= rect.width + MARGIN / 2 && pointer.y <= rect.height + MARGIN / 2;
    }
    function onPointerMove(event) { locate(event); if (pointer.near) wake(); }
    function onPointerDown(event) {
      locate(event);
      if (!pointer.near || !settings.interactive || !settings.active || reduced) return;
      var along = nearestOn(path, pointer.x - size.width / 2, pointer.y - size.height / 2);
      pulses.push({ s: along, born: root.performance && root.performance.now ? root.performance.now() : Date.now() });
      if (pulses.length > PULSES) pulses.shift();
      if (sparks.length < ARCS) sparks.push(spawnArc(time, along));
      wake();
    }
    function onLeave() { pointer.near = false; }
    function onLost(event) {
      if (event && event.preventDefault) event.preventDefault();
      lost = true;
      if (raf) root.cancelAnimationFrame(raf);
      raf = 0;
      container.removeAttribute('data-electric-webgl-ready');
    }
    function onRestored() {
      lost = false;
      program = link(gl);
      vao = gl.createVertexArray();
      if (!program || !vao) { onLost(); return; }
      container.setAttribute('data-electric-webgl-ready', '');
      resize(); wake();
    }
    function onVisibility() { pageVisible = doc.visibilityState !== 'hidden'; wake(); }
    function onMotionChange(event) {
      reduced = Boolean(event.matches);
      settings.active = requestedActive && !reduced;
      if (reduced) {
        sparks.length = 0;
        pulses.length = 0;
        container.removeAttribute('data-electric-webgl-ready');
      } else container.setAttribute('data-electric-webgl-ready', '');
      wake();
    }

    var motionQuery = null;
    try {
      motionQuery = root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)');
      if (motionQuery && motionQuery.addEventListener) motionQuery.addEventListener('change', onMotionChange);
      else if (motionQuery && motionQuery.addListener) motionQuery.addListener(onMotionChange);
    } catch (error) { motionQuery = null; }
    root.addEventListener('pointermove', onPointerMove, { passive: true });
    root.addEventListener('pointerdown', onPointerDown, { passive: true });
    if (doc.documentElement) doc.documentElement.addEventListener('pointerleave', onLeave);
    doc.addEventListener('visibilitychange', onVisibility);
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    if (typeof root.ResizeObserver === 'function') {
      resizeObserver = new root.ResizeObserver(function () { resize(); wake(); });
      resizeObserver.observe(container);
    } else root.addEventListener('resize', resize, { passive: true });
    if (typeof root.IntersectionObserver === 'function') {
      intersection = new root.IntersectionObserver(function (entries) {
        visible = entries.some(function (entry) { return entry.isIntersecting; });
        wake();
      });
      intersection.observe(container);
    }
    container.setAttribute('data-electric-webgl-ready', '');
    resize();

    return {
      update: function (next) {
        next = next || {};
        var wasEnabled = settings.active;
        requestedActive = Boolean(next.active);
        settings.active = requestedActive;
        settings.color = typeof next.color === 'string' ? next.color : settings.color;
        settings.speed = clamp(Number(next.speed) || 1, 0, 5);
        settings.intensity = clamp(Number(next.intensity) || 0, 0, 3);
        settings.shape = next.shape === 'rounded-square' || next.shape === 'square' ? next.shape : 'circle';
        settings.borderRadius = Math.max(0, Number(next.borderRadius) || 0);
        settings.light = next.light === true;
        settings.interactive = next.interactive !== false;
        settings.cursorRadius = Math.max(1, Number(next.cursorRadius) || 90);
        var base = parseColor(settings.color);
        coreColor = base.map(function (channel) { return channel + (1 - channel) * 0.55; });
        glowColor = base;
        if (reduced || next.reducedMotion) {
          settings.active = false;
          container.removeAttribute('data-electric-webgl-ready');
        } else container.setAttribute('data-electric-webgl-ready', '');
        if (settings.active && !wasEnabled) reveal = 0;
        resizePending = true;
        wake();
      },
      destroy: function () {
        if (destroyed) return;
        destroyed = true;
        if (raf) root.cancelAnimationFrame(raf);
        if (resizeObserver) resizeObserver.disconnect();
        if (intersection) intersection.disconnect();
        root.removeEventListener('pointermove', onPointerMove);
        root.removeEventListener('pointerdown', onPointerDown);
        root.removeEventListener('resize', resize);
        if (doc.documentElement) doc.documentElement.removeEventListener('pointerleave', onLeave);
        doc.removeEventListener('visibilitychange', onVisibility);
        canvas.removeEventListener('webglcontextlost', onLost);
        canvas.removeEventListener('webglcontextrestored', onRestored);
        if (motionQuery && motionQuery.removeEventListener) motionQuery.removeEventListener('change', onMotionChange);
        else if (motionQuery && motionQuery.removeListener) motionQuery.removeListener(onMotionChange);
        container.removeAttribute('data-electric-webgl-ready');
        if (gl && !gl.isContextLost()) {
          if (vao) gl.deleteVertexArray(vao);
          if (program) gl.deleteProgram(program.program);
        }
        if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      },
    };
  };
})();
  return createRenderer(container);
}
