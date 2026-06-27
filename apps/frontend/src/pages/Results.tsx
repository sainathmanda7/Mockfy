import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Canvas } from '@react-three/fiber';
import { useGLTF, useAnimations, OrbitControls } from '@react-three/drei';

interface Evaluation {
  score: number;
  feedbackSummary: string;
  strengths: string[];
  areasForImprovement: string[];
}

function formatText(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function RobotScene() {
  const { scene, animations } = useGLTF('/Boxing_Practice.glb');
  const { actions } = useAnimations(animations, scene);

  useEffect(() => {
    const actionName = Object.keys(actions)[0];
    if (actionName && actions[actionName]) {
      actions[actionName].reset().fadeIn(0.5).play();
    }
  }, [actions]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 5, 5]} intensity={1.5} color="#e3e6ff" />
      <directionalLight position={[-5, 5, -5]} intensity={0.8} color="#7c3aed" />
      <primitive object={scene} scale={2} position={[0, -1.5, 0]} />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1} />
    </>
  );
}

export default function Results() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchEvaluation() {
      try {
        const token = await getToken();
        const response = await fetch("http://localhost:8080/api/evaluate-interview", {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${token}`
          }
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(errText || "Failed to fetch evaluation.");
        }

        const data = await response.json();
        setEvaluation(data);
      } catch (err: any) {
        setError(err.message || "An error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchEvaluation();
  }, [getToken]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] bg-[#000000] text-[rgba(255,255,255,0.92)] gap-8 relative overflow-hidden drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top left, rgba(0,255,170,0.03), transparent 60%)' }} />
        
        <motion.div 
          className="relative w-24 h-24 rounded-full shadow-[inset_6px_6px_14px_rgba(0,0,0,0.9),inset_-4px_-4px_10px_rgba(255,255,255,0.03)]"
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        >
          <div className="absolute inset-0 rounded-full shadow-[0_0_15px_rgba(0,255,170,0.08)] border-t-2 border-emerald-500/30" />
        </motion.div>
        
        <div className="relative z-10 flex flex-col items-center gap-2">
          <h2 className="text-xl font-semibold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-gray-200 to-gray-500 animate-pulse">
            ANALYZING TRANSCRIPTS
          </h2>
          <p className="text-gray-500 font-light text-sm tracking-wide">Computing your final metrics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] bg-[#000000] text-[rgba(255,255,255,0.92)] gap-6 relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]">
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top left, rgba(239,68,68,0.03), transparent 60%)' }} />
        <h2 className="relative z-10 text-3xl font-light tracking-wide text-gray-200">Analysis Interrupted</h2>
        <p className="relative z-10 text-gray-500 font-light">{error}</p>
        <button onClick={() => navigate('/upload')} className="relative overflow-hidden group px-8 py-3 bg-[#080808] shadow-[6px_6px_12px_rgba(0,0,0,0.8),-4px_-4px_10px_rgba(255,255,255,0.03)] hover:-translate-y-[2px] hover:shadow-[8px_8px_16px_rgba(0,0,0,0.9),-4px_-4px_12px_rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.92)] text-sm font-medium tracking-wide rounded-full transition-all duration-250 ease-out">
          Return to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-73px)] relative overflow-hidden bg-[#000000] text-[rgba(255,255,255,0.92)] py-16 px-4 flex flex-col items-center font-sans selection:bg-emerald-500/30">
      {/* Neumorphic Ambient Background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top left, rgba(0,255,170,0.03), transparent 60%)' }} />

      <AnimatePresence>
        {evaluation && (
          <motion.div 
            initial={{ opacity: 0, y: 40 }} 
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 w-full max-w-7xl flex flex-col gap-8 text-[rgba(255,255,255,0.92)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]"
          >
            {/* Top Row: Hero Insights & 3D Robot */}
            <div className="flex flex-col xl:flex-row gap-8 lg:gap-12 w-full">
              {/* Hero Insights Card */}
              <div className="flex-1 relative overflow-hidden bg-[#080808] rounded-[32px] p-8 lg:p-12 flex flex-col lg:flex-row items-center gap-12 transition-all duration-250 ease-out hover:-translate-y-[3px] shadow-[12px_12px_24px_rgba(0,0,0,0.85),-8px_-8px_18px_rgba(255,255,255,0.03),inset_1px_1px_1px_rgba(255,255,255,0.02)] hover:shadow-[16px_16px_32px_rgba(0,0,0,0.9),-8px_-8px_20px_rgba(255,255,255,0.04)]">
                
                {/* Score Circular Indicator */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
                  className="relative flex items-center justify-center shrink-0 z-10"
                >
                  <div className="absolute inset-0 rounded-full shadow-[inset_6px_6px_14px_rgba(0,0,0,0.9),inset_-4px_-4px_10px_rgba(255,255,255,0.03),0_0_25px_rgba(0,255,170,0.08)] scale-100" />
                  
                  <div className="relative w-40 h-40">
                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
                      <motion.circle 
                        cx="50" cy="50" r="45" fill="none" stroke="url(#scoreGradient)" strokeWidth="6"
                        strokeDasharray="283"
                        initial={{ strokeDashoffset: 283 }}
                        animate={{ strokeDashoffset: 283 - (283 * evaluation.score) / 100 }}
                        transition={{ duration: 2.5, ease: "easeOut", delay: 0.6 }}
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#34d399" />
                          <stop offset="100%" stopColor="#14b8a6" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-5xl font-bold tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-400">{evaluation.score}</span>
                      <span className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.2em] mt-1">Score</span>
                    </div>
                  </div>
                </motion.div>

                {/* Text Block */}
                <div className="flex-1 flex flex-col gap-6 z-10 justify-center">
                  <h1 className="text-4xl lg:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-white via-gray-200 to-gray-500 leading-tight">
                    Score card
                  </h1>
                  <p className="text-gray-400 text-base lg:text-lg leading-relaxed font-light max-w-xl">
                    {formatText(evaluation.feedbackSummary)}
                  </p>
                </div>
              </div>

              {/* Right Column: 3D Robot Scene */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5, duration: 1 }}
                className="hidden xl:flex w-[400px] shrink-0 relative min-h-[350px]"
              >
                <Canvas camera={{ position: [0, 1, 5], fov: 50 }} className="w-full h-full" gl={{ alpha: true, antialias: true }}>
                  <RobotScene />
                </Canvas>
              </motion.div>
            </div>

            {/* Grid for Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
              {/* Strengths */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-[#080808] p-8 rounded-[32px] relative overflow-hidden group transition-all duration-250 ease-out hover:-translate-y-[3px] shadow-[12px_12px_24px_rgba(0,0,0,0.85),-8px_-8px_18px_rgba(255,255,255,0.03),inset_1px_1px_1px_rgba(255,255,255,0.02)] hover:shadow-[16px_16px_32px_rgba(0,0,0,0.9),-8px_-8px_20px_rgba(255,255,255,0.04)]"
              >
                <h3 className="text-xl font-semibold mb-8 flex items-center gap-4 text-gray-100">
                   Key Strengths
                </h3>
                <ul className="flex flex-col gap-5 relative z-10">
                  {evaluation.strengths.map((s, i) => (
                    <motion.li 
                      key={i} 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ delay: 0.8 + (i * 0.1) }}
                      className="flex items-start gap-4 text-gray-400 font-light leading-relaxed group/item"
                    >
                      <div className="w-2 h-2 rounded-full bg-[#0c0c0c] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.8),inset_-1px_-1px_2px_rgba(255,255,255,0.03)] flex-shrink-0 mt-2" />
                      <span className="group-hover/item:text-[rgba(255,255,255,0.92)] transition-colors text-sm">{formatText(s)}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>

              {/* Areas for Improvement */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-[#080808] p-8 rounded-[32px] relative overflow-hidden group transition-all duration-250 ease-out hover:-translate-y-[3px] shadow-[12px_12px_24px_rgba(0,0,0,0.85),-8px_-8px_18px_rgba(255,255,255,0.03),inset_1px_1px_1px_rgba(255,255,255,0.02)] hover:shadow-[16px_16px_32px_rgba(0,0,0,0.9),-8px_-8px_20px_rgba(255,255,255,0.04)]"
              >
                <h3 className="text-xl font-semibold mb-8 flex items-center gap-4 text-gray-100">
                   Areas for Growth
                </h3>
                <ul className="flex flex-col gap-5 relative z-10">
                  {evaluation.areasForImprovement.map((a, i) => (
                    <motion.li 
                      key={i} 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ delay: 0.9 + (i * 0.1) }}
                      className="flex items-start gap-4 text-gray-400 font-light leading-relaxed group/item"
                    >
                      <div className="w-2 h-2 rounded-full bg-[#0c0c0c] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.8),inset_-1px_-1px_2px_rgba(255,255,255,0.03)] flex-shrink-0 mt-2" />
                      <span className="group-hover/item:text-[rgba(255,255,255,0.92)] transition-colors text-sm">{formatText(a)}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </div>

            {/* Actions */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="flex justify-center mt-4"
            >
              <button 
                onClick={() => navigate('/upload')} 
                className="relative overflow-hidden group px-8 py-3 bg-[#080808] shadow-[6px_6px_12px_rgba(0,0,0,0.8),-4px_-4px_10px_rgba(255,255,255,0.03)] hover:-translate-y-[2px] hover:shadow-[8px_8px_16px_rgba(0,0,0,0.9),-4px_-4px_12px_rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.92)] text-sm font-medium tracking-wide rounded-full transition-all duration-250 ease-out"
              >
                <span className="relative z-10">Start New Interview</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}