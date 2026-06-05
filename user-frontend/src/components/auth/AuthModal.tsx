import React, { useState } from 'react';
import { X } from 'lucide-react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login } = useAuth();
  const [isLoginView, setIsLoginView] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLoginView ? '/api/auth/login' : '/api/auth/register';
    const payload = isLoginView ? { email, password } : { email, password, displayName };
    
    // In production, use the actual backend URL, maybe from env. 
    // Here we can use NEXT_PUBLIC_API_URL or hardcode for now.
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api';
    
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}${endpoint.replace('/api', '')}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Có lỗi xảy ra');
        return;
      }
      
      login({
        token: data.token,
        userId: data.userId,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        roleId: data.roleId
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError('');
    setLoading(true);
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api';
    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: credentialResponse.credential })
      });
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Có lỗi xảy ra khi đăng nhập Google');
        return;
      }
      
      login({
        token: data.token,
        userId: data.userId,
        displayName: data.displayName,
        avatarUrl: data.avatarUrl,
        roleId: data.roleId
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#131313] w-full max-w-md p-8 border border-white/10 rounded-sm relative shadow-2xl">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/40 hover:text-white transition">
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-3xl font-serif font-bold text-white mb-2">
          {isLoginView ? 'Welcome Back' : 'Join TviEn'}
        </h2>
        <p className="text-white/40 text-sm tracking-wide mb-8">
          {isLoginView ? 'Enter your credentials to access your account.' : 'Create an account to track your watch history.'}
        </p>

        {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-sm">{error}</div>}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {!isLoginView && (
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Display Name</label>
              <input 
                type="text" 
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="w-full bg-white/5 border border-white/10 p-3 text-white focus:border-white transition rounded-sm outline-none"
                placeholder="John Doe"
              />
            </div>
          )}
          
          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Email Address</label>
            <input 
              type="email" 
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-3 text-white focus:border-white transition rounded-sm outline-none"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white/5 border border-white/10 p-3 text-white focus:border-white transition rounded-sm outline-none"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-white text-black py-4 mt-4 rounded-sm font-bold text-[11px] uppercase tracking-[0.2em] hover:bg-white/80 transition disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (isLoginView ? 'Sign In' : 'Create Account')}
          </button>
        </form>

        <div className="flex items-center my-6">
          <div className="flex-1 h-px bg-white/10"></div>
          <span className="px-4 text-[10px] uppercase tracking-widest text-white/40">Or continue with</span>
          <div className="flex-1 h-px bg-white/10"></div>
        </div>

        <div className="flex justify-center w-full [&>div]:w-full [&_iframe]:!w-full [&>div>div]:!w-full">
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Đăng nhập Google thất bại.')}
            theme="filled_black"
            shape="rectangular"
            width="100%"
          />
        </div>

        <div className="mt-8 text-center">
          <button 
            onClick={() => { setIsLoginView(!isLoginView); setError(''); }} 
            className="text-white/40 hover:text-white text-xs tracking-wide transition"
          >
            {isLoginView ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}
