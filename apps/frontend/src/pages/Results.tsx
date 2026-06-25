import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

interface Evaluation {
  score: number;
  feedbackSummary: string;
  strengths: string[];
  areasForImprovement: string[];
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
          throw new Error("Failed to fetch evaluation.");
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
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white gap-6">
        <motion.div 
          className="w-16 h-16 border-4 border-t-emerald-500 border-r-emerald-500/50 border-b-emerald-500/10 border-l-emerald-500/50 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
        <h2 className="text-xl text-emerald-400 font-semibold tracking-wide animate-pulse">Analyzing Interview...</h2>
        <p className="text-gray-400 text-sm max-w-sm text-center">Gemini 2.5 Flash is reviewing your transcripts and calculating your final score.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white gap-4">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h2 className="text-2xl font-bold">Evaluation Failed</h2>
        <p className="text-gray-400">{error}</p>
        <button onClick={() => navigate('/upload')} className="mt-8 px-6 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg transition-colors">
          Return Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white py-20 px-4 flex flex-col items-center">
      <AnimatePresence>
        {evaluation && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl flex flex-col gap-8"
          >
            {/* Header & Score */}
            <div className="flex flex-col md:flex-row items-center md:items-start justify-between bg-neutral-900 border border-neutral-800 p-8 rounded-3xl shadow-2xl">
              <div className="flex flex-col gap-4">
                <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
                  Interview Complete
                </h1>
                <p className="text-gray-400 text-lg max-w-lg leading-relaxed">
                  {evaluation.feedbackSummary}
                </p>
              </div>
              <div className="mt-8 md:mt-0 flex flex-col items-center shrink-0">
                <div className="relative flex items-center justify-center w-40 h-40">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#262626" strokeWidth="8" />
                    <motion.circle 
                      cx="50" cy="50" r="45" fill="none" stroke="#34d399" strokeWidth="8"
                      strokeDasharray="283"
                      initial={{ strokeDashoffset: 283 }}
                      animate={{ strokeDashoffset: 283 - (283 * evaluation.score) / 100 }}
                      transition={{ duration: 2, ease: "easeOut", delay: 0.5 }}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className="text-5xl font-black text-white">{evaluation.score}</span>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Score</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Grid for Strengths & Weaknesses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Strengths */}
              <div className="bg-emerald-950/20 border border-emerald-900/30 p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl">⭐</div>
                  <h3 className="text-xl font-bold text-emerald-400">Strengths</h3>
                </div>
                <ul className="flex flex-col gap-4">
                  {evaluation.strengths.map((s, i) => (
                    <motion.li 
                      key={i} 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ delay: 0.8 + (i * 0.1) }}
                      className="flex items-start gap-3 text-gray-300"
                    >
                      <span className="text-emerald-500 mt-1">✓</span>
                      <span>{s}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>

              {/* Areas for Improvement */}
              <div className="bg-amber-950/20 border border-amber-900/30 p-8 rounded-3xl">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 text-xl">📈</div>
                  <h3 className="text-xl font-bold text-amber-400">Areas for Growth</h3>
                </div>
                <ul className="flex flex-col gap-4">
                  {evaluation.areasForImprovement.map((a, i) => (
                    <motion.li 
                      key={i} 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }} 
                      transition={{ delay: 1.2 + (i * 0.1) }}
                      className="flex items-start gap-3 text-gray-300"
                    >
                      <span className="text-amber-500 mt-1">→</span>
                      <span>{a}</span>
                    </motion.li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-center mt-8">
              <button onClick={() => navigate('/upload')} className="px-8 py-4 bg-white text-black font-bold rounded-full hover:bg-gray-200 transition-colors shadow-lg shadow-white/10">
                Start New Interview
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}