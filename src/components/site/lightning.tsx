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

  #define PI 3.14159265359
  #define LAYER_COUNT 5
  #define MAX_NODES_PER_LAYER 5

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

  int nodeCount(int layer) {
    if (layer == 0 || layer == LAYER_COUNT - 1) {
      return 3;
    }
    if (layer == 1 || layer == LAYER_COUNT - 2) {
      return 4;
    }
    return 5;
  }

  vec2 nodePosition(int layer, int node, float layerSpan, float ySpan) {
    int count = nodeCount(layer);
    float layerMix = float(layer) / float(LAYER_COUNT - 1);
    float local = 0.5;
    if (count > 1) {
      local = float(node) / float(count - 1);
    }

    float seed = float(layer * 37 + node * 19);
    float x = mix(-layerSpan, layerSpan, layerMix);
    x += (hash11(seed * 0.73) - 0.5) * 0.06;

    float arch = 0.92 + sin(layerMix * PI) * 0.08;
    float edgeBias = 1.0 - min(abs(local - 0.5) * 1.75, 1.0);
    float y = mix(-ySpan, ySpan, local) * arch;
    y += (hash11(seed * 1.91) - 0.5) * mix(0.04, 0.1, edgeBias);

    return vec2(x, y);
  }

  float segmentDistance(vec2 p, vec2 a, vec2 b, out float edgeT) {
    vec2 ab = b - a;
    float denom = max(dot(ab, ab), 0.0001);
    edgeT = clamp(dot(p - a, ab) / denom, 0.0, 1.0);
    vec2 closest = a + ab * edgeT;
    return length(p - closest);
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

    for (int i = 0; i < 3; ++i) {
      value += amplitude * noise(p);
      p *= rotate2d(0.45);
      p *= 2.0;
      amplitude *= 0.5;
    }

    return value;
  }

  int routeNode(float routeId, int layer) {
    int count = nodeCount(layer);
    float pick = hash11(routeId * 5.91 + float(layer) * 17.13);
    return min(count - 1, int(floor(pick * float(count))));
  }

  float lightningDistance(vec2 p, vec2 a, vec2 b, float seed, float timeBase, out float edgeT) {
    vec2 ab = b - a;
    float len = max(length(ab), 0.0001);
    vec2 dir = ab / len;
    vec2 normal = vec2(-dir.y, dir.x);
    edgeT = clamp(dot(p - a, dir) / len, 0.0, 1.0);

    float taper = sin(edgeT * PI);
    float coarse = fbm(vec2(edgeT * 4.8 + seed * 2.1, timeBase * 0.32 + seed * 1.7)) * 2.0 - 1.0;
    float fine = sin(edgeT * 28.0 + seed * 9.0 + timeBase * 15.0) * 0.22;
    float offset = (coarse * 0.78 + fine * 0.22) * mix(0.004, 0.028, taper);
    vec2 center = a + dir * (edgeT * len) + normal * offset;

    return length(p - center);
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv = 2.0 * uv - 1.0;

    float aspect = max(iResolution.x / max(iResolution.y, 1.0), 0.001);
    uv.x *= aspect;

    float sizeT = clamp((uSize - 0.5) / 2.5, 0.0, 1.0);
    float networkZoom = mix(1.06, 0.72, sizeT);
    uv *= networkZoom;
    uv.x -= uXOffset * 0.4;

    float timeBase = iTime * max(uSpeed, 0.0);
    float layerSpan = min(aspect * 0.68, 1.28);
    float ySpan = mix(0.6, 0.82, smoothstep(0.78, 1.45, aspect));
    float routeClock = timeBase * 1.38 + 0.12;
    float routeCycle = floor(routeClock);
    float routePhase = fract(routeClock);
    float routeBlend = smoothstep(0.0, 0.02, routePhase) * (1.0 - smoothstep(0.955, 0.995, routePhase));

    float nodeGlow = 0.0;
    float nodeCore = 0.0;
    float edgeGlow = 0.0;
    float signalGlow = 0.0;
    float signalCore = 0.0;
    float flashGlow = 0.0;
    float mist = 0.0;
    vec3 chroma = vec3(0.0);
    vec3 signalChroma = vec3(0.0);

    vec3 baseBlue = vec3(0.45, 0.68, 1.0);
    vec3 hotWhite = vec3(0.96, 0.99, 1.0);
    vec3 hueTint = hsv2rgb(vec3(uHue / 360.0, 0.26, 1.0));
    vec3 lightningColor = mix(baseBlue, hotWhite, 0.74);
    lightningColor = mix(lightningColor, hueTint, 0.14);

    for (int layer = 0; layer < LAYER_COUNT; ++layer) {
      int count = nodeCount(layer);
      int selectedNode = routeNode(routeCycle, layer);
      float layerHit = exp(-pow((routePhase - float(layer) / float(LAYER_COUNT - 1)) / 0.058, 2.0));

      for (int node = 0; node < MAX_NODES_PER_LAYER; ++node) {
        if (node >= count) {
          continue;
        }

        vec2 current = nodePosition(layer, node, layerSpan, ySpan);
        float d = length(uv - current);
        float radius = mix(0.045, 0.07, hash11(float(layer * 19 + node * 13)));
        float core = exp(-pow(d / radius, 2.25));
        float aura = exp(-pow(d / (radius * 2.7), 2.0));
        float twinkle = 0.92 + 0.08 * sin(timeBase * 1.7 + float(layer * 9 + node * 5));

        nodeCore += core * 0.16 * twinkle;
        nodeGlow += aura * 0.20;
        chroma += hueTint * aura * 0.055;

        if (node == selectedNode) {
          float nodeCharge = layerHit * routeBlend;
          signalCore += core * nodeCharge * 0.95;
          signalGlow += aura * nodeCharge * 0.72;
          signalChroma += lightningColor * aura * nodeCharge * 0.78;
          mist += aura * nodeCharge * 0.05;
        }

        mist += aura * 0.03;

        if (layer < LAYER_COUNT - 1) {
          int nextCount = nodeCount(layer + 1);
          int selectedNextNode = routeNode(routeCycle, layer + 1);
          float segmentTravel = routePhase * float(LAYER_COUNT - 1) - float(layer);
          float segmentOn = smoothstep(0.0, 0.025, segmentTravel) * (1.0 - smoothstep(1.0, 1.12, segmentTravel));
          float headPos = clamp(segmentTravel, 0.0, 1.0);
          float completedSegment = smoothstep(1.0, 1.04, segmentTravel) * (1.0 - smoothstep(1.22, 1.42, segmentTravel));

          for (int nextNode = 0; nextNode < MAX_NODES_PER_LAYER; ++nextNode) {
            if (nextNode >= nextCount) {
              continue;
            }

            vec2 next = nodePosition(layer + 1, nextNode, layerSpan, ySpan);
            float seed = float(layer * 97 + node * 17 + nextNode * 29);
            float edgeT;
            float baseDist = segmentDistance(uv, current, next, edgeT);
            float baseWidth = mix(0.013, 0.022, hash11(seed * 1.91));
            float baseline = exp(-baseDist / baseWidth) * 0.055;

            edgeGlow += baseline;
            chroma += hueTint * baseline * 0.15;

            if (node == selectedNode && nextNode == selectedNextNode) {
              float signalT;
              float signalDist = lightningDistance(uv, current, next, seed, timeBase, signalT);
              float activeCore = exp(-signalDist / 0.0105);
              float activeAura = exp(-signalDist / 0.030);
              float head = exp(-pow((signalT - headPos) / 0.082, 2.0));
              float trail = exp(-6.5 * max(headPos - signalT, 0.0)) * step(signalT, headPos);
              float segmentTail = exp(-2.8 * max(headPos - signalT, 0.0));
              float flickerFrame = floor((routePhase + timeBase * 0.45) * 120.0);
              float microFlicker = mix(0.92, 1.10, hash11(flickerFrame + seed * 13.0));
              float persistent = (0.18 * trail + 0.12 * segmentTail) * segmentOn;
              float energy = (segmentOn * (1.45 * head + 0.72 * trail) + completedSegment * 0.24 + persistent) * microFlicker * routeBlend;

              signalCore += activeCore * energy * 1.18;
              signalGlow += (0.26 * activeCore + 0.36 * activeAura) * energy;
              flashGlow += activeAura * max(head, trail * 0.56) * routeBlend * 0.92;
              signalChroma += lightningColor * (0.34 * activeCore + 0.32 * activeAura) * energy;
              signalChroma += hotWhite * activeCore * head * 0.34 * routeBlend;
              mist += activeAura * energy * 0.05;
            }
          }
        }
      }
    }

    vec3 networkColor = mix(baseBlue, hueTint, 0.34);

    vec3 col = vec3(0.0);
    col += chroma * 0.34 * uIntensity;
    col += networkColor * edgeGlow * 0.36 * uIntensity;
    col += hotWhite * nodeCore * 0.14 * uIntensity;
    col += lightningColor * signalGlow * 1.12 * uIntensity;
    col += hotWhite * pow(max(signalCore - 0.12, 0.0), 1.08) * 0.82 * uIntensity;
    col += signalChroma * 1.56 * uIntensity;
    col += hotWhite * flashGlow * 0.56 * uIntensity;
    col += networkColor * mist * 0.26 * uIntensity;
    col = 1.0 - exp(-col);

    float vignette = 1.0 - smoothstep(
      1.3,
      2.0,
      length(vec2(uv.x / max(layerSpan, 0.001), uv.y / max(ySpan, 0.001)))
    );
    float alpha = clamp(
      (edgeGlow * 0.28 + nodeGlow * 0.22 + signalGlow * 1.05 + signalCore * 0.75 + flashGlow * 0.60) * (0.45 + 0.70 * uIntensity),
      0.0,
      0.98
    );

    col *= vignette;
    fragColor = vec4(col, alpha * vignette);
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
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

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
