import * as THREE from 'three';

// ── Simplex noise GLSL (compact 3D) ─────────────────────────────────────────

const NOISE_GLSL = /* glsl */ `
vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i, 289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
    + i.y + vec4(0.0, i1.y, i2.y, 1.0))
    + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 1.0/7.0;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
`;

// ── Vertex shader ────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
${NOISE_GLSL}

uniform float uTime;
uniform float uDisplaceStrength;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vDisplacement;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;

  // Displacement: layered noise for organic surface movement
  float n1 = snoise(position * 1.5 + uTime * 0.3);
  float n2 = snoise(position * 3.0 + uTime * 0.5) * 0.5;
  float displacement = (n1 + n2) * uDisplaceStrength;
  vDisplacement = displacement;

  vec3 displaced = position + normal * displacement;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
}
`;

// ── Fragment shader ──────────────────────────────────────────────────────────

const fragmentShader = /* glsl */ `
${NOISE_GLSL}

uniform float uTime;
uniform vec3 uColorCore;     // bright center
uniform vec3 uColorMid;      // mid surface
uniform vec3 uColorEdge;     // edge/corona
uniform float uEmissiveStrength;
uniform float uPulseSpeed;

varying vec3 vNormal;
varying vec3 vPosition;
varying float vDisplacement;

void main() {
  // Fresnel: brighter at edges (corona effect)
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = 1.0 - abs(dot(vNormal, viewDir));
  fresnel = pow(fresnel, 2.0);

  // Animated noise pattern on surface
  float n = snoise(vPosition * 2.0 + uTime * 0.2) * 0.5 + 0.5;
  float n2 = snoise(vPosition * 4.0 - uTime * 0.15) * 0.5 + 0.5;
  float pattern = n * 0.7 + n2 * 0.3;

  // Pulse
  float pulse = 1.0 + sin(uTime * uPulseSpeed) * 0.1;

  // Color gradient: core → mid → edge based on pattern + fresnel
  vec3 color = mix(uColorCore, uColorMid, pattern);
  color = mix(color, uColorEdge, fresnel * 0.8);

  // Bright spots (solar flares)
  float flare = smoothstep(0.65, 0.85, n) * (1.0 - fresnel);
  color += uColorCore * flare * 0.5;

  // Final emission
  color *= uEmissiveStrength * pulse;

  gl_FragColor = vec4(color, 1.0);
}
`;

// ── Create material ──────────────────────────────────────────────────────────

export interface SunShaderOptions {
  colorCore?: string;
  colorMid?: string;
  colorEdge?: string;
  emissiveStrength?: number;
  displaceStrength?: number;
  pulseSpeed?: number;
}

export function createSunMaterial(opts?: SunShaderOptions): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uTime:             { value: 0 },
      uColorCore:        { value: new THREE.Color(opts?.colorCore ?? '#fff8e0') },
      uColorMid:         { value: new THREE.Color(opts?.colorMid ?? '#ffaa22') },
      uColorEdge:        { value: new THREE.Color(opts?.colorEdge ?? '#ff4400') },
      uEmissiveStrength: { value: opts?.emissiveStrength ?? 3.0 },
      uDisplaceStrength: { value: opts?.displaceStrength ?? 0.15 },
      uPulseSpeed:       { value: opts?.pulseSpeed ?? 1.5 },
    },
    side: THREE.FrontSide,
  });
}

// ── Apply to Sun mesh in a loaded model ──────────────────────────────────────

export function applySunShader(model: THREE.Object3D, opts?: SunShaderOptions): THREE.ShaderMaterial | null {
  let sunMat: THREE.ShaderMaterial | null = null;

  model.traverse((child) => {
    if (child.name === 'Sun014_gameasset' && (child as THREE.Mesh).isMesh) {
      sunMat = createSunMaterial(opts);
      (child as THREE.Mesh).material = sunMat;
    }
  });

  if (!sunMat) {
    console.warn('[sunShader] Mesh "Sun014_gameasset" not found');
  }

  return sunMat;
}
