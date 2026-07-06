import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

export default function ResetPassword() {
  const router = useRouter();
  const { email } = router.query;

  const [step, setStep] = useState(1);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (otp.length !== 6) {
      setError('Mã OTP phải có đúng 6 chữ số.');
      setLoading(false);
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api';

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email as string, otp })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Mã OTP không hợp lệ.');
        return;
      }

      setStep(2);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 6) {
      setError('Mật khẩu mới phải chứa ít nhất 6 ký tự.');
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      setLoading(false);
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api';

    try {
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email as string,
          otp,
          newPassword: password
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Yêu cầu đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.');
        return;
      }

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || 'Lỗi kết nối đến máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Reset Password | TviEn Movie</title>
        <meta name="description" content="Đặt lại mật khẩu tài khoản TviEn" />
      </Head>

      <div className="min-h-screen bg-[#0a0a0a] text-white flex flex-col justify-center items-center px-4 relative overflow-hidden font-sans">
        {/* Ambient background glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-[#131313]/90 border border-white/10 p-8 rounded-sm relative z-10 shadow-2xl backdrop-blur-md">
          {/* Logo / Brand */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-serif font-bold tracking-wider text-white">TviEn</h1>
            <p className="text-white/40 text-xs uppercase tracking-[0.2em] mt-2">Movie Experience</p>
          </div>

          {success ? (
            <div className="text-center py-6 animate-fade-in">
              <div className="flex justify-center mb-6">
                <div className="bg-white/10 p-4 rounded-full border border-white/30">
                  <CheckCircle2 className="w-12 h-12 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-serif font-bold text-white mb-3">Thành Công!</h2>
              <p className="text-white/60 text-sm leading-relaxed mb-8">
                Mật khẩu của bạn đã được đặt lại thành công. Bạn có thể sử dụng mật khẩu mới để đăng nhập ngay bây giờ.
              </p>
              <Link 
                href="/" 
                className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-sm font-bold text-xs uppercase tracking-widest hover:bg-white/90 transition w-full justify-center"
              >
                <ArrowLeft className="w-4 h-4" /> Quay lại trang chủ
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-serif font-bold text-white mb-2">Nhập mã xác thực</h2>
              

              {error && (
                <div className="mb-6 p-4 bg-white/5 border border-white/20 text-white text-sm rounded-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {!email ? (
                <div className="p-4 bg-white/5 border border-white/20 text-white text-sm rounded-sm flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <span>Email yêu cầu đặt lại mật khẩu bị thiếu trong liên kết của bạn.</span>
                </div>
              ) : (
                <form onSubmit={step === 1 ? handleVerifyOtp : handleResetPassword} className="flex flex-col gap-5">
                  {step === 1 ? (
                    <>
                      <div className="relative">
                        <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2 text-center">Mã xác thực OTP (6 Số)</label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          value={otp}
                          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-white/5 border border-white/10 p-4 text-white focus:border-white/50 transition rounded-sm outline-none tracking-[0.5em] font-bold text-center text-2xl placeholder:tracking-normal placeholder:font-normal placeholder:text-base"
                          placeholder="Nhập 6 số từ Email"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-white text-black py-4 mt-4 rounded-sm font-bold text-[11px] uppercase tracking-[0.2em] hover:bg-white/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {loading ? (
                          <svg className="animate-spin h-5 w-5 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : 'XÁC NHẬN MÃ OTP'}
                      </button>
                    </>
                  ) : (
                    <>

                  <div className="relative">
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Mật khẩu mới</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 p-3 pr-10 text-white focus:border-white/50 transition rounded-sm outline-none"
                        placeholder="Tối thiểu 6 ký tự"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] uppercase tracking-widest text-white/40 mb-2">Xác nhận mật khẩu</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 p-3 text-white focus:border-white/50 transition rounded-sm outline-none"
                      placeholder="Nhập lại mật khẩu mới"
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
                    ) : 'CẬP NHẬT MẬT KHẨU'}
                  </button>
                    </>
                  )}
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
