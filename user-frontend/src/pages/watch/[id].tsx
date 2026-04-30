import React, { useEffect, useRef, useState, memo, useCallback } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { ArrowLeft, Loader2, AlertCircle, Play, Pause, Volume2, Volume1, VolumeX, Maximize, Settings, RotateCcw, RotateCw } from 'lucide-react';
 
// ---- TYPES ----
interface PlayInfo {
  movieId: string;
  title: string;
  playUrl: string;
  token: string;
  expiresInHours: number;
}
 
// ---- HLS VIDEO PLAYER (OPTIMIZED) ----
const VideoPlayer = memo(({ playUrl, token }: { playUrl: string; token: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const timeTextRef = useRef<HTMLDivElement>(null);
  
  const [levels, setLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState<number>(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  
  const hlsInstance = useRef<any>(null);
 
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h > 0 ? h + ':' : ''}${m < 10 ? '0' + m : m}:${s < 10 ? '0' + s : s}`;
  };
 
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playUrl) return;
 
    const initPlayer = async () => {
      const Hls = (await import('hls.js')).default;
      if (Hls.isSupported()) {
        const hls = new Hls({
          xhrSetup: (xhr: XMLHttpRequest, url: string) => {
            const separator = url.includes('?') ? '&' : '?';
            xhr.open('GET', `${url}${separator}token=${token}`, true);
          },
          capLevelToPlayerSize: true,
          debug: false,
          // TỐI ƯU: Đẩy việc xử lý sang Web Worker để giải phóng CPU luồng chính
          enableWebWorker: true,
          lowLatencyMode: true,
        });
 
        hlsInstance.current = hls;
        hls.loadSource(playUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => setLevels(hls.levels));
        hls.on(Hls.Events.FRAG_BUFFERED, () => setIsBuffering(false));
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Hỗ trợ Safari gốc
        video.src = `${playUrl}${playUrl.includes('?') ? '&' : '?'}token=${token}`;
      }
    };
 
    initPlayer();
    return () => {
      if (hlsInstance.current) {
        hlsInstance.current.destroy();
        hlsInstance.current = null;
      }
    };
  }, [playUrl, token]);
 
  // TỐI ƯU: Sử dụng Ref để cập nhật UI thanh tiến trình, tránh Re-render React liên tục
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
 
    const onTimeUpdate = () => {
      if (progressRef.current) {
        const pct = (video.currentTime / video.duration) * 100;
        progressRef.current.style.width = `${pct}%`;
      }
      if (timeTextRef.current) {
        timeTextRef.current.innerText = `${formatTime(video.currentTime)} / ${formatTime(video.duration)}`;
      }
    };
 
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
 
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
 
    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
    };
  }, []);
 
  const togglePlay = useCallback(() => {
    if (videoRef.current?.paused) videoRef.current.play();
    else videoRef.current?.pause();
  }, []);
 
  const handleSeekAmount = useCallback((amount: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + amount));
    }
  }, []);
 
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) containerRef.current.requestFullscreen();
    else document.exitFullscreen();
  }, []);
 
  return (
    <div ref={containerRef} className="relative group w-full max-w-6xl mx-auto rounded-lg overflow-hidden bg-black aspect-video flex items-center justify-center select-none shadow-[0_0_50px_rgba(0,0,0,0.5)]">
      <video ref={videoRef} onClick={togglePlay} className="w-full h-full cursor-pointer" playsInline />
 
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-10">
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        </div>
      )}
 
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-24 pb-6 px-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none group-focus-within:opacity-100">
        <div className="pointer-events-auto">
          {/* Progress Bar (Manual DOM update for performance) */}
          <div 
            className="relative w-full h-1.5 group/progress cursor-pointer mb-6 flex items-center bg-white/20 rounded-full overflow-hidden"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = (e.clientX - rect.left) / rect.width;
              if (videoRef.current) videoRef.current.currentTime = pos * videoRef.current.duration;
            }}
          >
            <div ref={progressRef} className="absolute inset-y-0 left-0 bg-white transition-[width] duration-150 ease-linear" style={{ width: '0%' }} />
          </div>
 
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button onClick={togglePlay} className="text-white hover:scale-110 transition-transform">
                {isPlaying ? <Pause fill="currentColor" className="w-6 h-6" /> : <Play fill="currentColor" className="w-6 h-6" />}
              </button>
 
              <div className="flex items-center gap-2 group/vol">
                <button onClick={() => { if(videoRef.current) { videoRef.current.muted = !isMuted; setIsMuted(!isMuted); } }} className="text-white">
                  {isMuted || volume === 0 ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </button>
              </div>
 
              <div ref={timeTextRef} className="text-[13px] font-mono text-white/80">00:00 / 00:00</div>
            </div>
 
            <div className="flex items-center gap-6">
              <button onClick={() => handleSeekAmount(-10)} className="text-white/60 hover:text-white transition"><RotateCcw className="w-5 h-5" /></button>
              <button onClick={() => handleSeekAmount(10)} className="text-white/60 hover:text-white transition"><RotateCw className="w-5 h-5" /></button>
              
              <div className="relative">
                <button onClick={() => setShowSettings(!showSettings)} className="flex items-center gap-2 text-white/80 hover:text-white text-xs font-bold uppercase tracking-widest">
                  <Settings className="w-5 h-5" />
                  {currentLevel === -1 ? 'Auto' : levels[currentLevel]?.height + 'p'}
                </button>
                {showSettings && (
                  <div className="absolute bottom-full right-0 mb-4 bg-[#1a1a1a] border border-white/5 rounded-md py-2 w-32 shadow-2xl">
                    <button onClick={() => { hlsInstance.current.currentLevel = -1; setCurrentLevel(-1); setShowSettings(false); }} className={`w-full text-left px-4 py-2 text-[11px] hover:bg-white/5 ${currentLevel === -1 ? 'text-white font-bold' : 'text-white/40'}`}>Auto</button>
                    {levels.map((l, i) => (
                      <button key={i} onClick={() => { hlsInstance.current.currentLevel = i; setCurrentLevel(i); setShowSettings(false); }} className={`w-full text-left px-4 py-2 text-[11px] hover:bg-white/5 ${currentLevel === i ? 'text-white font-bold' : 'text-white/40'}`}>{l.height}p</button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={toggleFullscreen} className="text-white hover:scale-110 transition-transform"><Maximize className="w-6 h-6" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
VideoPlayer.displayName = 'VideoPlayer';
 
// ---- MAIN WATCH PAGE ----
export default function WatchPage() {
  const router = useRouter();
  const { id } = router.query;
  const [playInfo, setPlayInfo] = useState<PlayInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
 
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`http://localhost:5113/api/admin/Movies/${id}/play`)
      .then(res => res.ok ? res.json() : Promise.reject('Không tìm thấy phim'))
      .then(setPlayInfo)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [id]);
 
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white selection:bg-white selection:text-black antialiased">
      <Head><title>{playInfo?.title || 'Đang tải...'} — TviEn</title></Head>
      
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-6 bg-gradient-to-b from-black/80 to-transparent">
        <button onClick={() => router.push('/')} className="flex items-center gap-3 text-white/40 hover:text-white transition uppercase text-[10px] font-bold tracking-[0.2em]">
          <ArrowLeft className="w-4 h-4" /> Quay lại
        </button>
        {playInfo && <h1 className="text-white/80 font-serif text-xl tracking-tight">{playInfo.title}</h1>}
        <div className="w-20" />
      </div>
 
      <div className="flex flex-col items-center justify-center min-h-screen px-4">
        {loading ? <Loader2 className="w-10 h-10 animate-spin text-white/20" /> :
         error ? <div className="text-center text-white/40 uppercase text-xs tracking-widest">{error}</div> :
         playInfo && <VideoPlayer playUrl={playInfo.playUrl} token={playInfo.token} />}
      </div>
    </div>
  );
}
