import * as THREE from "three";

export const IrisShader = {
  uniforms: {
    time: { value: 0 },
    color: { value: new THREE.Color("#0088ff") }, // Couleur plus visible
    center: { value: new THREE.Vector2(0.5, 0.5) }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float time;
    uniform vec3 color;
    uniform vec2 center;
    varying vec2 vUv;

    void main() {
      float dist = distance(vUv, center);
      float pulse = sin(time * 3.0) * 0.5 + 0.7; // Plus rapide et plus visible
      float glow = pow(1.0 - dist, 2.0); // Moins intense
      float outerGlow = smoothstep(0.8, 0.2, dist); // Plus large
      glow += outerGlow * 0.5;
      gl_FragColor = vec4(color * glow * pulse * 2.0, glow * 0.8); // Plus opaque
    }
  `
};