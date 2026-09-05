import React, { useState } from 'react';
import { BookOpen, Shield, Brain, ArrowRight, AlertCircle } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

interface LandingPageProps {
  onSignInSuccess: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onSignInSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
      onSignInSuccess();
    } catch (err: any) {
      console.warn('Sign-in cancelled or failed:', err);
      // Clean, honest message for cancelled or failed sign-ins
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        setErrorMessage('Sign-in was cancelled. You remain signed out.');
      } else if (err.code === 'auth/network-request-failed') {
        setErrorMessage('Network connection error during sign-in. Please check your network.');
      } else {
        setErrorMessage(err.message || 'Unable to complete sign-in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F5F8FC] text-[#12243A]">
      {/* Header */}
      <header className="border-b border-[#DCE5F0] bg-[#FFFFFF] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] bg-[#2457D6] flex items-center justify-center text-white font-semibold tracking-tight">
              D
            </div>
            <div>
              <span className="font-semibold text-lg tracking-tight text-[#12243A]">DAYNOTE</span>
              <span className="hidden sm:inline text-xs text-[#52657A] ml-2 font-normal border-l border-[#DCE5F0] pl-2">
                Personal Gemini Journal
              </span>
            </div>
          </div>
          <button
            id="header-signin-btn"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-[#2457D6] bg-[#EAF1FF] hover:bg-[#DCE5F0] rounded-[8px] transition-colors disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Sign in with Google'}
          </button>
        </div>
      </header>

      {/* Main Hero & Content */}
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-20 flex-1 flex flex-col justify-center">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tight text-[#12243A] leading-tight mb-4">
            A private space to think clearly and move forward.
          </h1>
          <p className="text-lg text-[#52657A] leading-relaxed mb-8">
            Write daily reflections, brainstorm through complex problems, and have a thoughtful multi-turn conversation with Gemini. Automatically summarize insights and turn reflections into small, editable next steps.
          </p>

          {errorMessage && (
            <div className="mb-6 p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-[8px] text-sm flex items-center gap-2 text-left justify-center">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-amber-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              id="hero-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-3.5 bg-[#2457D6] hover:bg-[#1D46AF] text-white font-medium rounded-[8px] transition-all flex items-center justify-center gap-3 shadow-sm disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
              <ArrowRight className="w-4 h-4 ml-1" />
            </button>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#FFFFFF] border border-[#DCE5F0] rounded-[12px] p-6 shadow-sm">
            <div className="w-10 h-10 rounded-[8px] bg-[#EAF1FF] text-[#2457D6] flex items-center justify-center mb-4">
              <BookOpen className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-[#12243A] text-base mb-2">Reflective conversations</h3>
            <p className="text-sm text-[#52657A] leading-relaxed">
              Explore your thoughts through thoughtful multi-turn dialogues that ask clarifying questions rather than generic answers.
            </p>
          </div>

          <div className="bg-[#FFFFFF] border border-[#DCE5F0] rounded-[12px] p-6 shadow-sm">
            <div className="w-10 h-10 rounded-[8px] bg-[#EAF1FF] text-[#2457D6] flex items-center justify-center mb-4">
              <Brain className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-[#12243A] text-base mb-2">Automated summaries</h3>
            <p className="text-sm text-[#52657A] leading-relaxed">
              Synthesize key themes, pending decisions, and unresolved questions automatically after each completed exchange.
            </p>
          </div>

          <div className="bg-[#FFFFFF] border border-[#DCE5F0] rounded-[12px] p-6 shadow-sm">
            <div className="w-10 h-10 rounded-[8px] bg-[#EAF1FF] text-[#2457D6] flex items-center justify-center mb-4">
              <Shield className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-[#12243A] text-base mb-2">Complete privacy</h3>
            <p className="text-sm text-[#52657A] leading-relaxed">
              Isolated user storage strictly under your authenticated account. No public feeds, social sharing, or unauthorized access.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#DCE5F0] bg-[#FFFFFF] px-6 py-4 text-xs text-[#52657A]">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Daynote &bull; Personal Gemini Journal</span>
          <span>Powered by Google Cloud Run &amp; Gemini</span>
        </div>
      </footer>
    </div>
  );
};
