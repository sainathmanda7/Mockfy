import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, useAnimations, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const MODELS = [
  '/3D_Model/Upload/All_Night_Dance.glb'
];

function collectMaterials(root: THREE.Object3D): THREE.Material[] {
  const found: THREE.Material[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.material) {
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      list.forEach((m) => {
        m.transparent = true;
        found.push(m);
      });
    }
  });
  return found;
}

function AnimatedModel({ url, visible }: { url: string, visible: boolean }) {
  const { scene, animations } = useGLTF(url);
  const { actions, names } = useAnimations(animations, scene);
  const opacityRef = useRef(0);
  const materials = React.useMemo(() => collectMaterials(scene), [scene]);
  
  useEffect(() => {
    if (names.length > 0 && actions[names[0]]) {
      actions[names[0]]?.reset().fadeIn(0.5).play();
    }
  }, [actions, names]);

  useFrame((_, delta) => {
    const targetOpacity = visible ? 1 : 0;
    opacityRef.current = THREE.MathUtils.damp(opacityRef.current, targetOpacity, 4, delta);
    
    materials.forEach(m => {
      m.opacity = opacityRef.current;
    });
    
    scene.visible = opacityRef.current > 0.01;
  });

  return <primitive object={scene} scale={2} position={[0, -1.5, 0]} />;
}

function SceneContainer() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % MODELS.length);
    }, 6000); // Switch every 6 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <group>
      {MODELS.map((url, idx) => (
        <AnimatedModel key={url} url={url} visible={currentIndex === idx} />
      ))}
    </group>
  );
}

export default function UploadMascot() {
  return (
    <div className="w-full h-full relative">
      <Canvas
        camera={{ position: [0, 1, 5], fov: 50 }}
        gl={{ alpha: true, antialias: true }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} color="#e3e6ff" />
        <directionalLight position={[-5, 5, -5]} intensity={0.8} color="#7c3aed" />
        
        <Suspense fallback={null}>
          <SceneContainer />
        </Suspense>
        
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1} />
      </Canvas>
    </div>
  );
}

MODELS.forEach(url => useGLTF.preload(url));
