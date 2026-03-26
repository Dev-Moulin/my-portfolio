import * as THREE from 'three';

// ── Shaders ──────────────────────────────────────────────────────────────────

const vertexShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`;

const fragmentShader = /* glsl */ `
varying vec3 vNormal;
varying vec3 vWorldPosition;

uniform vec3 lightColor;
uniform vec3 spotPosition;
uniform float attenuation;
uniform float anglePower;
uniform float opacity;

void main() {
  // Distance-based falloff from light source
  float dist = distance(vWorldPosition, spotPosition) / attenuation;
  float intensity = 1.0 - clamp(dist, 0.0, 1.0);

  // View-angle effect: bright at edges (grazing), transparent when looking through
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  float viewAngle = abs(dot(vNormal, viewDir));
  intensity *= pow(max(1.0 - viewAngle, 0.0), anglePower);

  // Soft fade near tip
  intensity *= smoothstep(0.0, 0.15, dist);

  gl_FragColor = vec4(lightColor, intensity * opacity * 0.6);
}
`;

// ── Helpers ──────────────────────────────────────────────────────────────────

const _dir = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quatAlign = new THREE.Quaternion();

// ── Class ────────────────────────────────────────────────────────────────────

export class VolumetricCone {
  readonly mesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(color: THREE.Color, angle: number, distance: number) {
    const height = distance > 0 ? distance : 10;
    const radius = height * Math.tan(angle);

    const geometry = new THREE.CylinderGeometry(0.01, radius, height, 64, 20, true);
    geometry.translate(0, -height / 2, 0);
    geometry.rotateX(Math.PI);

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        lightColor: { value: color.clone() },
        spotPosition: { value: new THREE.Vector3() },
        attenuation: { value: height * 0.8 },
        anglePower: { value: 1.5 },
        opacity: { value: 1.0 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });

    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 100;
  }

  /** Sync cone position/orientation with the SpotLight it belongs to. */
  syncWithLight(light: THREE.SpotLight): void {
    this.mesh.position.copy(light.position);

    // Align +Y local (cone opening direction) with light→target direction
    _dir.subVectors(light.target.position, light.position).normalize();
    _quatAlign.setFromUnitVectors(_up, _dir);
    this.mesh.quaternion.copy(_quatAlign);

    this.material.uniforms.spotPosition.value.copy(light.position);
  }

  /** Rebuild geometry when angle or distance changes. */
  rebuild(angle: number, distance: number): void {
    const height = distance > 0 ? distance : 10;
    const radius = height * Math.tan(angle);

    this.mesh.geometry.dispose();
    const geometry = new THREE.CylinderGeometry(0.01, radius, height, 64, 20, true);
    geometry.translate(0, -height / 2, 0);
    geometry.rotateX(Math.PI);
    this.mesh.geometry = geometry;

    this.material.uniforms.attenuation.value = height * 0.8;
  }

  setColor(color: THREE.Color): void {
    this.material.uniforms.lightColor.value.copy(color);
  }

  setOpacity(value: number): void {
    this.material.uniforms.opacity.value = value;
    this.mesh.visible = value > 0;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
  }
}
