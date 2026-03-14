import React, { useRef, useEffect } from 'react';

interface LightningProps {
  hue?: number;
  xOffset?: number;
  speed?: number;
  intensity?: number;
  size?: number;
}

const Lightning: React.FC<LightningProps> = ({ hue = 230, xOffset = 0, speed = 1, intensity = 1, size = 1 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const gl = canvas.getContext('webgl');
    if (!gl) {
      console.error('WebGL not supported');
      return () => {
        window.removeEventListener('resize', resizeCanvas);
      };
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

      vec3 hsv2rgb(vec3 c) {
        vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
          return c.z * mix(vec3(1.0), rgb, c.y);
      }

      float hash12(vec2 p) {
        vec3 p3 = fract(vec3(p.xyx) * 0.1031);
          p3 += dot(p3, p3.yzx + 33.33);
          return fract((p3.x + p3.y) * p3.z);
      }

      vec2 getNode(vec2 cell) {
        float jx = hash12(cell + vec2(12.3, 4.7)) - 0.5;
        float jy = hash12(cell + vec2(2.1, 19.6)) - 0.5;
        return cell + vec2(jx, jy) * 0.55;
      }

      float segmentDistance(vec2 p, vec2 a, vec2 b, out float t) {
        vec2 ab = b - a;
        float den = max(dot(ab, ab), 0.0001);
        t = clamp(dot(p - a, ab) / den, 0.0, 1.0);
        vec2 closest = a + ab * t;
        return length(p - closest);
      }

      void accumulateEdge(vec2 p, vec2 a, vec2 b, float phase, inout float edgeGlow, inout float pulseGlow) {
        float t;
        float d = segmentDistance(p, a, b, t);
        float edge = exp(-pow(d / 0.045, 2.0));
        edgeGlow += edge;

        float signal = 0.5 + 0.5 * sin((t * 10.0 - iTime * uSpeed * 3.5) + phase);
        pulseGlow += edge * pow(signal, 6.0);
      }

      void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
          vec2 uv = fragCoord / iResolution.xy;
          uv = 2.0 * uv - 1.0;
          uv.x *= iResolution.x / iResolution.y;
          uv.x += uXOffset;

        float zoom = max(uSize, 0.35) * 1.8;
        uv *= zoom;

        float nodeGlow = 0.0;
        float edgeGlow = 0.0;
        float pulseGlow = 0.0;

        for (int ix = 0; ix < 7; ++ix) {
          for (int iy = 0; iy < 5; ++iy) {
            vec2 cell = vec2(float(ix) - 3.0, float(iy) - 2.0);
            vec2 center = getNode(cell);

            float nodeDist = length(uv - center);
            nodeGlow += exp(-pow(nodeDist / 0.12, 2.0)) * 0.9;

            vec2 right = getNode(cell + vec2(1.0, 0.0));
            vec2 up = getNode(cell + vec2(0.0, 1.0));
            float phase = hash12(cell) * 6.2831853;
            accumulateEdge(uv, center, right, phase, edgeGlow, pulseGlow);
            accumulateEdge(uv, center, up, phase + 1.7, edgeGlow, pulseGlow);
          }
        }

        vec3 baseColor = hsv2rgb(vec3(uHue / 360.0, 0.65, 1.0));
        vec3 bgTint = hsv2rgb(vec3(uHue / 360.0, 0.25, 0.08));

        vec3 color = bgTint;
        color += baseColor * (0.10 * edgeGlow + 0.26 * nodeGlow + 0.55 * pulseGlow) * uIntensity;
        color = 1.0 - exp(-color);

        fragColor = vec4(color, 1.0);
      }

      void main() {
          mainImage(gl_FragColor, gl_FragCoord.xy);
      }
    `;

    const compileShader = (source: string, type: number): WebGLShader | null => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    let frameId = 0;
    let vertexShader: WebGLShader | null = null;
    let fragmentShader: WebGLShader | null = null;
    let program: WebGLProgram | null = null;
    let vertexBuffer: WebGLBuffer | null = null;

    const cleanup = () => {
      window.removeEventListener('resize', resizeCanvas);
      if (frameId) cancelAnimationFrame(frameId);
      if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
      if (program) gl.deleteProgram(program);
      if (vertexShader) gl.deleteShader(vertexShader);
      if (fragmentShader) gl.deleteShader(fragmentShader);
    };

    vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);
    if (!vertexShader || !fragmentShader) return cleanup;

    program = gl.createProgram();
    if (!program) return cleanup;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program linking error:', gl.getProgramInfoLog(program));
      return cleanup;
    }
    gl.useProgram(program);

    const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]);
    vertexBuffer = gl.createBuffer();
    if (!vertexBuffer) return cleanup;
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    if (aPosition < 0) return cleanup;
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

    const iResolutionLocation = gl.getUniformLocation(program, 'iResolution');
    const iTimeLocation = gl.getUniformLocation(program, 'iTime');
    const uHueLocation = gl.getUniformLocation(program, 'uHue');
    const uXOffsetLocation = gl.getUniformLocation(program, 'uXOffset');
    const uSpeedLocation = gl.getUniformLocation(program, 'uSpeed');
    const uIntensityLocation = gl.getUniformLocation(program, 'uIntensity');
    const uSizeLocation = gl.getUniformLocation(program, 'uSize');

    if (
      !iResolutionLocation ||
      !iTimeLocation ||
      !uHueLocation ||
      !uXOffsetLocation ||
      !uSpeedLocation ||
      !uIntensityLocation ||
      !uSizeLocation
    ) {
      console.error('Could not find one or more shader uniforms');
      return cleanup;
    }

    const startTime = performance.now();
    const render = () => {
      resizeCanvas();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.0, 0.0, 0.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(iResolutionLocation, canvas.width, canvas.height);
      const currentTime = performance.now();
      gl.uniform1f(iTimeLocation, (currentTime - startTime) / 1000.0);
      gl.uniform1f(uHueLocation, hue);
      gl.uniform1f(uXOffsetLocation, xOffset);
      gl.uniform1f(uSpeedLocation, speed);
      gl.uniform1f(uIntensityLocation, intensity);
      gl.uniform1f(uSizeLocation, size);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);

    return cleanup;
  }, [hue, xOffset, speed, intensity, size]);

  return <canvas ref={canvasRef} className="w-full h-full relative" />;
};

export default Lightning;
