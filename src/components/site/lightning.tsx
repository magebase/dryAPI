"use client";

import { useEffect, useRef } from "react";

interface LightningProps {
  hue?: number;
  xOffset?: number;
  speed?: number;
  intensity?: number;
  size?: number;
  className?: string;
}

const vertexShaderSource = `
  attribute vec2 aPosition;
  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const fragmentShaderSource = `
  precision mediump float;
  uniform vec2 iResolution;
  uniform float iTime;
  uniform float uHue;
  uniform float uXOffset;
  uniform float uSpeed;
  uniform float uIntensity;
  uniform float uSize;

  #define OCTAVE_COUNT 2
  #define STRIKE_COUNT 2
  #define BRANCH_COUNT 2

  vec3 hsv2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), rgb, c.y);
  }

  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  mat2 rotate2d(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat2(c, -s, s, c);
  }

  float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float a = hash12(ip);
    float b = hash12(ip + vec2(1.0, 0.0));
    float c = hash12(ip + vec2(0.0, 1.0));
    float d = hash12(ip + vec2(1.0, 1.0));

    vec2 t = smoothstep(0.0, 1.0, fp);
    return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < OCTAVE_COUNT; ++i) {
      value += amplitude * noise(p);
      p *= rotate2d(0.45);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  float strikeCurve(float y, float seed, float t, float amp) {
    float p = y * 1.9 + seed * 3.7;
    float coarse = fbm(vec2(p * 1.4, t * 0.36 + seed * 5.2)) * 2.0 - 1.0;
    float fine = fbm(vec2(p * 3.4 - t * 0.22, seed * 11.4)) * 2.0 - 1.0;
    return (coarse * 0.72 + fine * 0.28) * amp;
  }

  float pathPattern(float y, float seed, float t, float amp, float patternSel) {
    float yScale = mix(0.93, 1.07, patternSel);
    float timeScale = mix(0.95, 1.05, patternSel);
    float ampScale = mix(0.90, 1.10, patternSel);
    float seedShift = mix(0.0, 7.0, patternSel);
    return strikeCurve(y * yScale, seed + seedShift, t * timeScale, amp * ampScale);
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv = 2.0 * uv - 1.0;
    uv.x *= iResolution.x / iResolution.y;
    float t = iTime * max(uSpeed, 0.0) * 0.18;

    float glow = 0.0;
    float core = 0.0;
    float cloud = 0.0;
    vec3 chroma = vec3(0.0);
    vec3 flashChroma = vec3(0.0);
    vec3 cloudChroma = vec3(0.0);

    for (int i = 0; i < STRIKE_COUNT; ++i) {
      float fi = float(i);
      float seed = fi * 19.31 + 2.71;
      float primary = 1.0 - step(0.5, fi);
      float strikeClock = t * 2.6 + fi * 0.5;
      float strikeId = floor(strikeClock);
      float strikePhase = fract(strikeClock);

      float lane = (fi + 0.5) / float(STRIKE_COUNT);
      float laneRandom = hash11(strikeId * 5.73 + seed * 2.41);
      float jitter = (hash11((strikeId + 1.0) * 11.7 + seed) - 0.5) * (1.8 / float(STRIKE_COUNT));
      float spread = clamp(mix(lane, laneRandom, 0.92) + jitter, 0.01, 0.99);
      float primarySpread = mix(0.18, 0.82, hash11(strikeId * 3.17 + seed * 0.37));
      spread = mix(spread, primarySpread, primary);
      float trunkX = uXOffset + mix(-1.84, 1.84, spread);

      float patternSel = hash11(strikeId * 1.37 + seed * 7.9);
      float endY = mix(-0.12, -1.0, hash11(seed * 5.3 + strikeId));
      float endPrimary = mix(-0.72, -1.0, hash11(seed * 8.3 + strikeId * 0.17));
      endY = mix(endY, endPrimary, primary);
      float trunkRange = (1.0 - smoothstep(0.95, 1.2, uv.y)) * smoothstep(endY - 0.03, endY + 0.03, uv.y);

      // Draw a fast but noticeable strike head traveling from top toward endY.
      float drawDuration = mix(0.10, 0.18, hash11(seed * 6.9 + strikeId * 0.31));
      drawDuration = mix(drawDuration, 0.14, primary);
      float drawProgress = smoothstep(0.0, drawDuration, strikePhase);
      float steppedProgress = floor(drawProgress * 10.0) / 10.0;
      float headY = mix(1.02, endY, steppedProgress);
      float drawMask = smoothstep(headY - 0.028, headY + 0.028, uv.y);
      float headGlow = exp(-abs(uv.y - headY) / 0.04) * (1.0 - 0.35 * drawProgress);

      // Keep a faint persistent primary trunk to avoid full-black frames.
      float primaryPersist = primary * 0.12 * smoothstep(0.0, 0.06, strikePhase) * (1.0 - smoothstep(0.58, 0.72, strikePhase));
      float yMask = trunkRange * max(drawMask, primaryPersist);

      float path = trunkX + pathPattern(uv.y, seed, t, 0.19 * uSize, patternSel);
      float dist = abs(uv.x - path);
      float width = mix(0.0042, 0.0105, smoothstep(-1.0, 0.45, uv.y));
      width *= mix(0.70, 1.24, smoothstep(-1.0, 0.9, uv.y));

      float hueShift = (hash11(strikeId * 4.19 + seed * 12.7) - 0.5) * 18.0;
      float sat = mix(0.14, 0.32, hash11(seed * 3.5 + strikeId));
      float val = mix(0.92, 1.0, hash11(seed * 7.1 + strikeId * 0.5));
      vec3 strikeColor = hsv2rgb(vec3((uHue + hueShift) / 360.0, sat, val));

      float pulse = 0.32 + 0.68 * hash11(strikeId * 9.1 + seed * 3.1);
      float leader = smoothstep(0.0, 0.045, strikePhase) * (1.0 - smoothstep(0.08, 0.16, strikePhase));
      float returnStroke = smoothstep(0.055, 0.080, strikePhase) * (1.0 - smoothstep(0.13, 0.21, strikePhase));
      float tail = exp(-12.5 * max(strikePhase - 0.14, 0.0));
      tail *= (1.0 - smoothstep(0.52, 0.62, strikePhase));

      float restrikeChance = step(0.82, hash11(strikeId * 3.71 + seed * 6.11));
      float restrikeAt = 0.17 + 0.07 * hash11(strikeId * 7.17 + seed * 2.93);
      float restrike = restrikeChance * 0.32 * exp(-pow((strikePhase - restrikeAt) / 0.020, 2.0));

      float flickerFrame = floor((strikePhase + t * 0.35) * 90.0);
      float microFlicker = mix(0.92, 1.06, hash11(flickerFrame + seed * 13.0));
      float envelope = 0.20 * leader + 1.95 * returnStroke + 0.30 * tail + restrike;
      float energy = envelope * pulse * microFlicker;
      float sustainedPrimary = primary * 0.012;
      energy = max(energy, sustainedPrimary);

      float trunkCore = exp(-dist / max(width * 0.30, 0.0007)) * yMask;
      float trunkAura = exp(-dist / max(width * 2.2, 0.0012)) * yMask;
      core += trunkCore * (energy + 0.28 * returnStroke * pulse + 0.08 * headGlow);
      float flashWindow = returnStroke + restrike;
      float trunkLight = (0.18 * trunkCore + 0.14 * trunkAura) * energy;
      glow += trunkLight;
      chroma += strikeColor * trunkLight;

      float cloudLightA = exp(-abs(uv.x - trunkX) / 0.35) * yMask * 0.024 * flashWindow * pulse;
      float cloudLightB = exp(-abs(uv.y - endY) / 0.30) * 0.015 * flashWindow * pulse;
      cloud += cloudLightA + cloudLightB;
      cloudChroma += mix(strikeColor, vec3(0.82, 0.9, 1.0), 0.55) * (cloudLightA + cloudLightB);

      for (int j = 0; j < BRANCH_COUNT; ++j) {
        float fj = float(j);
        float bSeed = seed * 3.4 + fj * 7.9 + strikeId * 0.7;
        float direction = hash11(bSeed) > 0.5 ? 1.0 : -1.0;
        float branchStart = mix(0.75, -0.2, hash11(bSeed * 0.9));
        float branchLength = mix(0.16, 0.55, hash11(bSeed * 2.1));
        float branchEnd = branchStart - branchLength;
        float branchMask = (1.0 - smoothstep(branchStart, branchStart + 0.03, uv.y)) * smoothstep(branchEnd - 0.03, branchEnd + 0.03, uv.y);

        float branchSlope = direction * 0.34 * (branchStart - uv.y);
        float branchPath = path + branchSlope;
        float branchDist = abs(uv.x - branchPath);
        float branchWidth = width * (0.62 + fj * 0.08);
        float branchCore = exp(-branchDist / max(branchWidth * 0.44, 0.001));
        float branchTemporal = smoothstep(0.10, 0.18, strikePhase) * (1.0 - smoothstep(0.28, 0.46, strikePhase));
        float branchLight = 0.12 * branchCore * branchMask * branchTemporal * energy;
        glow += branchLight;
        chroma += strikeColor * branchLight * 1.05;
      }

      flashChroma += mix(strikeColor, vec3(1.0), 0.72) * trunkCore * flashWindow * 0.70;
    }

    vec3 baseBlue = vec3(0.45, 0.68, 1.0);
    vec3 hotWhite = vec3(0.95, 0.98, 1.0);
    vec3 hueTint = hsv2rgb(vec3(uHue / 360.0, 0.22, 1.0));
    vec3 lightningColor = mix(baseBlue, hotWhite, 0.74);
    lightningColor = mix(lightningColor, hueTint, 0.14);

    float edgeFadeX = 1.0 - smoothstep(2.2, 3.2, abs(uv.x));
    float edgeFadeY = 1.0 - smoothstep(1.05, 1.55, abs(uv.y));
    float edgeFade = clamp(edgeFadeX * edgeFadeY, 0.0, 1.0);
    vec3 dynamicColor = mix(lightningColor, chroma / max(glow, 0.0001), 0.6);
    vec3 col = dynamicColor * glow * uIntensity * 1.22;
    col += hotWhite * pow(max(core - 0.75, 0.0), 1.22) * 1.05 * uIntensity;
    col += cloudChroma * 0.78 * uIntensity;
    col += flashChroma * 0.42 * uIntensity;
    col *= edgeFade;
    fragColor = vec4(col, 1.0);
  }

  void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
  }
`;

function compileShader(
  gl: WebGLRenderingContext,
  source: string,
  type: number,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("Shader compile error:", gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export function Lightning({
  hue = 260,
  xOffset = 0,
  speed = 1,
  intensity = 3.0,
  size = 2,
  className,
}: LightningProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const reducedMotionQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let prefersReducedMotion = reducedMotionQuery.matches;

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) {
      return;
    }

    const vertexShader = compileShader(
      gl,
      vertexShaderSource,
      gl.VERTEX_SHADER,
    );
    const fragmentShader = compileShader(
      gl,
      fragmentShaderSource,
      gl.FRAGMENT_SHADER,
    );
    if (!vertexShader || !fragmentShader) {
      return;
    }

    const program = gl.createProgram();
    if (!program) {
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program linking error:", gl.getProgramInfoLog(program));
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    gl.useProgram(program);

    const vertices = new Float32Array([
      -1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1,
    ]);
    const vertexBuffer = gl.createBuffer();
    if (!vertexBuffer) {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      return;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, "aPosition");
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const iResolutionLocation = gl.getUniformLocation(program, "iResolution");
    const iTimeLocation = gl.getUniformLocation(program, "iTime");
    const uHueLocation = gl.getUniformLocation(program, "uHue");
    const uXOffsetLocation = gl.getUniformLocation(program, "uXOffset");
    const uSpeedLocation = gl.getUniformLocation(program, "uSpeed");
    const uIntensityLocation = gl.getUniformLocation(program, "uIntensity");
    const uSizeLocation = gl.getUniformLocation(program, "uSize");

    const resizeCanvas = () => {
      const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 1);
      const width = Math.max(
        1,
        Math.floor(canvas.clientWidth * devicePixelRatio),
      );
      const height = Math.max(
        1,
        Math.floor(canvas.clientHeight * devicePixelRatio),
      );

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const startTime = performance.now();
    let animationFrameId = 0;
    let lastFrameTime = 0;
    const frameIntervalMs = 1000 / 45;

    const renderFrame = () => {
      resizeCanvas();
      gl.viewport(0, 0, canvas.width, canvas.height);

      if (iResolutionLocation) {
        gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);
      }
      if (iTimeLocation) {
        gl.uniform1f(
          iTimeLocation,
          prefersReducedMotion ? 0 : (performance.now() - startTime) / 1000,
        );
      }
      if (uHueLocation) {
        gl.uniform1f(uHueLocation, hue);
      }
      if (uXOffsetLocation) {
        gl.uniform1f(uXOffsetLocation, xOffset);
      }
      if (uSpeedLocation) {
        gl.uniform1f(
          uSpeedLocation,
          prefersReducedMotion ? speed * 0.2 : speed,
        );
      }
      if (uIntensityLocation) {
        gl.uniform1f(
          uIntensityLocation,
          prefersReducedMotion ? Math.min(intensity, 0.9) : intensity,
        );
      }
      if (uSizeLocation) {
        gl.uniform1f(uSizeLocation, size);
      }

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const runLoop = (timestamp: number) => {
      if (prefersReducedMotion) {
        renderFrame();
        return;
      }

      if (timestamp - lastFrameTime >= frameIntervalMs) {
        lastFrameTime = timestamp;
        renderFrame();
      }

      animationFrameId = requestAnimationFrame(runLoop);
    };

    const handleReducedMotionChange = (event: MediaQueryListEvent) => {
      prefersReducedMotion = event.matches;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = 0;
      }
      if (prefersReducedMotion) {
        renderFrame();
      } else {
        lastFrameTime = 0;
        animationFrameId = requestAnimationFrame(runLoop);
      }
    };

    const handleResize = () => {
      resizeCanvas();
      if (prefersReducedMotion) {
        renderFrame();
      }
    };

    if (prefersReducedMotion) {
      renderFrame();
    } else {
      animationFrameId = requestAnimationFrame(runLoop);
    }
    window.addEventListener("resize", handleResize);
    reducedMotionQuery.addEventListener("change", handleReducedMotionChange);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      reducedMotionQuery.removeEventListener(
        "change",
        handleReducedMotionChange,
      );
      gl.deleteBuffer(vertexBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [hue, intensity, size, speed, xOffset]);

  return (
    <canvas
      aria-hidden
      className={["relative h-full w-full", className]
        .filter(Boolean)
        .join(" ")}
      ref={canvasRef}
    />
  );
}
