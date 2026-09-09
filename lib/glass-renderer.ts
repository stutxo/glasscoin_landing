import { createCoinMotion, inverseCoinRotation } from './coin-motion';

const VERTEX = `
attribute vec2 a_position;
varying vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 v_uv;
uniform sampler2D u_coin;
uniform sampler2D u_cipher;
uniform vec2 u_pointer;
uniform mat3 u_inverseRotation;
uniform float u_presence;
uniform float u_time;

const float RADIUS = 0.412;
const float HALF_DEPTH = 0.022;
const float PI = 3.14159265;

vec3 intoCoin(vec3 point) {
  return u_inverseRotation * point;
}

vec2 faceCoordinates(vec2 point) {
  // Measured face bounds remove the source image's padding and tiny aspect
  // mismatch. Geometry is a centered circle, facing the camera at rest.
  return vec2(0.498405, 0.513158) + point * vec2(0.427831, 0.431818) / RADIUS;
}

vec3 glassLight() {
  // The light stays in world space as the coin rotates beneath it.
  return normalize(intoCoin(vec3(-0.5 + sin(u_time * 0.22) * 0.1, 0.8, 1.2)));
}

vec3 glassGlimmer(vec3 normal, vec3 ray) {
  // Reflect a tall studio light in the surface. Its slow drift reveals the
  // glass even at rest; Fresnel reflection strengthens the grazing edges.
  vec3 reflected = reflect(ray, normal);
  vec3 light = normalize(intoCoin(vec3(sin(u_time * 0.19 - 0.6) * 0.65, 0.12, 1.4)));
  vec3 right = normalize(cross(intoCoin(vec3(0.22, 1.0, 0.0)), light));
  vec3 up = cross(light, right);
  float forward = dot(reflected, light);
  vec2 projected = vec2(dot(reflected, right), dot(reflected, up)) / max(forward, 0.2);
  float height = (1.0 - smoothstep(0.45, 0.7, abs(projected.y))) * smoothstep(0.1, 0.3, forward);
  float strip = (1.0 - smoothstep(0.035, 0.085, abs(projected.x))) * height;
  float halo = (1.0 - smoothstep(0.06, 0.2, abs(projected.x))) * height;
  float fresnel = 0.04 + 0.96 * pow(1.0 - clamp(dot(normal, -ray), 0.0, 1.0), 5.0);
  vec3 halfway = normalize(glassLight() - ray);
  float reflection = max(0.0, dot(normal, halfway));
  float highlight = strip * 0.18 * (0.4 + 0.6 * fresnel) + halo * 0.01;
  highlight += pow(reflection, 90.0) * 0.028;
  return vec3(0.91, 0.96, 1.0) * highlight;
}

vec2 edgeCoordinates(float angle, float depth) {
  float ringRadius = RADIUS - 0.012 * sin(PI * depth);
  return faceCoordinates(vec2(cos(angle), sin(angle)) * ringRadius);
}

// Intersect the glass disc in object space, including its curved edge.
vec4 intersectCoin(vec3 origin, vec3 ray) {
  float nearest = 100.0;
  float surface = 0.0;
  if (abs(ray.z) > 0.00001) {
    float front = (HALF_DEPTH - origin.z) / ray.z;
    vec2 frontPoint = origin.xy + ray.xy * front;
    if (front > 0.0 && dot(frontPoint, frontPoint) <= RADIUS * RADIUS) {
      nearest = front;
      surface = 1.0;
    }
    float back = (-HALF_DEPTH - origin.z) / ray.z;
    vec2 backPoint = origin.xy + ray.xy * back;
    if (back > 0.0 && back < nearest && dot(backPoint, backPoint) <= RADIUS * RADIUS) {
      nearest = back;
      surface = -1.0;
    }
  }
  float a = dot(ray.xy, ray.xy);
  float b = dot(origin.xy, ray.xy);
  float c = dot(origin.xy, origin.xy) - RADIUS * RADIUS;
  float discriminant = b * b - a * c;
  if (a > 0.000001 && discriminant >= 0.0) {
    float root = sqrt(discriminant);
    float sideNear = (-b - root) / a;
    float nearZ = origin.z + ray.z * sideNear;
    if (sideNear > 0.0 && sideNear < nearest && abs(nearZ) <= HALF_DEPTH) {
      nearest = sideNear;
      surface = 2.0;
    }
    float sideFar = (-b + root) / a;
    float farZ = origin.z + ray.z * sideFar;
    if (sideFar > 0.0 && sideFar < nearest && abs(farZ) <= HALF_DEPTH) {
      nearest = sideFar;
      surface = 2.0;
    }
  }
  return vec4(origin + ray * nearest, surface);
}

void main() {
  vec2 uv = v_uv;
  vec3 origin = intoCoin(vec3(0.0, 0.0, 2.522));
  vec3 ray = intoCoin(normalize(vec3(uv - 0.5, -2.5)));
  vec4 hit = intersectCoin(origin, ray);
  if (hit.w == 0.0) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    return;
  }

  vec2 delta = uv - u_pointer;
  float distanceToPointer = length(delta);
  float lens = (1.0 - smoothstep(0.015, 0.19, distanceToPointer)) * u_presence;
  vec2 direction = delta / max(distanceToPointer, 0.0001);
  float wave = sin(distanceToPointer * 67.0 - u_time * 2.5);
  vec2 flow = vec2(sin(uv.y * 33.0 + u_time * 1.2), cos(uv.x * 29.0 - u_time));
  vec2 offset = (direction * (0.034 * lens + wave * 0.012) + flow * 0.010) * lens;

  if (hit.w == 2.0) {
    // Both ends of the edge meet the same face perimeter. Sample a narrow
    // strip for thickness; do not unwrap the entire front bevel into the side.
    float angle = atan(hit.y, hit.x);
    float depth = (hit.z / HALF_DEPTH + 1.0) * 0.5;
    vec3 normal = normalize(vec3(hit.xy, 0.0));
    vec3 tangent = vec3(-normal.y, normal.x, 0.0);
    float edgeBlend = smoothstep(0.0, 0.2, depth) * (1.0 - smoothstep(0.8, 1.0, depth));
    float edgeFacing = smoothstep(0.08, 0.4, abs(dot(ray, normal)));
    vec3 edgeRay = intoCoin(normalize(vec3(uv + offset * 0.65 * edgeFacing - 0.5, -2.5)));
    float denominator = dot(edgeRay, normal);
    float angleShift = 0.0;
    float depthShift = 0.0;
    if (abs(denominator) > 0.06) {
      float edgeT = dot(hit.xyz - origin, normal) / denominator;
      if (edgeT > 0.0) {
        vec3 displacement = origin + edgeRay * edgeT - hit.xyz;
        angleShift = clamp(dot(displacement, tangent), -0.025, 0.025) / RADIUS;
        depthShift = clamp(displacement.z / (2.0 * HALF_DEPTH), -0.16, 0.16);
      }
    }
    // Preserve the silhouette and both face joins while the glass within them
    // bends. Angular travel uses sin/cos, so it has no seam at a full rotation.
    angleShift *= edgeBlend * edgeFacing;
    depthShift *= edgeBlend * edgeFacing;
    float warpedDepth = clamp(depth + depthShift, 0.0, 1.0);
    vec2 ringUV = edgeCoordinates(angle + angleShift, warpedDepth);
    vec2 chromatic = (ringUV - edgeCoordinates(angle, depth)) * 0.055;
    vec3 rim;
    rim.r = texture2D(u_coin, ringUV + chromatic).r;
    rim.g = texture2D(u_coin, ringUV).g;
    rim.b = texture2D(u_coin, ringUV - chromatic).b;
    vec3 light = glassLight();
    float lightAmount = 0.5 + 0.4 * max(0.0, dot(normal, light));
    float glint = pow(max(0.0, dot(reflect(ray, normal), light)), 28.0);
    vec3 color = rim * mix(0.92, lightAmount, edgeBlend) + vec3(0.55, 0.65, 0.72) * glint * 0.24 * edgeBlend;
    float edgeReveal = lens * edgeBlend * edgeFacing;
    vec2 underGlass = faceCoordinates(hit.xy - normal.xy * 0.022 + tangent.xy * angleShift * RADIUS);
    vec3 cipher = texture2D(u_cipher, underGlass).rgb * vec3(0.68, 0.84, 0.93) * edgeReveal * 0.22;
    color *= 1.0 - edgeReveal * 0.12;
    color = 1.0 - (1.0 - color) * (1.0 - cipher);
    // Keep specular highlights tied to surface orientation, not the cursor.
    float bevel = 1.0 - edgeBlend;
    vec3 bevelNormal = normalize(vec3(normal.xy * (1.0 - 0.15 * bevel), (depth * 2.0 - 1.0) * 0.65 * bevel));
    color += glassGlimmer(bevelNormal, ray);
    float gray = dot(color, vec3(0.299, 0.587, 0.114));
    gl_FragColor = vec4(mix(vec3(gray), color, 0.42), 1.0);
    return;
  }

  // The reverse is seen through the glass, so the Bitcoin mark is mirrored.
  vec2 faceUV = faceCoordinates(hit.xy);
  // Refract in screen space, then project onto the actual rotating face.
  // This keeps the glass attached to the coin as it turns. At grazing angles,
  // reduce the lens before the projection can stretch across the whole face.
  float faceVisibility = smoothstep(0.045, 0.25, abs(ray.z));
  // Foreshorten the screen-space displacement smoothly, retaining a bounded
  // surface displacement instead of switching the glass off at side angles.
  float projectionScale = mix(0.12, 1.0, abs(ray.z)) * faceVisibility;
  vec3 lensRay = intoCoin(normalize(vec3(uv + offset * projectionScale - 0.5, -2.5)));
  float surfaceZ = hit.w * HALF_DEPTH;
  vec2 displacedPoint = hit.xy;
  if (abs(lensRay.z) > 0.04) {
    float lensT = (surfaceZ - origin.z) / lensRay.z;
    vec2 candidate = origin.xy + lensRay.xy * lensT;
    if (lensT > 0.0) {
      vec2 displacement = candidate - hit.xy;
      displacedPoint += displacement * min(1.0, 0.055 / max(length(displacement), 0.0001));
    }
  }
  vec2 surfaceOffset = faceCoordinates(displacedPoint) - faceUV;
  vec2 refracted = clamp(faceUV + surfaceOffset, 0.001, 0.999);
  float silhouette = 1.0 - smoothstep(RADIUS * 0.91, RADIUS, length(hit.xy));
  vec2 split = surfaceOffset * 0.07 * silhouette;
  vec3 glass;
  glass.r = texture2D(u_coin, refracted + split).r;
  glass.g = texture2D(u_coin, refracted).g;
  glass.b = texture2D(u_coin, refracted - split).b;
  float luminance = dot(glass, vec3(0.299, 0.587, 0.114));
  float facing = abs(ray.z);
  glass = mix(vec3(luminance), glass, 0.42) * (0.72 + facing * 0.2);
  vec3 cipher = texture2D(u_cipher, faceUV + surfaceOffset * 0.38).rgb;
  float reveal = lens * silhouette * faceVisibility;
  glass *= 1.0 - reveal * 0.44;
  vec3 hidden = cipher * vec3(0.68, 0.84, 0.93) * reveal * 0.95;
  vec3 color = 1.0 - (1.0 - glass) * (1.0 - hidden);
  float rimDistance = (distanceToPointer - 0.12) * 42.0;
  float rim = exp(-rimDistance * rimDistance);
  color += vec3(0.055, 0.071, 0.079) * rim * lens * silhouette;
  float bevel = smoothstep(RADIUS * 0.85, RADIUS, length(hit.xy));
  vec3 faceNormal = normalize(vec3(hit.xy / RADIUS * bevel * 0.85, hit.w * (1.0 - bevel * 0.35)));
  float reflectionMask = mix(0.2, 1.0, smoothstep(0.035, 0.45, luminance));
  color += glassGlimmer(faceNormal, ray) * mix(reflectionMask, 1.0, bevel);
  gl_FragColor = vec4(color, 1.0);
}
`;

export function createGlassRenderer(canvas: HTMLCanvasElement, onReady: (ready: boolean) => void, onRotate: (yaw: number, pitch: number) => void) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  const point = { x: .5, y: .5, active: 0 };
  const current = { ...point };
  const rotation = createCoinMotion();
  let frame = 0;
  let idleTimer = 0;
  let paused = document.hidden;
  let previousTime = 0;
  let lastYaw = 0, lastPitch = 0;
  let time = 0;
  let ready = false;
  let disposed = false;
  let program: WebGLProgram | null = null;
  let buffer: WebGLBuffer | null = null;
  const textures: WebGLTexture[] = [];
  const shaders: WebGLShader[] = [];
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let observer: ResizeObserver | undefined;
  let image: HTMLImageElement | undefined;
  let pointerLocation: WebGLUniformLocation | null = null;
  let presenceLocation: WebGLUniformLocation | null = null;
  let timeLocation: WebGLUniformLocation | null = null;
  let rotationLocation: WebGLUniformLocation | null = null;

  function render(timestamp: number) {
    frame = 0;
    if (disposed) return;
    const elapsed = previousTime ? Math.min((timestamp - previousTime) / 1000, .05) : 1 / 60;
    previousTime = timestamp;
    rotation.advance(elapsed, motion.matches);
    if (rotation.yaw !== lastYaw || rotation.pitch !== lastPitch) {
      lastYaw = rotation.yaw;
      lastPitch = rotation.pitch;
      onRotate(lastYaw, lastPitch);
    }
    const follow = motion.matches ? 1 : 1 - Math.exp(-elapsed * 24);
    const fade = motion.matches ? 1 : 1 - Math.exp(-elapsed * 12);
    current.x += (point.x - current.x) * follow;
    current.y += (point.y - current.y) * follow;
    current.active += (point.active - current.active) * fade;
    if (!point.active && current.active < .001) current.active = 0;
    if (!motion.matches) time += elapsed;
    if (gl && ready) {
      gl.uniform2f(pointerLocation, current.x, current.y);
      gl.uniformMatrix3fv(rotationLocation, false, inverseCoinRotation(rotation.yaw, rotation.pitch));
      gl.uniform1f(presenceLocation, current.active);
      gl.uniform1f(timeLocation, motion.matches ? 0 : time);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    if (!motion.matches && (rotation.moving || (ready && (point.active > 0 || current.active > .001)))) schedule();
    else if (!motion.matches && ready) schedule(true);
    else previousTime = 0;
  }

  function schedule(idle = false) {
    if (disposed || paused) return;
    if (idle) {
      // Limit idle reflections to at most 30 fps; interaction resumes full rate.
      if (!frame && !idleTimer) idleTimer = window.setTimeout(() => {
        idleTimer = 0;
        frame = requestAnimationFrame(render);
      }, 1000 / 30);
    } else {
      window.clearTimeout(idleTimer);
      idleTimer = 0;
      if (!frame) frame = requestAnimationFrame(render);
    }
  }

  function cancelFrame() {
    cancelAnimationFrame(frame);
    window.clearTimeout(idleTimer);
    frame = idleTimer = 0;
    previousTime = 0;
  }

  function pause() {
    paused = true;
    cancelFrame();
  }

  function resume() {
    paused = document.hidden;
    schedule();
  }

  function visibilityChanged() {
    if (document.hidden) pause();
    else resume();
  }

  function resize() {
    if (!gl || disposed) return;
    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    const side = Math.max(1, Math.round(canvas.getBoundingClientRect().width * resolution));
    canvas.width = side;
    canvas.height = side;
    gl.viewport(0, 0, side, side);
    schedule();
  }

  function compile(type: number, source: string) {
    if (!gl) throw new Error('WebGL unavailable');
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Unable to create shader');
    shaders.push(shader);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('Unable to compile glass shader');
    return shader;
  }

  function texture(source: TexImageSource, unit: number) {
    if (!gl) return;
    const handle = gl.createTexture();
    if (!handle) throw new Error('Unable to create texture');
    textures.push(handle);
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, handle);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  }

  function fail() {
    ready = false;
    cancelFrame();
    onReady(false);
    schedule();
  }

  function contextLost(event: Event) { event.preventDefault(); fail(); }
  function motionChanged() { if (motion.matches) rotation.cancelHint(); schedule(); }
  canvas.addEventListener('webglcontextlost', contextLost);
  motion.addEventListener('change', motionChanged);
  window.addEventListener('blur', pause);
  window.addEventListener('focus', resume);
  document.addEventListener('visibilitychange', visibilityChanged);

  if (gl) {
    try {
      program = gl.createProgram();
      if (!program) throw new Error('Unable to create program');
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Unable to link glass shader');
      gl.useProgram(program);
      buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      pointerLocation = gl.getUniformLocation(program, 'u_pointer');
      presenceLocation = gl.getUniformLocation(program, 'u_presence');
      timeLocation = gl.getUniformLocation(program, 'u_time');
      rotationLocation = gl.getUniformLocation(program, 'u_inverseRotation');
      gl.uniform1i(gl.getUniformLocation(program, 'u_coin'), 0);
      gl.uniform1i(gl.getUniformLocation(program, 'u_cipher'), 1);

      const glyphs = document.createElement('canvas');
      glyphs.width = glyphs.height = 1024;
      const context = glyphs.getContext('2d');
      if (!context) throw new Error('Unable to create cipher');
      context.fillStyle = '#000';
      context.fillRect(0, 0, 1024, 1024);
      context.font = '20px monospace';
      context.fillStyle = '#dceaf1';
      let seed = 71837;
      for (let row = 0; row < 47; row++) {
        for (let col = 0; col < 62; col++) {
          seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
          context.fillText('0123456789ABCDEF'[(seed >>> 16) & 15], col * 17, row * 23 + 19);
        }
      }
      texture(glyphs, 1);
      image = new Image();
      image.onload = () => {
        if (disposed) return;
        try {
          texture(image!, 0);
          if (gl.getError() !== gl.NO_ERROR) throw new Error('Unable to upload glass texture');
          ready = true;
          if (!motion.matches) rotation.hint();
          resize();
          cancelFrame();
          render(performance.now());
          onReady(true);
          observer = new ResizeObserver(resize);
          observer.observe(canvas);
        } catch { fail(); }
      };
      image.onerror = fail;
      image.src = '/images/glass-bitcoin.png';
    } catch { fail(); }
  }

  return {
    takeControl() { rotation.cancelHint(); },
    move(x: number, y: number, active: boolean) {
      if (!point.active && current.active < .01) { current.x = x; current.y = 1 - y; }
      point.x = x;
      point.y = 1 - y;
      point.active = active ? 1 : 0;
      schedule();
    },
    hide() { point.active = 0; schedule(); },
    startDrag() {
      rotation.start(performance.now());
    },
    drag(deltaX: number, deltaY: number) {
      rotation.drag(deltaX, deltaY, performance.now());
      schedule();
    },
    endDrag() {
      rotation.release(performance.now(), motion.matches);
      schedule();
    },
    stop() { rotation.stop(); point.active = 0; schedule(); },
    turn(direction: number) {
      rotation.turn(direction);
      schedule();
    },
    destroy() {
      disposed = true;
      cancelFrame();
      observer?.disconnect();
      motion.removeEventListener('change', motionChanged);
      canvas.removeEventListener('webglcontextlost', contextLost);
      window.removeEventListener('blur', pause);
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', visibilityChanged);
      if (image) { image.onload = null; image.onerror = null; }
      textures.forEach((handle) => gl?.deleteTexture(handle));
      shaders.forEach((shader) => gl?.deleteShader(shader));
      if (buffer) gl?.deleteBuffer(buffer);
      if (program) gl?.deleteProgram(program);
    },
  };
}
