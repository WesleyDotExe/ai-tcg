// The liquid background in the browser (Season 0 render item 2, render
// session 45): one full-screen triangle and a fragment shader, a slow
// domain-warped noise field lit like a glossy liquid. The shader is
// render/reference/owner-web-mockup.html's (the look the owner approved);
// what is new here is the driver around it, to the spec's rules (owner
// 2026-10-05, D):
// - low resolution: the canvas is LIQUID_SCALE of the window, stretched,
//   and steps down (LIQUID_SCALES) if the machine draws under 20 fps;
// - about 30 frames a second (LIQUID_FRAME_MS);
// - paused when the tab is hidden or the background isn't visible (the
//   sign-in screen covers it, or a plain background is chosen): no frames
//   are drawn and no animation frame is even requested while paused;
// - reduce motion keeps it still: one frame, redrawn only when the colours
//   change (theme or background) or the window is resized.
// The liquid's clock only runs while it draws, so coming back to the tab
// after an hour carries on where it was instead of jumping.
//
// If the browser has no WebGL (or loses the context), the canvas hides and
// the still gradient under it (siteLook.stillGradient, drawn by the page)
// is the background.

import {
  LIQUID_SCALE,
  LIQUID_WINDOW,
  canvasSize,
  easeDarkness,
  liquidColours,
  liquidPause,
  nextScale,
  shouldDrawFrame,
  type Background,
  type LiquidPause,
} from "./siteLook.js";

const VS = "attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}";
const FS = `precision highp float;uniform vec2 r;uniform float t;uniform float d;uniform vec3 c1;uniform vec3 c2;uniform vec3 c3;uniform vec3 c4;
vec2 h2(vec2 p){p=vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3)));return -1.+2.*fract(sin(p)*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);return mix(mix(dot(h2(i),f),dot(h2(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(h2(i+vec2(0,1)),f-vec2(0,1)),dot(h2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}
float fbm(vec2 p){float v=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<4;i++){v+=a*n2(p);p=m*p;a*=.5;}return v;}
float field(vec2 p){vec2 q=vec2(fbm(p+vec2(0.,t*.025)),fbm(p+vec2(5.2,1.3)-t*.021));vec2 w=vec2(fbm(p+2.6*q+vec2(1.7,9.2)+t*.022),fbm(p+2.6*q+vec2(8.3,2.8)-t*.026));return fbm(p+2.2*w);}
void main(){vec2 uv=gl_FragCoord.xy/r;vec2 p=uv*vec2(r.x/r.y,1.)*.95;
float f=field(p);float e=.01;float fx=field(p+vec2(e,0.))-f,fy=field(p+vec2(0.,e))-f;
vec3 n=normalize(vec3(-fx/e*.07,-fy/e*.07,1.));vec3 L=normalize(vec3(-.45,.55,.7));
float diff=dot(n,L)*.5+.5;float spec=pow(max(dot(reflect(-L,n),vec3(0.,0.,1.)),0.),18.);float rim=pow(1.-n.z,2.2);
float k=smoothstep(-.35,.45,f);vec3 col=mix(mix(c1,c2,smoothstep(-.5,.15,f)),mix(c3,c4,smoothstep(.1,.9,uv.x+f*.4)),k);
col*=mix(.93,.78,d)+mix(.11,.3,d)*diff;col+=spec*mix(.28,.2,d)*vec3(.95,.97,1.);col+=rim*mix(.10,.14,d)*mix(vec3(1.),vec3(.6,.7,1.),d);
float g=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);col+=(g-.5)*.018;
gl_FragColor=vec4(col,1.);}`;

/** What the liquid reads from the page each time it draws or refreshes. */
export interface LiquidSource {
  background(): Background;
  /** The theme the page draws is dark. */
  dark(): boolean;
  /** Something opaque covers the whole background (the sign-in screen). */
  covered(): boolean;
  reduceMotion(): boolean;
}

export interface LiquidStats {
  frames: number;
  pause: LiquidPause;
  width: number;
  height: number;
  darkness: number;
  /** The liquid's own clock, in seconds (it runs only while drawing). */
  clock: number;
  /** Animation frames requested and not yet run: 0 while paused. */
  pending: number;
  /** The canvas's scale of the window now (it steps down if slow). */
  scale: number;
  /** The last measured window's frames a second (null: none measured yet). */
  fps: number | null;
}

export interface Liquid {
  /** Re-read the page (theme, background, cover, reduce motion): start,
   * pause or redraw as they say. Call it after any of them changes. */
  refresh(): void;
  stats(): LiquidStats;
  stop(): void;
}

export function startLiquid(canvas: HTMLCanvasElement, src: LiquidSource): Liquid {
  let gl: WebGLRenderingContext | null = null;
  let uR: WebGLUniformLocation | null = null, uT: WebGLUniformLocation | null = null, uD: WebGLUniformLocation | null = null;
  let uC: (WebGLUniformLocation | null)[] = [];
  let raf = 0;
  let lastDrawn = -Infinity;
  let lastTick = 0;
  let clock = 0;
  let frames = 0;
  let darkness = src.dark() ? 1 : 0;
  let pause: LiquidPause = null;
  let stopped = false;
  let scale: number = LIQUID_SCALE;
  let fps: number | null = null;
  // The measuring window: frames drawn since it started, and when. It
  // restarts on every pause, so time paused never counts as slow.
  let winStart = 0, winFrames = 0;
  // What the still frame (reduce motion) last drew, so a refresh that
  // changes nothing draws nothing.
  let stillKey = "";

  function init(): boolean {
    gl = null;
    let ctx: WebGLRenderingContext | null = null;
    try {
      ctx = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, alpha: false, depth: false, stencil: false, powerPreference: "low-power" }) as WebGLRenderingContext | null;
    } catch {
      ctx = null;
    }
    if (!ctx) return false;
    const shader = (type: number, source: string) => {
      const s = ctx!.createShader(type);
      if (!s) return null;
      ctx!.shaderSource(s, source);
      ctx!.compileShader(s);
      return ctx!.getShaderParameter(s, ctx!.COMPILE_STATUS) ? s : null;
    };
    const v = shader(ctx.VERTEX_SHADER, VS), f = shader(ctx.FRAGMENT_SHADER, FS);
    const prog = ctx.createProgram();
    if (!v || !f || !prog) return false;
    ctx.attachShader(prog, v);
    ctx.attachShader(prog, f);
    ctx.linkProgram(prog);
    if (!ctx.getProgramParameter(prog, ctx.LINK_STATUS)) return false;
    ctx.useProgram(prog);
    const buf = ctx.createBuffer();
    ctx.bindBuffer(ctx.ARRAY_BUFFER, buf);
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
    const loc = ctx.getAttribLocation(prog, "a");
    ctx.enableVertexAttribArray(loc);
    ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
    uR = ctx.getUniformLocation(prog, "r");
    uT = ctx.getUniformLocation(prog, "t");
    uD = ctx.getUniformLocation(prog, "d");
    uC = ["c1", "c2", "c3", "c4"].map((n) => ctx!.getUniformLocation(prog, n));
    gl = ctx;
    size();
    return true;
  }

  function size(): void {
    const { width, height } = canvasSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, scale);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    gl?.viewport(0, 0, width, height);
  }

  function draw(): void {
    if (!gl) return;
    const colours = liquidColours(src.background(), darkness);
    if (!colours) return;
    colours.forEach((c, i) => gl!.uniform3f(uC[i]!, c[0], c[1], c[2]));
    gl.uniform2f(uR, canvas.width, canvas.height);
    gl.uniform1f(uT, clock);
    gl.uniform1f(uD, darkness);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    frames++;
  }

  function tick(now: number): void {
    raf = 0;
    if (stopped) return;
    pause = currentPause();
    if (pause !== null) return; // paused: no further frame is requested
    raf = requestAnimationFrame(tick);
    if (!shouldDrawFrame(now, lastDrawn, pause)) return;
    // The clock advances by the time between drawn frames, capped, so a
    // stall (a busy main thread, a background tab's throttling) never jumps it.
    const dt = now - lastTick;
    clock += Math.min(dt, 250) / 1000;
    lastTick = now;
    lastDrawn = now;
    darkness = easeDarkness(darkness, src.dark() ? 1 : 0, dt, false);
    draw();
    measure(now);
  }

  /** Counts drawn frames over a window; a slow window steps the scale down. */
  function measure(now: number): void {
    if (winFrames === 0) {
      winStart = now;
      winFrames = 1;
      return;
    }
    winFrames++;
    const span = now - winStart;
    if (winFrames < LIQUID_WINDOW.frames || span < LIQUID_WINDOW.ms) return;
    fps = ((winFrames - 1) * 1000) / span;
    const next = nextScale(scale, fps);
    winFrames = 0;
    if (next !== scale) {
      scale = next;
      size();
    }
  }

  function currentPause(): LiquidPause {
    return liquidPause({ webgl: !!gl, tabHidden: document.hidden, covered: src.covered(), plain: src.background().kind === "plain", reduceMotion: src.reduceMotion() });
  }

  function refresh(): void {
    if (stopped) return;
    pause = currentPause();
    canvas.hidden = pause === "no-webgl" || pause === "plain";
    if (pause !== null) winFrames = 0;
    if (pause !== "still") stillKey = "";
    if (pause === null) {
      if (!raf) {
        // Resuming: the clock carries on from where it stopped.
        lastTick = performance.now();
        raf = requestAnimationFrame(tick);
      }
      return;
    }
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    if (pause === "still") {
      // Reduce motion: one frame at the right colours, no fade; drawn again
      // only when the colours change.
      darkness = src.dark() ? 1 : 0;
      const key = `${src.background().id}|${darkness}|${canvas.width}x${canvas.height}`;
      if (key !== stillKey) {
        stillKey = key;
        draw();
      }
    }
  }

  const onResize = () => {
    size();
    // A resize clears the canvas: redraw it now, whatever the pause (a
    // hidden or covered canvas is redrawn when it shows again anyway).
    if (pause === null || pause === "still" || pause === "covered") draw();
    if (pause === "still") stillKey = `${src.background().id}|${darkness}|${canvas.width}x${canvas.height}`;
  };
  const onVisibility = () => refresh();
  const onLost = (e: Event) => {
    e.preventDefault();
    gl = null;
    refresh();
  };
  const onRestored = () => {
    init();
    refresh();
  };

  init();
  window.addEventListener("resize", onResize);
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  refresh();

  return {
    refresh,
    stats: () => ({ frames, pause, width: canvas.width, height: canvas.height, darkness, clock, pending: raf ? 1 : 0, scale, fps }),
    stop() {
      stopped = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    },
  };
}
