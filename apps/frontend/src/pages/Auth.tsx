import { SignIn } from "@clerk/clerk-react";

export default function Auth(){
  return(
    <div className="min-h-[calc(100vh-73px)] relative overflow-hidden bg-[#000000] flex items-center justify-center py-16 px-4">
      {/* Neumorphic Ambient Background */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(circle at top left, rgba(0,255,170,0.03), transparent 60%)' }} />
      
      <div className="relative z-10 bg-[#080808] p-8 rounded-[32px] shadow-[12px_12px_24px_rgba(0,0,0,0.85),-8px_-8px_18px_rgba(255,255,255,0.03),inset_1px_1px_1px_rgba(255,255,255,0.02)] hover:-translate-y-[3px] transition-all duration-250 ease-out hover:shadow-[16px_16px_32px_rgba(0,0,0,0.9),-8px_-8px_20px_rgba(255,255,255,0.04)]">
        <SignIn 
          forceRedirectUrl="/upload" 
          signUpForceRedirectUrl="/upload"
          fallbackRedirectUrl="/upload"
          signUpFallbackRedirectUrl="/upload"
        />
      </div>
    </div>
  );
}