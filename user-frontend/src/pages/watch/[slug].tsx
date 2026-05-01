import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Hls from 'hls.js';
import { ChevronLeft, RotateCcw, RotateCw, Settings, Maximize, Play, Pause, Volume2, VolumeX } from 'lucide-react';

export default function WatchPage() {
  const router = useRouter();
  const { slug } = router.query;
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [totalTime, setTotalTime] = useState("0:00");
  const [levels, setLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`http://localhost:5113/api/admin/Movies/slug/${slug}/play`)
      .then(res => res.json())
      .then(json => { setData(json); setLoading(false); });
  }, [slug]);

  useEffect(() => {
    if (!data?.playUrl || !videoRef.current) return;
    const video = videoRef.current;
    const finalUrl = `${data.playUrl}?token=${data.token}`;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(finalUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setLevels(hls.levels); video.play(); });
      (window as any).hls = hls;
      return () => hls.destroy();
    } 
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = finalUrl;
      video.play();
    }
  }, [data]);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const cur = videoRef.current.currentTime;
      const dur = videoRef.current.duration;
      if (isNaN(dur) || dur === 0) return;
      setProgress((cur / dur) * 100);
      setCurrentTime(formatTime(cur));
      setTotalTime(formatTime(dur));
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current) {
      const newTime = (parseFloat(e.target.value) / 100) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      setProgress(parseFloat(e.target.value));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (videoRef.current) { videoRef.current.volume = val; setVolume(val); }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) { videoRef.current.play(); setIsPlaying(true); }
    else { videoRef.current.pause(); setIsPlaying(false); }
  };

  const seek = (amount: number) => {
    if (videoRef.current) {
      const wasPlaying = !videoRef.current.paused;
      videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.duration, videoRef.current.currentTime + amount));
      if (wasPlaying) videoRef.current.play().catch(() => {});
    }
  };

  const toggleFullScreen = () => {
    if (containerRef.current?.requestFullscreen) containerRef.current.requestFullscreen();
    else if ((containerRef.current as any).webkitRequestFullscreen) (containerRef.current as any).webkitRequestFullscreen();
  };

  if (loading) return <div className="loading">Đang tải...</div>;

  return (
    <div className="watch-page">
      <Head>
        <title>{data?.title}</title>
        <style>{`
          body { background: #000; margin: 0; overflow: hidden; font-family: 'Inter', sans-serif; }
          .watch-page { height: 100vh; width: 100vw; display: flex; align-items: center; justify-content: center; position: relative; }
          .page-header { position: absolute; top: 30px; left: 30px; display: flex; align-items: center; gap: 20px; z-index: 100; opacity: 1; }
          .back-btn { background: rgba(255,255,255,0.1); border: none; color: #fff; padding: 10px; border-radius: 50%; cursor: pointer; backdrop-filter: blur(10px); transition: 0.2s; }
          .back-btn:hover { background: rgba(255,255,255,0.2); transform: scale(1.1); }
          .movie-name { font-size: 24px; font-weight: 800; color: #fff; text-shadow: 0 4px 15px rgba(0,0,0,1); }

          .video-container { position: relative; width: 90vw; max-width: 1200px; aspect-ratio: 16/9; background: #000; border-radius: 12px; overflow: hidden; }
          video { width: 100%; height: 100%; object-fit: contain; }

          /* 3 Vùng Tương Tác */
          .click-zones { position: absolute; inset: 0; display: flex; z-index: 5; }
          .zone-side { width: 30%; height: 100%; cursor: pointer; }
          .zone-center { width: 40%; height: 100%; cursor: pointer; }

          .hud { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; z-index: 10; transition: opacity 0.4s ease; opacity: ${isHovered ? 1 : 0}; background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 40%); pointer-events: none; }
          .bottom { padding: 20px 30px 40px; pointer-events: auto; }

          .seek-box { width: 100%; height: 4px; background: rgba(255,255,255,0.2); border-radius: 2px; position: relative; cursor: pointer; margin-bottom: 25px; transition: height 0.1s; }
          .seek-box:hover { height: 6px; }
          .seek-fill { height: 100%; background: #ffffff; border-radius: 2px; position: relative; }
          .seek-input { position: absolute; inset: 0; width: 100%; opacity: 0; cursor: pointer; }

          .controls { display: flex; align-items: center; justify-content: space-between; }
          .group { display: flex; align-items: center; gap: 22px; }
          .btn { background: none; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; opacity: 0.85; position: relative; }
          .btn:hover { opacity: 1; transform: scale(1.1); }
          .time-text { font-size: 13px; font-weight: 500; color: #fff; margin-left: 5px; opacity: 0.9; }
          .seek-label { position: absolute; font-size: 8px; font-weight: 800; color: #fff; top: 55%; left: 50%; transform: translate(-50%, -50%); }

          .vol-container { display: flex; align-items: center; gap: 10px; }
          .vol-slider { width: 0px; opacity: 0; transition: all 0.3s ease; cursor: pointer; -webkit-appearance: none; height: 3px; border-radius: 2px; outline: none; background: linear-gradient(to right, #fff ${volume * 100}%, rgba(255,255,255,0.2) ${volume * 100}%); }
          .vol-container:hover .vol-slider { width: 80px; opacity: 1; }
          .vol-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 10px; height: 10px; background: #fff; border-radius: 50%; cursor: pointer; }

          .quality-pop { position: absolute; bottom: 100px; right: 30px; background: rgba(18, 18, 18, 0.96); border: 1px solid rgba(255,255,255,0.1); border-radius: 14px; padding: 6px; min-width: 100px; backdrop-filter: blur(25px); box-shadow: 0 20px 50px rgba(0,0,0,0.6); }
          .q-opt { padding: 10px; font-size: 13px; border-radius: 8px; cursor: pointer; text-align: center; transition: 0.2s; color: rgba(255,255,255,0.7); }
          .q-opt:hover { background: rgba(255,255,255,0.1); color: #fff; }
          .q-opt.active { color: #fff; font-weight: 800; background: rgba(255,255,255,0.15); }
        `}</style>
      </Head>

      <div className="page-header">
        <button onClick={() => router.push('/')} className="back-btn"><ChevronLeft size={24}/></button>
        <span className="movie-name">{data?.title}</span>
      </div>

      <div 
        ref={containerRef} 
        className="video-container" 
        onMouseEnter={() => setIsHovered(true)} 
        onMouseLeave={() => { setIsHovered(false); setShowSettings(false); }}
      >
        <video ref={videoRef} onTimeUpdate={handleTimeUpdate} onPlay={() => setIsPlaying(true)} onPause={() => setIsPlaying(false)} />

        {/* LỚP PHỦ 3 VÙNG TƯƠNG TÁC TÁCH BIỆT */}
        <div className="click-zones">
          <div className="zone-side" onDoubleClick={() => seek(-10)}></div>
          <div className="zone-center" onClick={togglePlay}></div>
          <div className="zone-side" onDoubleClick={() => seek(10)}></div>
        </div>

        <div className="hud">
          <div className="bottom">
            <div className="seek-box">
              <div className="seek-fill" style={{width: `${progress}%`}}></div>
              <input type="range" className="seek-input" min="0" max="100" step="0.1" value={progress} onChange={handleSeek} />
            </div>

            <div className="controls">
              <div className="group">
                <button className="btn" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
                  {isPlaying ? <Pause size={24} fill="currentColor"/> : <Play size={24} fill="currentColor"/>}
                </button>
                <div className="vol-container">
                  <button className="btn" style={{width:'auto'}} onClick={(e) => { e.stopPropagation(); if(videoRef.current) { videoRef.current.volume = videoRef.current.volume > 0 ? 0 : 1; setVolume(videoRef.current.volume); } }}>
                    {volume === 0 ? <VolumeX size={24} color="white"/> : <Volume2 size={24} color="white"/>}
                  </button>
                  <input type="range" className="vol-slider" min="0" max="1" step="0.01" value={volume} onChange={handleVolumeChange} onClick={(e) => e.stopPropagation()} />
                </div>
                <div className="time-text">{currentTime} / {totalTime}</div>
              </div>

              <div className="group">
                <div style={{display:'flex', gap: '12px'}}>
                    <button className="btn" onClick={(e) => { e.stopPropagation(); seek(-10); }}>
                      <RotateCcw size={24}/><span className="seek-label">10</span>
                    </button>
                    <button className="btn" onClick={(e) => { e.stopPropagation(); seek(10); }}>
                      <RotateCw size={24}/><span className="seek-label">10</span>
                    </button>
                </div>
                <div style={{position:'relative'}}>
                  <button className="btn" onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}>
                    <Settings size={24}/>
                    <span style={{fontSize: 11, marginLeft: 8, fontWeight: 800}}>{currentLevel === -1 ? 'AUTO' : levels[currentLevel]?.height}</span>
                  </button>
                  {showSettings && (
                    <div className="quality-pop" onClick={(e) => e.stopPropagation()}>
                      <div className={`q-opt ${currentLevel === -1 ? 'active' : ''}`} onClick={() => { (window as any).hls.currentLevel = -1; setCurrentLevel(-1); setShowSettings(false); }}>AUTO</div>
                      {levels.map((l, i) => (
                        <div key={i} className={`q-opt ${currentLevel === i ? 'active' : ''}`} onClick={() => { (window as any).hls.currentLevel = i; setCurrentLevel(i); setShowSettings(false); }}>{l.height}</div>
                      ))}
                    </div>
                  )}
                </div>
                <button className="btn" onClick={(e) => { e.stopPropagation(); toggleFullScreen(); }}><Maximize size={24}/></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
