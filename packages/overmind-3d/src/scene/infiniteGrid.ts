import * as THREE from 'three';

// Vertex shader: project large plane, pass world position to fragment
const vertexShader = /* glsl */ `
varying vec3 vWorldPos;
varying float vCamDist;

void main() {
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  vCamDist = length(cameraPosition - worldPos.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

// Fragment shader: anti-aliased grid lines with 2 levels, colored axes, distance fade
const fragmentShader = /* glsl */ `
varying vec3 vWorldPos;
varying float vCamDist;

uniform float uGridSize1;
uniform float uGridSize2;
uniform vec3 uGridColor;
uniform vec3 uAxisXColor;
uniform vec3 uAxisZColor;
uniform float uFadeDistance;

float gridLine(vec2 coord, float size) {
  vec2 grid = abs(fract(coord / size - 0.5) - 0.5) / fwidth(coord / size);
  return 1.0 - min(min(grid.x, grid.y), 1.0);
}

void main() {
  vec2 coord = vWorldPos.xz;

  // Two grid levels
  float line1 = gridLine(coord, uGridSize1);
  float line2 = gridLine(coord, uGridSize2);

  // Combine: large grid is brighter
  float alpha = max(line1 * 0.3, line2 * 0.6);

  // Colored axes (X = red line along X axis, Z = blue line along Z axis)
  float axisWidth = fwidth(coord.y) * 1.5;
  float axisWidthX = fwidth(coord.x) * 1.5;
  float onAxisX = 1.0 - smoothstep(0.0, axisWidth, abs(coord.y));   // Z axis = along X=0
  float onAxisZ = 1.0 - smoothstep(0.0, axisWidthX, abs(coord.x));  // X axis = along Z=0

  vec3 color = uGridColor;
  if (onAxisX > 0.01) color = mix(color, uAxisZColor, onAxisX);
  if (onAxisZ > 0.01) color = mix(color, uAxisXColor, onAxisZ);
  alpha = max(alpha, max(onAxisX * 0.9, onAxisZ * 0.9));

  // Distance fade
  float fade = 1.0 - smoothstep(uFadeDistance * 0.5, uFadeDistance, vCamDist);
  alpha *= fade;

  if (alpha < 0.005) discard;
  gl_FragColor = vec4(color, alpha);
}
`;

export class InfiniteGrid extends THREE.Mesh {
  declare material: THREE.ShaderMaterial;

  constructor(
    gridSize1 = 1.0,
    gridSize2 = 10.0,
    gridColor = '#444444',
    axisXColor = '#ff4444',
    axisZColor = '#4444ff',
    fadeDistance = 50.0,
  ) {
    const geo = new THREE.PlaneGeometry(200, 200, 1, 1);
    geo.rotateX(-Math.PI / 2); // horizontal

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uGridSize1: { value: gridSize1 },
        uGridSize2: { value: gridSize2 },
        uGridColor: { value: new THREE.Color(gridColor) },
        uAxisXColor: { value: new THREE.Color(axisXColor) },
        uAxisZColor: { value: new THREE.Color(axisZColor) },
        uFadeDistance: { value: fadeDistance },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    super(geo, mat);
    this.frustumCulled = false;
    this.renderOrder = -1;
    this.name = 'infiniteGrid';
  }

  /** Follow the camera horizontally so the grid always appears infinite */
  followCamera(camera: THREE.Camera): void {
    this.position.x = camera.position.x;
    this.position.z = camera.position.z;
  }

  setGridSizes(small: number, large: number): void {
    this.material.uniforms.uGridSize1.value = small;
    this.material.uniforms.uGridSize2.value = large;
  }

  setGridColor(color: string): void {
    this.material.uniforms.uGridColor.value.set(color);
  }

  setFadeDistance(d: number): void {
    this.material.uniforms.uFadeDistance.value = d;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
