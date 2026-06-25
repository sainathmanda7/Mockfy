import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useGeminiLiveAPI } from '../hooks/useGeminiLiveAPI';

export default function Interview() {
  const location = useLocation();
  const navigate = useNavigate();
  const candidateData = location.state?.candidateData;
  const expectedQuestions = location.state?.expectedQuestions || 5;

  const { connect, startRecording, stopRecording, isRecording, aiState, initAudioPlayback, userTranscript, aiTranscript } =
    useGeminiLiveAPI('ws://localhost:8080/api/chat');

  const [statusText, setStatusText] = useState('Connecting to AI Interviewer...');
  const [interviewStarted, setInterviewStarted] = useState(false);

  const connectRef = useRef(connect);
  useEffect(() => { connectRef.current = connect; }, [connect]);

  // Navigate to results when interview ends
  useEffect(() => {
    if (aiTranscript.toLowerCase().includes("interview complete")) {
      navigate('/results');
    }
  }, [aiTranscript, navigate]);

  useEffect(() => {
    if (!candidateData) {
      setStatusText('No candidate data. Redirecting...');
      const t = setTimeout(() => navigate('/upload'), 2000);
      return () => clearTimeout(t);
    }
    
    // Inject expectedQuestions into the payload for the backend
    const payload = {
      ...candidateData,
      expectedQuestions
    };

    const cleanup = connectRef.current(() => {
      setStatusText('Connected! Click "Begin Interview" to start.');
    }, JSON.stringify(payload));
    
    return cleanup;
  }, [candidateData, expectedQuestions, navigate]);

  useEffect(() => {
    if (!interviewStarted) return;
    switch (aiState) {
      case 'speaking':  setStatusText('AI is speaking...'); break;
      case 'listening': setStatusText('AI is listening to you...'); break;
      case 'ready':     if (!isRecording) setStatusText('Tap the mic to speak.'); break;
    }
  }, [aiState, isRecording, interviewStarted]);

  const handleBeginInterview = useCallback(async () => {
    await initAudioPlayback();
    setInterviewStarted(true);
    setStatusText('AI is speaking...');
  }, [initAudioPlayback]);

  const handleMicToggle = useCallback(() => {
    if (isRecording) { stopRecording(); setStatusText('Processing...'); }
    else { startRecording(); }
  }, [isRecording, startRecording, stopRecording]);

  const isConnected = aiState !== 'idle' && aiState !== 'connecting';

  // Helper to ensure transcript stays on a single line (scrolling window)
  const getScrollingText = (text: string, maxWords = 12) => {
    if (!text) return '';
    const words = text.split(' ').filter(w => w.trim().length > 0);
    if (words.length <= maxWords) return text;
    return '... ' + words.slice(-maxWords).join(' ');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white gap-16 px-4 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.p key={statusText} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          className="text-sm text-gray-400 tracking-wider text-center max-w-md">{statusText}</motion.p>
      </AnimatePresence>

      {/* AI Avatar */}
      <div className="flex flex-col items-center gap-5 w-full max-w-2xl">
        <div className="relative flex items-center justify-center w-36 h-36 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-2xl shadow-emerald-500/30">
          <span className="text-2xl font-bold tracking-wide">AI</span>
          {aiState === 'speaking' && interviewStarted && (
            <>
              <motion.div className="absolute inset-0 rounded-full border-2 border-emerald-400"
                animate={{ scale: [1, 1.4], opacity: [0.6, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }} />
              <motion.div className="absolute inset-0 rounded-full border-2 border-emerald-300"
                animate={{ scale: [1, 1.25], opacity: [0.4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut', delay: 0.3 }} />
            </>
          )}
          {aiState === 'connecting' && (
            <motion.div className="absolute inset-0 rounded-full border-2 border-t-transparent border-emerald-400"
              animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} />
          )}
        </div>
        <p className="text-xs text-gray-500 tracking-[0.25em] uppercase font-medium">
          {aiState === 'connecting' ? 'Connecting...' : aiState === 'speaking' ? 'Speaking' : aiState === 'listening' ? 'Listening' : 'Interviewer'}
        </p>
        
        {/* AI Transcript */}
        <div className="h-8 mt-2 text-center text-emerald-300/80 text-xl font-light tracking-wide px-4 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
          <AnimatePresence>
            {aiTranscript && (
              <motion.span
                key={getScrollingText(aiTranscript)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                "{getScrollingText(aiTranscript)}"
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Begin Interview button OR Mic button */}
      {isConnected && !interviewStarted ? (
        <button onClick={handleBeginInterview}
          className="px-8 py-4 rounded-full bg-emerald-600 hover:bg-emerald-500 text-lg font-semibold transition-all shadow-lg shadow-emerald-500/30">
          🎙️ Begin Interview
        </button>
      ) : (
        <div className="flex flex-col items-center gap-5 w-full max-w-2xl">
          <button onClick={handleMicToggle}
            disabled={!isConnected || !interviewStarted || aiState === 'speaking'}
            className={`relative flex items-center justify-center w-28 h-28 rounded-full transition-all duration-300 z-10
              ${!isConnected || !interviewStarted || aiState === 'speaking'
                ? 'bg-gray-700 cursor-not-allowed opacity-50'
                : isRecording ? 'bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/30'
                : 'bg-blue-600 hover:bg-blue-500 shadow-lg shadow-blue-500/30'}`}>
            {isRecording ? (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
            ) : (
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            )}
            {isRecording && (
              <motion.div className="absolute inset-0 rounded-full bg-red-500 -z-10"
                animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }} />
            )}
          </button>
          <p className="text-xs text-gray-500 tracking-[0.25em] uppercase font-medium">
            {!interviewStarted ? 'Waiting...' : aiState === 'speaking' ? 'AI is speaking' : isRecording ? 'Tap to Stop' : 'Tap to Speak'}
          </p>

          {/* User Transcript */}
          <div className="h-8 mt-2 text-center text-blue-300/80 text-xl font-light tracking-wide px-4 whitespace-nowrap overflow-hidden text-ellipsis max-w-full">
            <AnimatePresence>
              {userTranscript && (
                <motion.span
                  key={getScrollingText(userTranscript)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  "{getScrollingText(userTranscript)}"
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}