import { useNavigate } from 'react-router-dom';

export default function Subscription() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white gap-8 px-4">
      <h1 className="text-4xl font-bold text-emerald-400">Subscription Required</h1>
      <p className="text-lg text-gray-300 text-center max-w-md">
        You requested 10 or more questions. To access extended interview sessions, please upgrade to a premium plan.
      </p>
      <button 
        onClick={() => navigate('/upload')}
        className="px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 font-semibold transition-all"
      >
        Go Back
      </button>
    </div>
  );
}
