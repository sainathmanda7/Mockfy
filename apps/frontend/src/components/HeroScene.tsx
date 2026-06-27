import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  Component,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, useAnimations, OrbitControls } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { ReactNode } from 'react';

/* ================================================================== */
/*  Types & tunables                                                   */
/* ================================================================== */

type ScenePhase = 'entering' | 'revealTitle' | 'stopped' | 'gesture';

const RUN_URL = '/3D_Model/Run.glb';
const GESTURE_URL = '/3D_Model/Gesture.glb';

/**
 * I could not inspect the actual GLB files (see the note below the code),
 * so clip selection is done by pattern match against whatever clip names
 * are actually inside the file, falling back to "first clip" if nothing
 * matches. Open the browser console on load - both files' clip names are
 * logged once. If the wrong clip gets picked, tighten these patterns or
 * just hardcode the exact name, e.g. clipName = 'Armature|Run'.
 */
const RUN_CLIP_PATTERN = /run|walk|loco|jog|sprint/i;
const GESTURE_CLIP_PATTERN = /gesture|present|wave|talk|idle|show/i;

const isDev = typeof process !== 'undefined' && process.env?.NODE_ENV !== 'production';

const WALK_DURATION = 3.2; // seconds to walk from START_POS to TARGET_POS
const REVEAL_AT = 0.7; // fraction of the walk where the title fires (per spec)
const STOP_HOLD = 0.4; // seconds held in a settled stance before the gesture clip takes over
const CROSSFADE = 0.5; // seconds, matches the fadeOut/fadeIn timing requested in the brief

const START_POS = new THREE.Vector3(5.4, -1.42, 0); // off-screen, right-middle
const TARGET_POS = new THREE.Vector3(-0.45, -1.42, 0); // center "presenting" spot
const ENTRY_ROTATION_Y = -0.35;
const FACING_ROTATION_Y = 0.25; // slight turn toward the title once stopped
const MODEL_SCALE = 2.0;

/* ================================================================== */
/*  Error boundary for WebGL render-time failures                      */
/* ================================================================== */

interface WebGLErrorBoundaryProps {
  children: ReactNode;
  onError: () => void;
}
interface WebGLErrorBoundaryState {
  hasError: boolean;
}

class WebGLErrorBoundary extends Component<WebGLErrorBoundaryProps, WebGLErrorBoundaryState> {
  constructor(props: WebGLErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(): WebGLErrorBoundaryState {
    return { hasError: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.hasError ? null : this.props.children;
  }
}

/**
 * A lost WebGL context does NOT throw a JS error - three.js just logs
 * "THREE.WebGLRenderer: Context Lost" and stops rendering, so the error
 * boundary above never fires for it. That mismatch is almost certainly why
 * the previous version produced a silent black screen after that message.
 * This listens for the real native event and reacts to it directly.
 */
function ContextLossWatcher({ onLost }: { onLost: () => void }) {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const handleLost = (event: Event) => {
      event.preventDefault();
      if (isDev) console.warn('[HeroScene] WebGL context lost.');
      onLost();
    };
    canvas.addEventListener('webglcontextlost', handleLost);
    return () => canvas.removeEventListener('webglcontextlost', handleLost);
  }, [gl, onLost]);
  return null;
}

/* ================================================================== */
/*  Helpers                                                             */
/* ================================================================== */

function collectMaterials(root: THREE.Object3D): THREE.Material[] {
  const found: THREE.Material[] = [];
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.isMesh && mesh.material) {
      if (isDev) console.log('[HeroScene] Mesh:', mesh.name);
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      list.forEach((m) => {
        m.transparent = true;
        
        // Add subtle metallic reflections and keep existing base color
        const mat = m as THREE.MeshStandardMaterial;
        mat.metalness = 0.8;
        mat.roughness = 0.25;
        
        // Add subtle purple emissive glow to specific parts
        const name = mesh.name.toLowerCase();
        if (name.includes('eye') || name.includes('lens') || name.includes('visor') || name.includes('glow')) {
          mat.emissive = new THREE.Color('#7c3aed');
          mat.emissiveIntensity = 2.0;
        }

        found.push(m);
      });
    }
  });
  return found;
}

function pickClip(names: string[], pattern: RegExp): string | undefined {
  if (names.length === 0) return undefined;
  return names.find((n) => pattern.test(n)) ?? names[0];
}

function setOpacity(materials: THREE.Material[], value: number) {
  materials.forEach((m) => {
    m.opacity = value;
  });
}

/* ================================================================== */
/*  Run-in actor                                                        */
/*  Plays the looping Run.glb clip, decelerates it into the stop, then  */
/*  fades itself out (mesh opacity + action weight) once the gesture    */
/*  model takes over. Kept as a fully separate self-contained model     */
/*  (own scene, own skeleton, own mixer) rather than retargeting a clip */
/*  from Gesture.glb onto it - see the explanation below the code for   */
/*  why, given I haven't verified the two files share a rig.            */
/* ================================================================== */

interface ActorProps {
  groupRef: React.MutableRefObject<THREE.Group>;
  phase: ScenePhase;
}

interface RunActorProps extends ActorProps {
  progressRef: React.MutableRefObject<number>;
}

function RunActor({ groupRef, phase, progressRef }: RunActorProps) {
  const { scene, animations } = useGLTF(RUN_URL);
  const modelRef = useRef<THREE.Group>(null!);

  useMemo(() => {
    animations.forEach((clip) => {
      clip.tracks = clip.tracks.filter((track) => {
        const name = track.name.toLowerCase();
        return (
          !name.includes('hips.position') &&
          !name.includes('mixamorighips.position') &&
          !name.includes('armature.position') &&
          !name.endsWith('.position')
        );
      });
    });
  }, [animations]);

  const { actions, names } = useAnimations(animations, modelRef);
  const materials = useMemo(() => collectMaterials(scene), [scene]);
  const opacityRef = useRef(1);
  const fadedOutRef = useRef(false);
  const runActionRef = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => {
    if (isDev) console.log('[HeroScene] Run.glb clips:', names);
    const clipName = pickClip(names, RUN_CLIP_PATTERN);
    const action = clipName ? actions[clipName] : undefined;
    runActionRef.current = action ?? null;
    action?.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    return () => {
      Object.values(actions).forEach((a) => a?.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actions, names]);

  useFrame((_, delta) => {
    // Decelerate the stride through the last ~15% of the approach instead
    // of cutting a full-speed run-cycle off abruptly at arrival.
    const action = runActionRef.current;
    if (action && phase !== 'gesture') {
      const t = progressRef.current;
      const decelStart = 0.85;
      action.timeScale =
        t <= decelStart ? 1 : THREE.MathUtils.lerp(1, 0.1, (t - decelStart) / (1 - decelStart));
    }

    const target = phase === 'gesture' ? 0 : 1;
    opacityRef.current = THREE.MathUtils.damp(opacityRef.current, target, 6, delta);
    setOpacity(materials, opacityRef.current);
    groupRef.current.visible = opacityRef.current > 0.01;

    if (phase === 'gesture' && !fadedOutRef.current) {
      fadedOutRef.current = true;
      action?.fadeOut(CROSSFADE);
    }
  });

  return (
    <group ref={modelRef}>
      <primitive object={scene} scale={MODEL_SCALE} />
    </group>
  );
}

/* ================================================================== */
/*  Gesture actor                                                       */
/*  Invisible and idle until the "gesture" phase, then fades itself in  */
/*  and crossfades its own clip in - mirrors the spec's                */
/*  runAction.fadeOut(0.5) / gestureAction.reset().fadeIn(0.5).play()   */
/* ================================================================== */

function GestureActor({ groupRef, phase }: ActorProps) {
  const { scene, animations } = useGLTF(GESTURE_URL);
  const modelRef = useRef<THREE.Group>(null!);

  useMemo(() => {
    animations.forEach((clip) => {
      clip.tracks = clip.tracks.filter((track) => {
        const name = track.name.toLowerCase();
        return (
          !name.includes('hips.position') &&
          !name.includes('mixamorighips.position') &&
          !name.includes('armature.position') &&
          !name.endsWith('.position')
        );
      });
    });
  }, [animations]);

  const { actions, names } = useAnimations(animations, modelRef);
  const materials = useMemo(() => collectMaterials(scene), [scene]);
  const opacityRef = useRef(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (isDev) console.log('[HeroScene] Gesture.glb clips:', names);
    setOpacity(materials, 0);
  }, [materials, names]);

  useFrame((_, delta) => {
    const target = phase === 'gesture' ? 1 : 0;
    opacityRef.current = THREE.MathUtils.damp(opacityRef.current, target, 6, delta);
    setOpacity(materials, opacityRef.current);
    groupRef.current.visible = opacityRef.current > 0.01;

    if (phase === 'gesture' && !startedRef.current) {
      startedRef.current = true;
      const clipName = pickClip(names, GESTURE_CLIP_PATTERN);
      const action = clipName ? actions[clipName] : undefined;
      action?.reset().fadeIn(CROSSFADE).setLoop(THREE.LoopRepeat, Infinity).play();
    }
  });

  return (
    <group ref={modelRef}>
      <primitive object={scene} scale={MODEL_SCALE} />
    </group>
  );
}

/* ================================================================== */
/*  Robot rig                                                           */
/*  Owns the walk-in motion and the time-based phase transitions.       */
/*  Renders both actors stacked on the same moving anchor so the        */
/*  opacity + action crossfade above can blend smoothly between them.   */
/* ================================================================== */

interface RobotProps {
  phase: ScenePhase;
  setPhase: (phase: ScenePhase) => void;
}

function Robot({ phase, setPhase }: RobotProps) {
  const moveGroup = useRef<THREE.Group>(null!);
  const runGroup = useRef<THREE.Group>(null!);
  const gestureGroup = useRef<THREE.Group>(null!);
  const elapsed = useRef(0);
  const stopClock = useRef(0);
  const progressRef = useRef(0); // 0..1 walk progress, read by RunActor for deceleration
  const revealFired = useRef(false);
  const stoppedFired = useRef(false);
  const gestureFired = useRef(false);

  useFrame((_, delta) => {
    const group = moveGroup.current;
    if (!group) return;

    if (phase === 'entering' || phase === 'revealTitle') {
      elapsed.current += delta;
      const t = Math.min(elapsed.current / WALK_DURATION, 1);
      progressRef.current = t;
      const eased = t * t * (3 - 2 * t); // smoothstep

      group.position.lerpVectors(START_POS, TARGET_POS, eased);
      group.rotation.y = THREE.MathUtils.lerp(ENTRY_ROTATION_Y, FACING_ROTATION_Y, eased);

      if (!revealFired.current && t >= REVEAL_AT) {
        revealFired.current = true;
        setPhase('revealTitle');
      }
      if (!stoppedFired.current && t >= 1) {
        stoppedFired.current = true;
        setPhase('stopped');
      }
    } else if (phase === 'stopped') {
      progressRef.current = 1;
      stopClock.current += delta;
      group.position.y = TARGET_POS.y + Math.sin(stopClock.current * 2) * 0.004; // tiny settle, not a full idle loop
      if (!gestureFired.current && stopClock.current >= STOP_HOLD) {
        gestureFired.current = true;
        setPhase('gesture');
      }
    } else {
      progressRef.current = 1;
    }
  });

  return (
    <group
      ref={moveGroup}
      position={[START_POS.x, START_POS.y, START_POS.z]}
      rotation={[0, ENTRY_ROTATION_Y, 0]}
    >
      <group ref={runGroup}>
        <RunActor groupRef={runGroup} phase={phase} progressRef={progressRef} />
      </group>
      <group ref={gestureGroup}>
        <GestureActor groupRef={gestureGroup} phase={phase} />
      </group>
    </group>
  );
}

/* ================================================================== */
/*  Camera                                                              */
/* ================================================================== */

function ResponsiveCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 52; // within the 50-55 cinematic range requested
    const aspect = size.width / size.height;
    if (aspect < 0.7) {
      cam.position.set(0.25, 0.85, 7.8);
    } else if (aspect < 1.2) {
      cam.position.set(0.15, 0.7, 6.9);
    } else {
      cam.position.set(0.05, 0.58, 6.25);
    }
    cam.lookAt(0, 0.35, 0);
    cam.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

/* ================================================================== */
/*  Loader (rarely seen now - see explanation re: nested Suspense)      */
/* ================================================================== */

function Loader() {
  return (
    <div style={loaderStyle}>
      <div style={spinnerStyle} />
    </div>
  );
}

const loaderStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#000',
  zIndex: 1,
};

const spinnerStyle: React.CSSProperties = {
  width: 40,
  height: 40,
  border: '3px solid rgba(255,255,255,0.15)',
  borderTopColor: '#a78bfa',
  borderRadius: '50%',
  animation: 'hero-spin 0.8s linear infinite',
};

/* ================================================================== */
/*  Branding overlay                                                    */
/* ================================================================== */

const titleVariants = {
  hidden: { opacity: 0, scale: 0.7, y: 30, filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 1.0, ease: [0.16, 1, 0.3, 1] },
  },
};

const subtitleVariants = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] },
  },
};

const ctaVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

function BrandingOverlay({ visible }: { visible: boolean }) {
  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-end px-[8vw] z-20">
      <AnimatePresence>
        {visible && (
          <motion.div
            key="branding"
            className="flex flex-col items-start gap-3 max-w-[520px]"
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <motion.h1 style={titleStyle} variants={titleVariants}>
              Mockfy
            </motion.h1>

            <motion.p
              className="font-['Outfit'] text-[clamp(0.95rem,2vw,1.35rem)] font-light text-white/55 m-0 tracking-[0.5px]"
              variants={subtitleVariants}
            >
              an AI mock interview platform
            </motion.p>

            <motion.div variants={ctaVariants} className="mt-6 pointer-events-auto">
              <a href="/auth" style={ctaButtonStyle}>
                Get Started
                <span className="transition-transform duration-300 inline-block">&#8594;</span>
              </a>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ================================================================== */
/*  Particle fallback for when WebGL is unavailable / lost              */
/* ================================================================== */

function ParticleFallback() {
  return (
    <div className="absolute inset-0 overflow-hidden z-0">
      {Array.from({ length: 50 }, (_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            width: Math.random() * 3 + 1,
            height: Math.random() * 3 + 1,
            background: `rgba(139, 92, 246, ${Math.random() * 0.5 + 0.2})`,
            borderRadius: '50%',
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animation: `hero-float ${Math.random() * 6 + 4}s ease-in-out infinite`,
            animationDelay: `${Math.random() * 4}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ================================================================== */
/*  Main export                                                         */
/* ================================================================== */

export default function HeroScene() {
  const [phase, setPhase] = useState<ScenePhase>('entering');
  const [webglFailed, setWebglFailed] = useState(false);

  const handleWebGLError = useCallback(() => {
    setWebglFailed(true);
    setPhase('gesture'); // make sure the branding still reveals even without WebGL
  }, []);

  const titleVisible = phase !== 'entering';

  // Safety net: if the model/animations never resolve for any reason,
  // still reveal the branding rather than leaving the page blank.
  useEffect(() => {
    if (phase !== 'entering') return;
    const timer = setTimeout(() => setPhase('revealTitle'), WALK_DURATION * 1000 + 800);
    return () => clearTimeout(timer);
  }, [phase]);

  return (
    <section
      id="hero-scene"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: 'black',
        zIndex: 50,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap');
        @keyframes hero-spin { to { transform: rotate(360deg); } }
        @keyframes hero-bounce {
          0%, 100% { transform: translateY(0) rotate(45deg); }
          50% { transform: translateY(8px) rotate(45deg); }
        }
        @keyframes hero-float {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.2); opacity: 0.7; }
        }
      `}</style>

      {!webglFailed && (
        <WebGLErrorBoundary onError={handleWebGLError}>
          <Suspense fallback={<Loader />}>
            <Canvas
              dpr={[1, 1.5]}
              gl={{ antialias: true, alpha: false }}
              style={{ position: 'absolute', inset: 0, zIndex: 1 }}
              camera={{ fov: 52, near: 0.1, far: 100 }}
            >
              <ContextLossWatcher onLost={handleWebGLError} />
              <ResponsiveCamera />
              <color attach="background" args={['#000000']} />
              <fog attach="fog" args={['#000000', 9, 19]} />

              {/* Ambient fill + a key light + a cool rim light from behind. No shadow
                  maps, no Environment HDRI, no post-processing - keeps GPU cost low
                  and avoids the context-loss territory the brief flagged. */}
              <ambientLight intensity={0.35} color="#9badf7" />
              <directionalLight position={[4, 5, 3]} intensity={1.5} color="#e3e6ff" />
              <directionalLight position={[-4, 3.5, -4]} intensity={1.1} color="#5b6cff" />
              <pointLight position={[0, 2.2, -2.5]} intensity={0.35} color="#7c3aed" />

              {/* Nested Suspense scoped to just the robot: the rest of the scene
                  (lights, camera, controls) mounts immediately, and the viewport
                  stays plain black - matching Phase 1 - while the models load,
                  instead of the whole canvas vanishing behind a spinner. */}
              <Suspense fallback={null}>
                <Robot phase={phase} setPhase={setPhase} />
              </Suspense>

              <OrbitControls
                enabled={phase === 'gesture'}
                enableZoom={false}
                enablePan={false}
                maxPolarAngle={Math.PI / 2}
                minPolarAngle={Math.PI / 4}
                autoRotate={false}
                target={[0, 0.35, 0]}
              />

              <EffectComposer disableNormalPass>
                <Bloom luminanceThreshold={1} mipmapBlur intensity={1.5} />
              </EffectComposer>
            </Canvas>
          </Suspense>
        </WebGLErrorBoundary>
      )}

      {webglFailed && <ParticleFallback />}

      <BrandingOverlay visible={titleVisible} />


    </section>
  );
}

/* ================================================================== */
/*  Styles                                                              */
/* ================================================================== */

const titleStyle: React.CSSProperties = {
  fontFamily: "'Outfit', sans-serif",
  fontSize: 'clamp(3rem, 7vw, 5.5rem)',
  fontWeight: 700,
  letterSpacing: '-2px',
  lineHeight: 1,
  margin: 0,
  background: 'linear-gradient(135deg, #c4b5fd 0%, #818cf8 40%, #7c3aed 100%)',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 0 30px rgba(124, 58, 237, 0.4))',
};

const ctaButtonStyle: React.CSSProperties = {
  fontFamily: "'Outfit', sans-serif",
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '14px 32px',
  fontSize: '1rem',
  fontWeight: 600,
  color: '#fff',
  background: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
  border: '1px solid rgba(139, 92, 246, 0.3)',
  borderRadius: 12,
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'all 0.3s ease',
  boxShadow: '0 0 20px rgba(124, 58, 237, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
};

useGLTF.preload(RUN_URL);
useGLTF.preload(GESTURE_URL);
