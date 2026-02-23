import * as THREE from 'three';
import type { BandConfig } from '../machines/neonBandsMachine.ts';

// ─── Shaders ──────────────────────────────────────────────────────────────────

const VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uFlowSpeed;
uniform float uIntensity;
uniform float uGlobalIntensity;
varying vec2 vUv;

void main() {
  float y = vUv.y;

  // Cascade flow: overlapping sine waves moving along the path
  float flow1 = sin(y * 12.566 - uTime * uFlowSpeed) * 0.15 + 0.85;
  float flow2 = sin(y * 31.416 - uTime * uFlowSpeed * 1.7) * 0.08;
  float flow3 = sin(y * 75.398 - uTime * uFlowSpeed * 0.6) * 0.04;

  float brightness = (flow1 + flow2 + flow3) * uIntensity * uGlobalIntensity;

  // Soft horizontal edges (across band width)
  float edgeFade = smoothstep(0.0, 0.15, vUv.x) * smoothstep(1.0, 0.85, vUv.x);

  // Slight vertical fade at the very start/end of path
  float vertFade = smoothstep(0.0, 0.02, y) * smoothstep(1.0, 0.98, y);

  gl_FragColor = vec4(uColor * brightness * edgeFade * vertFade, 1.0);
}
`;

// ─── Path geometry ────────────────────────────────────────────────────────────
//
// The path goes DOWN (−Y) then curves TOWARD the camera (+Z).
// The arc is a quarter circle in the YZ plane.
// Bands are always spread side-by-side along X — the normal is always (1,0,0).
//
// This creates a perspective "widening" effect at the bottom because the
// horizontal section comes toward the camera, exactly like the reference image.
//
// Path:
//   1. Vertical:  (0, yTop→yArcStart, 0)       direction (0,−1, 0)
//   2. Arc:       quarter circle in YZ plane     direction rotates to (0,0,+1)
//   3. Depth:     (0, yBottom, R→R+L)            direction (0, 0,+1)

interface PathConfig {
  yTop: number;
  yBottom: number;
  arcRadius: number;
  depthLength: number;
  depthSpread: number;  // width multiplier at end of depth (1 = constant, 4 = 4x wider)
  vertSegments: number;
  arcSegments: number;
  depthSegments: number;
}

function createBandGeometry(
  xOffset: number,
  halfWidth: number,
  config: PathConfig,
): THREE.BufferGeometry {
  const { yTop, yBottom, arcRadius, depthLength, depthSpread, vertSegments, arcSegments, depthSegments } = config;

  // Arc center in YZ: (yBottom + R, 0) — so arc starts at (yBottom+R, 0) and ends at (yBottom, R)
  const yCenterArc = yBottom + arcRadius;

  // Path points: (y, z) along the center line + cumulative distance + spread factor
  //   spread: 1.0 in vertical section, lerps from 1.0 → depthSpread through arc + depth
  type PathPoint = { y: number; z: number; dist: number; spread: number };
  const points: PathPoint[] = [];
  let dist = 0;

  // --- Section 1: Vertical (y from yTop down to yBottom + R, z = 0) ---
  // No spreading here — spread = 1.0
  const vertLength = yTop - yCenterArc;
  for (let i = 0; i <= vertSegments; i++) {
    const t = i / vertSegments;
    points.push({ y: yTop - t * vertLength, z: 0, dist, spread: 1.0 });
    if (i < vertSegments) dist += vertLength / vertSegments;
  }

  // --- Section 2: Arc (quarter circle in YZ, β from 0 to π/2) ---
  // Spread starts here: lerps from 1.0 at arc start to midpoint spread at arc end
  const arcLength = (Math.PI / 2) * arcRadius;
  const totalCurveLength = arcLength + depthLength;
  for (let i = 1; i <= arcSegments; i++) {
    const t = i / arcSegments;
    const beta = t * (Math.PI / 2);
    dist += arcLength / arcSegments;
    // How far are we through the combined arc+depth? Arc portion only.
    const curveProg = (t * arcLength) / totalCurveLength;
    const spread = 1.0 + (depthSpread - 1.0) * curveProg;
    points.push({
      y: yCenterArc - arcRadius * Math.sin(beta),
      z: arcRadius * (1 - Math.cos(beta)),
      dist,
      spread,
    });
  }

  // --- Section 3: Depth (z from R to R + depthLength, y = yBottom) ---
  // Spread continues from arc end spread to depthSpread
  const zStart = arcRadius;
  for (let i = 1; i <= depthSegments; i++) {
    const t = i / depthSegments;
    dist += depthLength / depthSegments;
    const curveProg = (arcLength + t * depthLength) / totalCurveLength;
    const spread = 1.0 + (depthSpread - 1.0) * curveProg;
    points.push({ y: yBottom, z: zStart + t * depthLength, dist, spread });
  }

  const totalDist = dist;

  // --- Generate triangle strip vertices ---
  // Width at each point = halfWidth * spread; xOffset also scales by spread
  const positions: number[] = [];
  const uvs: number[] = [];

  for (const p of points) {
    const hw = halfWidth * p.spread;
    const xOff = xOffset * p.spread;
    // Left edge
    positions.push(xOff - hw, p.y, p.z);
    uvs.push(0, p.dist / totalDist);
    // Right edge
    positions.push(xOff + hw, p.y, p.z);
    uvs.push(1, p.dist / totalDist);
  }

  // --- Triangle indices ---
  const indices: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const v0 = i * 2;
    const v1 = i * 2 + 1;
    const v2 = (i + 1) * 2;
    const v3 = (i + 1) * 2 + 1;
    indices.push(v0, v2, v1);
    indices.push(v1, v2, v3);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);

  return geometry;
}

// ─── NeonBandsSystem ──────────────────────────────────────────────────────────

const Y_BOTTOM = -6;
const DEPTH_LENGTH = 10;
const VERT_SEGMENTS = 20;
const ARC_SEGMENTS = 12;
const DEPTH_SEGMENTS = 10;

export class NeonBandsSystem {
  private group: THREE.Group;
  private meshes: THREE.Mesh[] = [];
  private materials: THREE.ShaderMaterial[] = [];
  private geometries: THREE.BufferGeometry[] = [];
  private bandWidths: number[];
  private spacing: number;
  private arcRadius: number;
  private depthSpread: number;
  private lineLength: number;
  private time = 0;
  private flowEnabled = true;
  private flowSpeed = 1.0;
  private globalIntensity = 1.0;

  constructor(
    scene: THREE.Scene,
    bands: BandConfig[],
    spacing: number,
    posX: number,
    posY: number,
    posZ: number,
    scale: number,
    arcRadius: number,
    depthSpread: number,
    lineLength: number,
  ) {
    this.group = new THREE.Group();
    this.group.position.set(posX, posY, posZ);
    this.group.scale.setScalar(scale);
    this.spacing = spacing;
    this.arcRadius = arcRadius;
    this.depthSpread = depthSpread;
    this.lineLength = lineLength;
    this.bandWidths = bands.map(b => b.width);

    // Compute X offsets (centered around 0)
    const xOffsets = this.computeXOffsets(bands, spacing);

    const pathConfig: PathConfig = {
      yTop: lineLength,
      yBottom: Y_BOTTOM,
      arcRadius,
      depthLength: DEPTH_LENGTH,
      depthSpread,
      vertSegments: VERT_SEGMENTS,
      arcSegments: ARC_SEGMENTS,
      depthSegments: DEPTH_SEGMENTS,
    };

    for (let i = 0; i < bands.length; i++) {
      const band = bands[i];
      const geometry = createBandGeometry(xOffsets[i], band.width / 2, pathConfig);
      const material = new THREE.ShaderMaterial({
        vertexShader: VERTEX_SHADER,
        fragmentShader: FRAGMENT_SHADER,
        uniforms: {
          uColor: { value: new THREE.Color(band.color) },
          uTime: { value: 0 },
          uFlowSpeed: { value: this.flowSpeed },
          uIntensity: { value: band.intensity },
          uGlobalIntensity: { value: this.globalIntensity },
        },
        transparent: false,
        depthWrite: true,
        side: THREE.DoubleSide,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = band.visible;

      this.group.add(mesh);
      this.meshes.push(mesh);
      this.materials.push(material);
      this.geometries.push(geometry);
    }

    scene.add(this.group);
  }

  /** Compute centered X positions for each band */
  private computeXOffsets(bands: BandConfig[], spacing: number): number[] {
    const offsets: number[] = [];
    let cursor = 0;
    for (let i = 0; i < bands.length; i++) {
      offsets.push(cursor + bands[i].width / 2);
      cursor += bands[i].width + spacing;
    }
    const totalWidth = cursor - spacing;
    const center = totalWidth / 2;
    return offsets.map(o => o - center);
  }

  /** Call every frame to animate the cascade flow */
  update(delta: number): void {
    if (this.flowEnabled) {
      this.time += delta;
    }
    for (const mat of this.materials) {
      mat.uniforms.uTime.value = this.time;
      mat.uniforms.uFlowSpeed.value = this.flowSpeed;
      mat.uniforms.uGlobalIntensity.value = this.globalIntensity;
    }
  }

  /** Full sync from machine state */
  syncFromState(
    bands: BandConfig[],
    spacing: number,
    flowEnabled: boolean,
    flowSpeed: number,
    globalIntensity: number,
    posX: number,
    posY: number,
    posZ: number,
    scale: number,
    arcRadius: number,
    depthSpread: number,
    lineLength: number,
  ): void {
    this.flowEnabled = flowEnabled;
    this.flowSpeed = flowSpeed;
    this.globalIntensity = globalIntensity;
    this.group.position.set(posX, posY, posZ);
    this.group.scale.setScalar(scale);

    let needsRebuild = arcRadius !== this.arcRadius || spacing !== this.spacing
      || depthSpread !== this.depthSpread || lineLength !== this.lineLength;

    for (let i = 0; i < bands.length && i < this.meshes.length; i++) {
      const band = bands[i];
      this.materials[i].uniforms.uColor.value.set(band.color);
      this.materials[i].uniforms.uIntensity.value = band.intensity;
      this.meshes[i].visible = band.visible;
      if (this.bandWidths[i] !== band.width) {
        this.bandWidths[i] = band.width;
        needsRebuild = true;
      }
    }

    if (needsRebuild) {
      this.arcRadius = arcRadius;
      this.spacing = spacing;
      this.depthSpread = depthSpread;
      this.lineLength = lineLength;
      this.rebuildGeometries(bands);
    }
  }

  private rebuildGeometries(bands: BandConfig[]): void {
    const xOffsets = this.computeXOffsets(bands, this.spacing);

    const pathConfig: PathConfig = {
      yTop: this.lineLength,
      yBottom: Y_BOTTOM,
      arcRadius: this.arcRadius,
      depthLength: DEPTH_LENGTH,
      depthSpread: this.depthSpread,
      vertSegments: VERT_SEGMENTS,
      arcSegments: ARC_SEGMENTS,
      depthSegments: DEPTH_SEGMENTS,
    };

    for (let i = 0; i < this.meshes.length && i < bands.length; i++) {
      this.geometries[i].dispose();
      const newGeo = createBandGeometry(xOffsets[i], bands[i].width / 2, pathConfig);
      this.meshes[i].geometry = newGeo;
      this.geometries[i] = newGeo;
    }
  }

  dispose(): void {
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) mat.dispose();
    if (this.group.parent) this.group.parent.remove(this.group);
  }
}
