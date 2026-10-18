// The pack-opening finishes as code shaders (owner 2026-10-04: "finishes
// such as holo and gold should be code shaders"; 2026-10-18: "finishes are
// code shaders, and nothing calls the network at runtime").
//
// Each finish is a WebGL fragment shader drawn into a canvas laid over the
// card face, composited with a CSS blend mode, so the card underneath (the
// DOM face: name, art window, text) shows through and the shader adds the
// light: a holo band and glints that follow the pointer or the device's
// tilt (foil), a metal sheen with twinkling stars (gold), scanlines and
// jumping block tears (glitch), a code rain and a breach pulse (Zero-Day),
// and the pack's own idle shimmer.
//
// No WebGL (an old browser, a blocked GPU, a lost context): the layer says
// so and the page adds a CSS class instead, whose gradient stands in for the
// shader (the `fx-css-*` rules in packPage.ts). The page still works; the
// finish is flatter.
//
// Same single-source pattern as canvasFx.ts / soundFx.ts: the page embeds
// PACK_FX_SHADERS (data) and PACK_FX_RUNTIME_SOURCE (the WebGL player)
// verbatim. The tests read the shader table in Node; the headless check
// (progress/render/evidence/pack-opening-check.mjs) compiles every shader
// in a real browser and reads its pixels.

const HEAD = `precision mediump float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_ptr;
uniform float u_amt;
uniform float u_seed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed * 17.13) * 43758.5453); }
vec3 hsv(float h, float s, float v) {
  vec3 k = clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
  return v * mix(vec3(1.0), k, s);
}
`;

/** Fragment shaders by name. Every one writes premultiplied colour, scaled
 * by u_amt (0 = invisible, 1 = full), so the page can fade a layer in and
 * out with one number. u_ptr is the light's position over the card, 0-1. */
export const PACK_FX_SHADERS: Record<string, string> = {
  // Holo: rainbow bands that slide as the light moves, fine diagonal
  // lines, a soft glare where the light is, and sparse glints.
  foil: `${HEAD}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 d = uv - u_ptr;
  float band = dot(uv, vec2(0.86, 0.5)) * 2.6 + (u_ptr.x - u_ptr.y) * 1.8 + u_time * 0.04;
  vec3 rainbow = hsv(fract(band), 0.6, 1.0);
  float lines = 0.5 + 0.5 * sin((uv.x + uv.y) * u_res.x * 0.42);
  float glare = exp(-dot(d, d) * 7.0);
  vec2 cell = floor(gl_FragCoord.xy / 5.0);
  float h = hash(cell);
  float glint = step(0.986, h) * pow(0.5 + 0.5 * sin(u_time * 3.2 + h * 50.0), 10.0);
  vec3 col = rainbow * (0.35 + 0.25 * lines) * (0.4 + 0.9 * glare) + vec3(glare * 0.35 + glint);
  float a = clamp(u_amt * (0.3 + 0.45 * glare + glint), 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}`,
  // Gold: a moving metal sheen (a bright band across a warm ramp) and
  // four-point stars that twinkle in and out.
  gold: `${HEAD}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float t = dot(uv - u_ptr, vec2(0.7, 0.7));
  float sheen = pow(max(0.0, 1.0 - abs(t + 0.15 * sin(u_time * 0.7)) * 3.2), 3.0);
  vec3 ramp = mix(vec3(0.55, 0.36, 0.08), vec3(1.0, 0.86, 0.48), 0.5 + 0.5 * sin(t * 9.0 + u_time * 0.6));
  vec2 g = gl_FragCoord.xy / 26.0;
  vec2 c = floor(g);
  vec2 f = fract(g) - 0.5;
  float h = hash(c);
  vec2 o = vec2(hash(c + 3.1), hash(c + 7.7)) - 0.5;
  vec2 q = abs(f - o * 0.5);
  float star = max(0.0, 1.0 - (q.x * q.y) * 900.0) * max(0.0, 1.0 - length(q) * 6.0);
  float tw = step(0.72, h) * pow(0.5 + 0.5 * sin(u_time * 2.4 + h * 40.0), 6.0);
  vec3 col = ramp * (0.25 + 0.75 * sheen) + vec3(1.0, 0.95, 0.8) * star * tw * 1.6;
  float a = clamp(u_amt * (0.22 + 0.55 * sheen + star * tw), 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}`,
  // Glitch: scanlines, a slow rolling bar, and block tears in split
  // channels that jump about 12 times a second. u_amt drives how much of the
  // card tears (1 while it corrupts on the flip, low at rest).
  glitch: `${HEAD}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float step12 = floor(u_time * 12.0);
  vec2 blk = floor(uv * vec2(5.0, 22.0));
  float n = hash(blk + step12);
  float tear = step(1.0 - 0.22 * u_amt, n);
  float which = hash(blk + step12 + 9.0);
  vec3 split = which < 0.5 ? vec3(1.0, 0.0, 0.35) : vec3(0.0, 0.95, 1.0);
  float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * 1.9);
  float roll = exp(-pow((fract(uv.y - u_time * 0.12) - 0.5) * 9.0, 2.0));
  vec3 col = split * tear * (0.6 + 0.4 * hash(blk * 3.0 + step12)) + vec3(0.15, 0.9, 0.7) * (1.0 - scan) * 0.22 + vec3(0.5) * roll * 0.12;
  float a = clamp(tear * 0.85 + (1.0 - scan) * 0.12 + roll * 0.08, 0.0, 1.0) * clamp(u_amt * 1.4 + 0.25, 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}`,
  // Zero-Day: a green code rain in columns, a red breach ring pulsing out
  // from the centre, and noise flicker. Full screen in the takeover, and on
  // the card itself after it arrives.
  zeroDay: `${HEAD}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 cellSize = vec2(9.0, 13.0);
  float col = floor(gl_FragCoord.x / cellSize.x);
  float speed = 0.35 + hash(vec2(col, 1.0)) * 1.1;
  float y = fract(uv.y + u_time * speed * 0.35 + hash(vec2(col, 5.0)));
  float trail = pow(y, 7.0);
  float glyph = step(0.45, hash(floor(gl_FragCoord.xy / cellSize) + floor(u_time * 9.0)));
  vec3 rain = vec3(0.25, 1.0, 0.55) * trail * glyph;
  float r = length((uv - 0.5) * vec2(u_res.x / u_res.y, 1.0));
  float ring = exp(-pow((r - fract(u_time * 0.55) * 1.2) * 10.0, 2.0));
  vec3 breach = vec3(1.0, 0.12, 0.22) * ring * 0.9;
  float flick = step(0.993, hash(floor(gl_FragCoord.xy / 3.0) + floor(u_time * 30.0)));
  vec3 c = rain + breach + vec3(flick);
  float a = clamp(u_amt * (trail * glyph * 0.9 + ring * 0.7 + flick), 0.0, 1.0);
  gl_FragColor = vec4(c * a, a);
}`,
  // An agent's signature card (render session 28): Neutral white-gold light
  // radiating from the art, slow-turning rays, one thin rune ring around the
  // art's centre that brightens where the light falls, and sparse glints. It
  // has to read as above every pack finish, so it is the only one with
  // rays.
  signature: `${HEAD}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 c = vec2(0.5, 0.66);
  vec2 p = (uv - c) * vec2(u_res.x / u_res.y, 1.0);
  float r = length(p);
  float ang = atan(p.y, p.x);
  float rays = pow(0.5 + 0.5 * sin(ang * 12.0 + u_time * 0.35), 6.0) * exp(-r * 2.2);
  float ring = exp(-pow((r - 0.27) * 70.0, 2.0)) * (0.55 + 0.45 * sin(ang * 24.0 - u_time * 0.8));
  vec2 d = uv - u_ptr;
  float glare = exp(-dot(d, d) * 6.0);
  vec2 g = gl_FragCoord.xy / 9.0;
  vec2 cell = floor(g);
  float h = hash(cell);
  float dot1 = max(0.0, 1.0 - length(fract(g) - 0.5) * 3.2);
  float glint = step(0.992, h) * dot1 * dot1 * pow(0.5 + 0.5 * sin(u_time * 2.6 + h * 60.0), 12.0);
  vec3 warm = vec3(1.0, 0.94, 0.76);
  vec3 col = warm * (rays * 0.8 + ring * (0.5 + glare)) + vec3(1.0, 0.98, 0.9) * (glare * 0.3 + glint);
  float a = clamp(u_amt * (rays * 0.45 + ring * 0.5 + glare * 0.22 + glint), 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}`,
  // The sealed pack: a slow diagonal glare sweep over a faint holo, the
  // light leaning toward the pointer.
  pack: `${HEAD}
void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float sweep = fract(u_time * 0.18);
  float x = dot(uv, vec2(0.8, 0.6)) - (sweep * 2.2 - 0.6);
  float glare = exp(-x * x * 60.0);
  vec2 d = uv - u_ptr;
  float soft = exp(-dot(d, d) * 5.0);
  vec3 holo = hsv(fract(dot(uv, vec2(0.5, 0.9)) * 1.4 + u_ptr.x * 0.6), 0.45, 1.0);
  vec3 col = vec3(1.0) * glare * 0.7 + holo * soft * 0.35;
  float a = clamp(u_amt * (glare * 0.55 + soft * 0.25), 0.0, 1.0);
  gl_FragColor = vec4(col * a, a);
}`,
};

export const PACK_FX_NAMES = Object.keys(PACK_FX_SHADERS);

export const PACK_FX_RUNTIME_SOURCE = String.raw`
  // FXGL.layer(host, name, opts): a canvas over host running shader name.
  // Returns { set(amt), ptr(x, y), stop() }, or null without WebGL (the
  // caller then adds the CSS stand-in). opts.amt is the starting strength.
  var FXGL = (function () {
    var VS = 'attribute vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }';
    var stats = { compiled: {}, failed: {}, frames: {}, layers: 0, live: 0, fallbacks: {} };
    window.__packfx = stats;
    function compile(gl, type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { var log = gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(log || 'compile failed'); }
      return s;
    }
    function layer(host, name, opts) {
      opts = opts || {};
      var src = PACK_FX_SHADERS[name];
      if (!src) return null;
      var canvas = document.createElement('canvas');
      canvas.className = 'fxgl fxgl-' + name;
      var gl = null;
      try { gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false, preserveDrawingBuffer: !!opts.readable }); } catch (e) { gl = null; }
      if (!gl) { stats.fallbacks[name] = (stats.fallbacks[name] || 0) + 1; return null; }
      var prog;
      try {
        prog = gl.createProgram();
        gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, src));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || 'link failed');
      } catch (e) {
        stats.failed[name] = String(e && e.message || e);
        stats.fallbacks[name] = (stats.fallbacks[name] || 0) + 1;
        return null;
      }
      stats.compiled[name] = true;
      gl.useProgram(prog);
      var buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      var loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      var U = {};
      ['u_res', 'u_time', 'u_ptr', 'u_amt', 'u_seed'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
      host.appendChild(canvas);
      stats.layers++; stats.live++;
      var amt = opts.amt === undefined ? 1 : opts.amt, px = 0.5, py = 0.5, t0 = performance.now(), raf = 0, alive = true;
      var seed = opts.seed || 0;
      function frame(now) {
        if (!alive) return;
        var dpr = Math.min(2, window.devicePixelRatio || 1);
        var w = Math.max(1, Math.round(canvas.clientWidth * dpr)), h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        gl.viewport(0, 0, w, h);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.uniform2f(U.u_res, w, h);
        gl.uniform1f(U.u_time, (now - t0) / 1000);
        // u_ptr is in GL space (y up); the page passes y down.
        gl.uniform2f(U.u_ptr, px, 1 - py);
        gl.uniform1f(U.u_amt, amt);
        gl.uniform1f(U.u_seed, seed);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        stats.frames[name] = (stats.frames[name] || 0) + 1;
        raf = requestAnimationFrame(frame);
      }
      raf = requestAnimationFrame(frame);
      return {
        canvas: canvas,
        set: function (a) { amt = a; },
        get: function () { return amt; },
        ptr: function (x, y) { px = x; py = y; },
        stop: function () {
          if (!alive) return;
          alive = false; cancelAnimationFrame(raf); stats.live--;
          var ext = gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
          if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
        },
      };
    }
    return { layer: layer, stats: stats };
  })();
`;
