import { useState } from 'react';
import { motion } from 'framer-motion';
import { useAudioRecorder } from '../hooks/useAudioRecorder';

export default function InterviewRoom() {
  const { isRecording, startRecording, stopRecording } = useAudioRecorder();
  const [aiState, setAiState] = useState<'idle' | 'listening' | 'speaking'>('idle');

  const handleMicToggle = async () => {
    if (isRecording) {
      setAiState('idle');
      const audioBlob = await stopRecording();
      
      if (audioBlob) {
        console.log("Captured Audio Blob size:", audioBlob.size);

      }
    } else {
      setAiState('listening');
      await startRecording();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white gap-20">
      

      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center w-32 h-32 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/20">
          <span className="text-xl font-bold">AI</span>
          

          {aiState === 'speaking' && (
             <motion.div
               className="absolute inset-0 rounded-full border-4 border-emerald-400"
               animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0, 0.8] }}
               transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
             />
          )}
        </div>
        <p className="text-sm text-gray-400 tracking-widest uppercase">
          {aiState === 'listening' ? 'Listening...' : 'Interviewer'}
        </p>
      </div>


      <div className="flex flex-col items-center gap-4">
        <button 
          onClick={handleMicToggle}
          className="relative flex items-center justify-center w-24 h-24 rounded-full bg-blue-600 hover:bg-blue-500 transition-colors z-10"
        >
          <span className="text-lg font-bold">You</span>
          

          {isRecording && (
             <motion.div
               className="absolute inset-0 rounded-full bg-blue-500 -z-10"
               animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
               transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
             />
          )}
        </button>
        <p className="text-sm text-gray-400 tracking-widest uppercase">
          {isRecording ? 'Tap to Stop' : 'Tap to Speak'}
        </p>
      </div>

    </div>
  );
}