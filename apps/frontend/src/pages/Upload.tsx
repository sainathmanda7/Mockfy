import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';

export default function Upload() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [githubLink, setGithubLink] = useState('');
  const [expectedQuestions, setExpectedQuestions] = useState<number>(5);
  const [isStarting, setIsStarting] = useState(false);

  const handleStartInterview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resumeFile) {
      alert("Please upload your resume first!");
      return;
    }

    if (expectedQuestions >= 10) {
      navigate('/subscription');
      return;
    }

    setIsStarting(true);
    try {
      const token = await getToken();
      const formData = new FormData();
      formData.append("resume", resumeFile);
      formData.append("github_url", githubLink);
      formData.append("expected_questions", expectedQuestions.toString());

      const response = await fetch("http://localhost:8080/api/start-interview", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}` 
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Backend rejected request: ${response.status}`);
      }
      if (response.ok) {
        const data = await response.json();
        console.log("Success!", data);
        
        navigate('/interview', { state: { candidateData: data, expectedQuestions } }); 
      }
    } catch (error) {
      console.error("Transmission failed:", error);
      alert("Failed to start the interview. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <div className="flex flex-col items-center mt-20 text-black">
      <h2 className="text-2xl font-bold mb-6">Upload Section</h2>
      <form onSubmit={handleStartInterview} className="flex flex-col gap-4 border p-6 rounded shadow-sm bg-white">
        <div className="flex flex-col gap-1">
          <label className="font-semibold">Upload Resume (PDF): </label>
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
            className="border p-2 rounded"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-semibold">GitHub Profile URL: </label>
          <input
            type="url"
            value={githubLink}
            onChange={(e) => setGithubLink(e.target.value)}
            required
            className="border p-2 rounded"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="font-semibold">Expected Questions: </label>
          <input
            type="number"
            min="1"
            max="50"
            value={expectedQuestions}
            onChange={(e) => setExpectedQuestions(parseInt(e.target.value) || 1)}
            required
            className="border p-2 rounded"
          />
        </div>
        <button 
          type="submit" 
          disabled={isStarting}
          className="mt-4 border bg-gray-100 p-2 rounded font-bold hover:bg-gray-200"
        >
          {isStarting ? 'Loading...' : 'Start Interview'}
        </button>
      </form>
    </div>
  );
}