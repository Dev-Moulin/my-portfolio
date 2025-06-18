"use client";

import React, { useRef, useState, useEffect, Suspense } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader";
import { getModelPath } from "../../../utils/assetPath";
import * as THREE from "three";
import { applyIrisMaterial } from "./useIrisMaterial";
import { applyAnneauxMaterial } from "./useAnneauxMaterial";

interface EyeFollowerProps {
  className?: string;
}

interface EyeComponentProps {
  mousePosition: { x: number; y: number };
  scrollY: number;
  viewportHeight: number;
  windowSize: { width: number; height: number };
}

interface EyeSceneRef {
  ringOuter?: THREE.Mesh;
  ringInner?: THREE.Mesh;
  animatedMaterial?: THREE.ShaderMaterial;
  eyeGroup?: THREE.Group;
}

// Composant de chargement simple
const LoaderComponent = () => (
  <mesh>
    <sphereGeometry args={[1, 16, 16]} />
    <meshBasicMaterial color="white" wireframe />
  </mesh>
);

function EyeComponent({
  mousePosition,
  scrollY,
  viewportHeight,
  windowSize,
}: EyeComponentProps) {
  const pivotRef = useRef<THREE.Object3D>();
  const sceneRef = useRef<EyeSceneRef>({});
  const { viewport, camera } = useThree();

  // Configuration DRACOLoader
  const dracoLoader = new DRACOLoader();
  dracoLoader.setDecoderPath(
    "https://www.gstatic.com/draco/versioned/decoders/1.5.6/"
  );

  const gltfLoader = new GLTFLoader();
  gltfLoader.setDRACOLoader(dracoLoader);

  const modelPath = getModelPath("Eye-1K.glb");
  const gltf = useLoader(GLTFLoader, modelPath, (loader) => {
    loader.setDRACOLoader(dracoLoader);
  });

  // États pour le mouvement
  const [baseDistance] = useState(() => Math.random() * 20 + 40);
  const [randomOffset] = useState(() => ({
    x: (Math.random() - 0.5) * 10,
    y: (Math.random() - 0.5) * 8,
    z: (Math.random() - 0.5) * 5,
  }));

  // État pour le mouvement autonome
  const [autonomousOffset] = useState(() => ({
    x: Math.random() * Math.PI * 2,
    y: Math.random() * Math.PI * 2,
    speed: Math.random() * 0.3 + 0.2,
  }));

  // Calculer les marges de sécurité basées sur la taille de l'œil
  const eyeSize = 6 * 2;
  const safeMarginX = (eyeSize / windowSize.width) * viewport.width;
  const safeMarginY = (eyeSize / windowSize.height) * viewport.height;

  useEffect(() => {
    if (!gltf.scene) return;

    const pivot = new THREE.Object3D();
    pivotRef.current = pivot;

    // Cloner d'abord, PUIS appliquer les matériaux sur le clone
    const clonedScene = gltf.scene.clone();

    // Configurer la position et rotation de base
    clonedScene.position.z = 0;
    clonedScene.rotation.x = Math.PI;
    clonedScene.rotation.y = Math.PI;
    clonedScene.scale.setScalar(4);

    // Appliquer les matériaux sur le CLONE
    clonedScene.traverse((node) => {
      if (node instanceof THREE.Mesh) {
        console.log("Mesh trouvé:", node.name);

        if (node.name === "Iris") {
          console.log("Application du matériau iris...");
          applyIrisMaterial(node, "animated");
          // Stocker la référence au ShaderMaterial
          if (node.material instanceof THREE.ShaderMaterial) {
            sceneRef.current.animatedMaterial = node.material;
            console.log("Matériau iris shader appliqué");
          }
        }

        if (node.name === "Anneaux_EXT") {
          console.log("Application du matériau anneau externe...");
          applyAnneauxMaterial(node, "ringStrong");
          sceneRef.current.ringOuter = node;
          console.log("Anneau externe assigné");
        }

        if (node.name === "Anneaux_INT") {
          console.log("Application du matériau anneau interne...");
          applyAnneauxMaterial(node, "ringSoft");
          sceneRef.current.ringInner = node;
          console.log("Anneau interne assigné");
        }
      }
    });

    // Ajouter le groupe cloné au pivot
    pivot.add(clonedScene);
    sceneRef.current.eyeGroup = clonedScene;
  }, [gltf.scene]);

  // Ajouter une fonction pour calculer la distance au centre
  const getDistanceFromCenter = (x: number, y: number) => {
    const centerX = 0;
    const centerY = 0;
    return Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
  };

  // Ajouter une fonction pour repousser l'œil du centre
  const getRepulsionForce = (x: number, y: number) => {
    const distance = getDistanceFromCenter(x, y);
    const minDistance = viewport.width * 0.2;

    if (distance < minDistance) {
      const force = (minDistance - distance) / minDistance;
      const angle = Math.atan2(y, x);
      return {
        x: Math.cos(angle) * force * 10,
        y: Math.sin(angle) * force * 10,
      };
    }

    return { x: 0, y: 0 };
  };

  useFrame((state) => {
    if (!pivotRef.current) return;

    // Animation des anneaux avec vérification
    if (sceneRef.current.ringOuter) {
      sceneRef.current.ringOuter.rotation.y += 0.02;
    }
    if (sceneRef.current.ringInner) {
      sceneRef.current.ringInner.rotation.y -= 0.025;
    }

    // Animation du shader de l'iris avec vérification
    if (
      sceneRef.current.animatedMaterial &&
      sceneRef.current.animatedMaterial.uniforms?.time
    ) {
      sceneRef.current.animatedMaterial.uniforms.time.value =
        performance.now() / 1000;
    }

    // Convertir la position de la souris en coordonnées normalisées
    const x = (mousePosition.x / windowSize.width) * 2 - 1;
    const y = -(mousePosition.y / windowSize.height) * 2 + 1;

    // Calculer le mouvement autonome avec amplitude réduite
    const time = state.clock.elapsedTime;
    const autonomousX =
      Math.sin(time * autonomousOffset.speed + autonomousOffset.x) * 3;
    const autonomousY =
      Math.cos(time * autonomousOffset.speed + autonomousOffset.y) * 3;

    // Calculer les limites de l'écran avec marges de sécurité
    const maxX = viewport.width * 0.35 - safeMarginX;
    const maxY = viewport.height * 0.35 - safeMarginY;

    // Créer un plan perpendiculaire à la caméra pour le lookAt
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -50);
    const raycaster = new THREE.Raycaster();
    const mouseVec = new THREE.Vector2(x, y);
    raycaster.setFromCamera(mouseVec, camera);

    // Point où le rayon intersecte le plan
    const lookTarget = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, lookTarget);

    // Amplifier l'effet de rotation vers la souris
    lookTarget.multiplyScalar(4);

    // Calculer la position relative du scroll avec limite
    const maxScroll = document.documentElement.scrollHeight - viewportHeight;
    const scrollProgress = Math.min(Math.max(scrollY / maxScroll, 0), 1);
    const scrollOffset = scrollProgress * viewport.height * 0.3;

    // Position cible avec une courbe d'atténuation aux bords
    const easeOutQuad = (t: number) => t * (2 - t);
    const xFactor = easeOutQuad(Math.abs(x)) * Math.sign(x);
    const yFactor = easeOutQuad(Math.abs(y)) * Math.sign(y);

    // Calculer la position cible avec des limites strictes
    const targetX = Math.max(
      -maxX,
      Math.min(
        maxX,
        -xFactor * viewport.width * 0.15 + randomOffset.x + autonomousX
      )
    );
    const targetY = Math.max(
      -maxY,
      Math.min(
        maxY,
        -yFactor * viewport.height * 0.15 +
          randomOffset.y +
          autonomousY -
          scrollOffset
      )
    );
    const targetZ = baseDistance + Math.sin(time * 0.5) * 3;

    // Calculer la force de répulsion
    const repulsion = getRepulsionForce(targetX, targetY);

    // Appliquer la force de répulsion aux positions cibles
    const finalTargetX = targetX + repulsion.x;
    const finalTargetY = targetY + repulsion.y;

    // Ajouter un mouvement circulaire lent quand l'œil est proche du centre
    const circularMotion = {
      x: Math.cos(state.clock.elapsedTime * 0.5) * 2,
      y: Math.sin(state.clock.elapsedTime * 0.5) * 2,
    };

    const distanceFromCenter = getDistanceFromCenter(
      finalTargetX,
      finalTargetY
    );
    const circularInfluence = Math.max(
      0,
      1 - distanceFromCenter / (viewport.width * 0.2)
    );

    const finalPosition = new THREE.Vector3(
      finalTargetX + circularMotion.x * circularInfluence,
      finalTargetY + circularMotion.y * circularInfluence,
      targetZ
    );

    // Interpolation plus douce pour la position
    pivotRef.current.position.lerp(finalPosition, 0.012);

    // Calculer une rotation plus prononcée vers la souris en utilisant lookTarget
    const targetRotation = new THREE.Vector3(
      lookTarget.x * 0.3,
      lookTarget.y * 0.3,
      camera.position.z
    );

    pivotRef.current.lookAt(targetRotation);
  });

  return (
    <group>{pivotRef.current && <primitive object={pivotRef.current} />}</group>
  );
}

const EyeFollower: React.FC<EyeFollowerProps> = ({ className = "" }) => {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [scrollY, setScrollY] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      setViewportHeight(window.innerHeight);
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    updateDimensions();

    const handleMouseMove = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const isClickable = target.closest('button, a, input, [role="button"]');

      if (!isClickable) {
        setMousePosition({ x: event.clientX, y: event.clientY });
      }
    };

    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("scroll", handleScroll);
    window.addEventListener("resize", updateDimensions);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", updateDimensions);
    };
  }, []);

  return (
    <div
      className={`fixed inset-0 z-50 ${className}`}
      style={{
        pointerEvents: "none",
        touchAction: "none",
      }}
    >
      <Canvas
        camera={{
          position: [0, 0, 100],
          fov: 45,
          near: 1,
          far: 1000,
        }}
        style={{
          background: "transparent",
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
        }}
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
        }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 5]} intensity={2} castShadow />
        <directionalLight position={[-10, -10, -5]} intensity={1} />
        <pointLight position={[0, 0, 10]} intensity={1.5} distance={500} />
        <hemisphereLight color="#ffffff" groundColor="#000000" intensity={1} />

        <Suspense fallback={<LoaderComponent />}>
          <EyeComponent
            mousePosition={mousePosition}
            scrollY={scrollY}
            viewportHeight={viewportHeight}
            windowSize={windowSize}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};

export default EyeFollower;
