import React, { useState, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload as UploadIcon, FileText, CheckCircle, ChevronRight, Code, Bot } from 'lucide-react';
import UploadMascot from '../components/UploadMascot';
const SKILLS = [
  "React", "TypeScript", "Node.js", "Python", "Go", "UI/UX", "System Design", "AWS", "Docker"
];

export default function Upload() {
  const { getToken } = useAuth();
  const navigate = useNavigate();
  
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [githubLink, setGithubLink] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [expectedQuestions, setExpectedQuestions] = useState<number>(5);
  const [isStarting, setIsStarting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev => 
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    );
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setResumeFile(e.dataTransfer.files[0]);
    }
  };

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
      // Optionally pass jobDescription and selectedSkills if backend supports it later
      // formData.append("job_description", jobDescription);
      // formData.append("skills", selectedSkills.join(","));

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
      const data = await response.json();
      console.log("Success!", data);
      
      navigate('/interview', { state: { candidateData: data, expectedQuestions } }); 
    } catch (error) {
      console.error("Transmission failed:", error);
      alert("Failed to start the interview. Please try again.");
    } finally {
      setIsStarting(false);
    }
  };
  return (
    <div className="min-h-[calc(100vh-73px)] relative overflow-x-hidden bg-[#000000] text-[rgba(255,255,255,0.92)] drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] font-sans selection:bg-[#7C3AED]/30 overflow-y-auto">
      {/* Neumorphic Ambient Background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top left, rgba(0,255,170,0.03), transparent 60%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-6 lg:py-8 flex flex-col h-full">
        
        {/* Step Progress */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 mb-12"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#7C3AED] flex items-center justify-center text-sm font-bold shadow-[0_0_15px_rgba(124,58,237,0.3)]">
              1
            </div>
            <span className="text-white font-medium tracking-wide">Upload</span>
          </div>
          <div className="w-12 h-[1px] bg-white/10" />
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-sm font-medium">
              2
            </div>
            <span className="text-white/60">Interview</span>
          </div>
          <div className="w-12 h-[1px] bg-white/10" />
          <div className="flex items-center gap-2 opacity-50">
            <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center text-sm font-medium">
              3
            </div>
            <span className="text-white/60">Results</span>
          </div>
        </motion.div>

        {/* Main Content Layout */}
        <form onSubmit={handleStartInterview} className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          
          {/* Left Column - Form Interactions */}
          <div className="lg:col-span-7 flex flex-col gap-10">
            
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <h1 className="text-4xl lg:text-5xl font-bold tracking-tight mb-4">
                Configure your <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#7C3AED] to-[#A88BFA]">interview</span>.
              </h1>
              <p className="text-white/60 text-lg max-w-lg">
                Upload your resume and provide context to help our AI tailor the technical assessment to your experience.
              </p>
            </motion.div>

            {/* Area A: Resume Upload */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <label className="block text-sm font-medium text-white/80 mb-3">Resume / CV (PDF)</label>
              <motion.div
                whileHover={{ scale: 0.995 }}
                className={`relative group rounded-[32px] p-10 flex flex-col items-center justify-center text-center transition-all duration-300 cursor-pointer border border-transparent ${
                  isDragging 
                    ? 'border-[#7C3AED]/30 bg-[#0c0c0c] shadow-[inset_6px_6px_14px_rgba(0,0,0,0.9),inset_-4px_-4px_10px_rgba(255,255,255,0.03),0_0_25px_rgba(124,58,237,0.1)]' 
                    : 'bg-[#050505] shadow-[inset_6px_6px_14px_rgba(0,0,0,0.9),inset_-4px_-4px_10px_rgba(255,255,255,0.03)] hover:shadow-[inset_8px_8px_16px_rgba(0,0,0,0.95),inset_-4px_-4px_12px_rgba(255,255,255,0.04)]'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                />
                <AnimatePresence mode="wait">
                  {resumeFile ? (
                    <motion.div
                      key="file"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex flex-col items-center gap-3"
                    >
                      <div className="w-14 h-14 rounded-full bg-[#7C3AED]/20 flex items-center justify-center text-[#7C3AED]">
                        <CheckCircle size={28} />
                      </div>
                      <div>
                        <p className="text-white font-medium">{resumeFile.name}</p>
                        <p className="text-white/40 text-sm mt-1">{(resumeFile.size / 1024 / 1024).toFixed(2)} MB</p>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="upload"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.8, opacity: 0 }}
                      className="flex flex-col items-center gap-4"
                    >
                      <div className="w-14 h-14 rounded-full bg-white/5 group-hover:bg-white/10 flex items-center justify-center transition-colors">
                        <UploadIcon size={28} className="text-white/60 group-hover:text-white transition-colors" />
                      </div>
                      <div>
                        <p className="text-white/80 font-medium"><span className="text-[#7C3AED]">Click to upload</span> or drag and drop</p>
                        <p className="text-white/40 text-sm mt-2">PDF files up to 5MB</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </motion.div>

            {/* Area B: Job Description */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label className="block text-sm font-medium text-white/80 mb-3">Job Description</label>
              <div className="relative">
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the job description here..."
                  className="w-full bg-[#050505] shadow-[inset_6px_6px_14px_rgba(0,0,0,0.9),inset_-4px_-4px_10px_rgba(255,255,255,0.03)] rounded-2xl p-5 text-[rgba(255,255,255,0.92)] placeholder-white/30 focus:outline-none focus:shadow-[inset_6px_6px_14px_rgba(0,0,0,0.9),inset_-4px_-4px_10px_rgba(255,255,255,0.03),0_0_15px_rgba(124,58,237,0.15)] transition-all duration-300 resize-none h-32 scrollbar-thin scrollbar-thumb-white/10"
                />
                <FileText className="absolute top-5 right-5 text-white/20" size={20} />
              </div>
            </motion.div>

            {/* Additional Info Row (GitHub & Questions) */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="grid grid-cols-1 md:grid-cols-2 gap-6"
            >
              <div>
                <label className="block text-sm font-medium text-white/80 mb-3">GitHub Profile</label>
                <div className="relative flex items-center">
                  <Code className="absolute left-4 text-white/40" size={18} />
                  <input
                    type="url"
                    value={githubLink}
                    onChange={(e) => setGithubLink(e.target.value)}
                    placeholder="https://github.com/username"
                    required
                    className="w-full bg-[#050505] shadow-[inset_6px_6px_14px_rgba(0,0,0,0.9),inset_-4px_-4px_10px_rgba(255,255,255,0.03)] rounded-xl py-3 pl-12 pr-4 text-[rgba(255,255,255,0.92)] placeholder-white/30 focus:outline-none focus:shadow-[inset_6px_6px_14px_rgba(0,0,0,0.9),inset_-4px_-4px_10px_rgba(255,255,255,0.03),0_0_15px_rgba(124,58,237,0.15)] transition-all duration-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-3">Expected Questions</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={expectedQuestions}
                  onChange={(e) => setExpectedQuestions(parseInt(e.target.value) || 1)}
                  required
                  className="w-full bg-[#050505] shadow-[inset_6px_6px_14px_rgba(0,0,0,0.9),inset_-4px_-4px_10px_rgba(255,255,255,0.03)] rounded-xl py-3 px-4 text-[rgba(255,255,255,0.92)] focus:outline-none focus:shadow-[inset_6px_6px_14px_rgba(0,0,0,0.9),inset_-4px_-4px_10px_rgba(255,255,255,0.03),0_0_15px_rgba(124,58,237,0.15)] transition-all duration-300"
                />
              </div>
            </motion.div>

            {/* Skills Selection */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <label className="block text-sm font-medium text-white/80 mb-4">Core Skills Assessment</label>
              <div className="flex flex-wrap gap-3">
                {SKILLS.map((skill) => {
                  const isSelected = selectedSkills.includes(skill);
                  return (
                    <motion.button
                      key={skill}
                      type="button"
                      onClick={() => toggleSkill(skill)}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 border border-transparent ${
                        isSelected 
                          ? 'bg-[#0c0c0c] text-[#A88BFA] shadow-[inset_4px_4px_10px_rgba(0,0,0,0.9),inset_-2px_-2px_6px_rgba(255,255,255,0.03),0_0_15px_rgba(124,58,237,0.15)]' 
                          : 'bg-[#080808] text-[rgba(255,255,255,0.6)] shadow-[4px_4px_10px_rgba(0,0,0,0.8),-2px_-2px_6px_rgba(255,255,255,0.03)] hover:text-[rgba(255,255,255,0.92)] hover:-translate-y-[2px] hover:shadow-[6px_6px_12px_rgba(0,0,0,0.9),-4px_-4px_10px_rgba(255,255,255,0.04)]'
                      }`}
                    >
                      {skill}
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>

          </div>

          {/* Right Column - Visual/Mascot & CTA */}
          <div className="lg:col-span-5 flex flex-col justify-between items-center lg:items-end lg:pl-10 mt-10 lg:mt-0">
            
            {/* Mascot Placeholder */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, duration: 1 }}
              className="w-full aspect-square max-w-[400px] relative flex items-center justify-center"
            >
              <div className="w-full h-full rounded-full bg-[#080808] shadow-[12px_12px_24px_rgba(0,0,0,0.85),-8px_-8px_18px_rgba(255,255,255,0.03),inset_1px_1px_1px_rgba(255,255,255,0.02)] flex items-center justify-center relative overflow-hidden">
                {/* Simulated Glow Behind Mascot */}
                <div className="absolute inset-0 shadow-[inset_6px_6px_20px_rgba(0,0,0,0.9),0_0_40px_rgba(124,58,237,0.05)] rounded-full pointer-events-none" />
                
                {/* 3D Animated Robot Component */}
                <div className="absolute inset-0 z-10 p-4">
                  <UploadMascot />
                </div>
                
              </div>
            </motion.div>

            {/* Sticky/Bottom CTA */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="w-full mt-12 lg:mt-0 pb-10"
            >
              <div className="p-6 rounded-3xl bg-[#080808] shadow-[12px_12px_24px_rgba(0,0,0,0.85),-8px_-8px_18px_rgba(255,255,255,0.03),inset_1px_1px_1px_rgba(255,255,255,0.02)] flex flex-col gap-4 backdrop-blur-sm">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-white/60">Upload status</span>
                  <span className={resumeFile ? "text-emerald-400" : "text-white/40"}>
                    {resumeFile ? "Ready" : "Pending PDF"}
                  </span>
                </div>
                <motion.button
                  type="submit"
                  disabled={isStarting || !resumeFile}
                  whileHover={{ scale: resumeFile && !isStarting ? 1.02 : 1 }}
                  whileTap={{ scale: resumeFile && !isStarting ? 0.98 : 1 }}
                  className={`w-full py-4 rounded-full flex items-center justify-center gap-3 font-semibold text-lg transition-all duration-300 relative overflow-hidden ${
                    resumeFile 
                      ? 'bg-[#080808] text-[rgba(255,255,255,0.92)] shadow-[6px_6px_12px_rgba(0,0,0,0.8),-4px_-4px_10px_rgba(255,255,255,0.03)] hover:-translate-y-[2px] hover:shadow-[8px_8px_16px_rgba(0,0,0,0.9),-4px_-4px_12px_rgba(255,255,255,0.04),0_0_20px_rgba(124,58,237,0.2)]' 
                      : 'bg-[#050505] text-white/30 cursor-not-allowed shadow-[inset_6px_6px_14px_rgba(0,0,0,0.9),inset_-4px_-4px_10px_rgba(255,255,255,0.02)]'
                  }`}
                >
                  {isStarting ? (
                    <motion.div 
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
                    />
                  ) : (
                    <>
                      <span>Start Interview</span>
                      <ChevronRight size={20} />
                    </>
                  )}
                  {/* Button Inner Glow */}
                  {resumeFile && (
                    <div className="absolute inset-0 rounded-full ring-1 ring-white/20 pointer-events-none" />
                  )}
                </motion.button>
              </div>
            </motion.div>

          </div>
        </form>
      </div>
    </div>
  );
}