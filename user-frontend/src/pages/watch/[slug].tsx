import React, { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Hls from 'hls.js';
import { RotateCcw, RotateCw, Settings, Maximize, Play, Pause, Volume2, VolumeX, Bookmark, Star, Send } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { Navbar } from '@/components/Navbar';
import AuthModal from '@/components/auth/AuthModal';

interface Movie {
  id: string;
  title: string;
  slug: string;
  posterUrl?: string;
  description?: string;
  releaseYear?: number;
  weeklyViews?: number;
  weeklyViewsResetWeek?: number;
  movieType?: string;
  crews?: { fullName: string, roleId: number }[];
}

function normalizeMovie(d: any): Movie {
  const url = d.posterUrl ?? d.PosterUrl;
  return {
    id:                   d.id               ?? d.Id               ?? '',
    title:                d.title            ?? d.Title            ?? 'Untitled',
    slug:                 d.slug             ?? d.Slug             ?? '',
    description:          d.description      ?? d.Description      ?? '',
    posterUrl:            url || undefined,
    releaseYear:          d.releaseYear      ?? d.ReleaseYear      ?? 2024,
    weeklyViews:          d.weeklyViews      ?? d.WeeklyViews      ?? 0,
    weeklyViewsResetWeek: d.weeklyViewsResetWeek ?? d.WeeklyViewsResetWeek ?? 0,
    movieType:            d.movieType        ?? d.MovieType        ?? 'movie',
    crews:                d.crews            ?? d.Crews            ?? [],
  };
}

export default function WatchPage() {
  const router = useRouter();
  const { slug, episodeId: urlEpisodeId } = router.query;
  const { user, logout } = useAuth();
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const historyIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // TV Series specific states
  const [movieDetails, setMovieDetails] = useState<any>(null);
  const [currentEpisodeId, setCurrentEpisodeId] = useState<string | null>(null);
  const [activeSeasonId, setActiveSeasonId] = useState<string | null>(null);

  // States for search and auth in Navbar
  const [movies, setMovies] = useState<Movie[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const uniqueActors = React.useMemo(() => Array.from(new Set(movies.flatMap(m => m.crews?.filter(c => c.roleId === 2).map(c => c.fullName) || []))), [movies]);
  const uniqueDirectors = React.useMemo(() => Array.from(new Set(movies.flatMap(m => m.crews?.filter(c => c.roleId === 1).map(c => c.fullName) || []))), [movies]);

  // Fetch all movies for Navbar suggestions
  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/admin/Movies?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        let list = Array.isArray(data) ? data : (Object.values(data).find(v => Array.isArray(v)) as any[]) || [];
        setMovies(list.map(normalizeMovie));
      })
      .catch(console.error);
  }, []);

  const onSearchSubmit = (q: string) => {
    router.push(`/?q=${encodeURIComponent(q.trim())}`);
  };
  
  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState("0:00");
  const [totalTime, setTotalTime] = useState("0:00");
  const [levels, setLevels] = useState<any[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [showSettings, setShowSettings] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  
  // Watchlist state
  const [inWatchlist, setInWatchlist] = useState(false);
  const [watchlistId, setWatchlistId] = useState<number | null>(null);
  
  // Reviews state
  const [reviews, setReviews] = useState<any[]>([]);
  const [myRating, setMyRating] = useState(10);
  const [myComment, setMyComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const selectEpisode = async (episodeId: string) => {
    if (!slug) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/admin/Movies/slug/${slug}/play?episodeId=${episodeId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
        setCurrentEpisodeId(episodeId);
      }
    } catch (err) {
      console.error("Error playing episode:", err);
    }
  };

  useEffect(() => {
    if (!slug) return;
    setLoading(true);

    const episodeParam = urlEpisodeId ? `?episodeId=${urlEpisodeId}` : '';
    Promise.all([
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/admin/Movies/slug/${slug}/play${episodeParam}`).then(res => res.json()).catch(() => ({ error: "ERR_FETCH" })),
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/admin/Movies/slug/${slug}`).then(res => res.json()).catch(() => null)
    ]).then(([playData, details]) => {
      // 1. Handle Play Data
      setData(playData);
      if (playData?.episodeId) {
        setCurrentEpisodeId(playData.episodeId);
      }

      // 2. Handle Movie Details
      if (details && !details.error) {
        // Fallback: If seasons are empty or lack episodes, but flat episodes list exists, reconstruct seasons
        if (details.episodes && details.episodes.length > 0 && (!details.seasons || details.seasons.length === 0 || !details.seasons[0].episodes || details.seasons[0].episodes.length === 0)) {
          const seasonsMap = new Map<number, any[]>();
          details.episodes.forEach((ep: any) => {
            const sNum = ep.seasonNumber || 1;
            if (!seasonsMap.has(sNum)) {
              seasonsMap.set(sNum, []);
            }
            seasonsMap.get(sNum)!.push(ep);
          });
          
          details.seasons = Array.from(seasonsMap.entries()).map(([sNum, eps]) => ({
            seasonId: `temp-season-${sNum}`,
            seasonNumber: sNum,
            episodes: eps
          }));
        }

        setMovieDetails(details);
        
        // Ensure data has title/description if playData is error
        if (playData?.error && details.title) {
          setData((prev: any) => ({ ...prev, title: details.title, description: details.description, posterUrl: details.posterUrl }));
        }

        const movieId = details.id || playData?.movieId;
        if (movieId) {
          fetchReviews(movieId);
        }
      } else {
        const movieId = playData?.movieId;
        if (movieId) fetchReviews(movieId);
      }
      
      setLoading(false);
    });
  }, [slug]);

  // Set active season based on loaded movieDetails and currentEpisodeId
  useEffect(() => {
    if (movieDetails?.seasons && movieDetails.seasons.length > 0) {
      const currentEp = movieDetails.seasons
        .flatMap((s: any) => s.episodes || [])
        .find((e: any) => e.episodeId === currentEpisodeId);
      
      if (currentEp) {
        setActiveSeasonId(currentEp.seasonId);
      } else {
        const sortedSeasons = [...movieDetails.seasons].sort((a: any, b: any) => a.seasonNumber - b.seasonNumber);
        setActiveSeasonId(sortedSeasons[0].seasonId);
      }
    }
  }, [movieDetails, currentEpisodeId]);

  // Load Watchlist state when data & user are available
  useEffect(() => {
    if (user && user.userId && data && !data.error) {
      const movieId = data.movieId || data.id;
      if (!movieId) return;
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/public/watchlist?userId=${user.userId}`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch watchlist");
          return res.json();
        })
        .then(list => {
          const found = list.find((w: any) => w.movie && w.movie.id === movieId);
          if (found) {
            setInWatchlist(true);
            setWatchlistId(found.watchlistId);
          } else {
            setInWatchlist(false);
            setWatchlistId(null);
          }
        })
        .catch(console.error);
    }
  }, [user, data]);

  const fetchReviews = (movieId: number) => {
    if (!movieId) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/public/reviews?movieId=${movieId}`)
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch reviews");
        return res.json();
      })
      .then(resData => setReviews(resData))
      .catch(console.error);
  };

  // Setup HLS & History
  useEffect(() => {
    if (!data || data.error || !data.playUrl || !videoRef.current) return;
    const video = videoRef.current;
    const finalUrl = `${data.playUrl}?token=${data.token}`;
    const movieId = data.movieId || data.id;

    // Load History to resume
    if (user && user.userId) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/public/watchhistory?userId=${user.userId}`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch history");
          return res.json();
        })
        .then(history => {
          const found = history.find((h: any) => h.movie && h.movie.id === movieId);
          if (found && found.progressSeconds > 5 && router.query.restart !== 'true') {
            // Đảm bảo không lấy nhầm lịch sử của tập phim khác (trong cùng 1 series)
            const isSameEpisode = !currentEpisodeId || (found.episode && found.episode.episodeId === currentEpisodeId);
            if (isSameEpisode) {
              video.currentTime = found.progressSeconds;
            }
          }
        })
        .catch(console.error);
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(finalUrl);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setLevels(hls.levels); video.play(); });
      (window as any).hls = hls;
    } 
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = finalUrl;
      video.play();
    }
    
    // Save history periodically
    if (user) {
      historyIntervalRef.current = setInterval(() => {
        if (!video.paused) {
          fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/public/watchhistory`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.userId,
              movieId: movieId,
              episodeId: currentEpisodeId || null,
              progressSeconds: Math.floor(video.currentTime),
              isCompleted: (video.duration - video.currentTime) < 30
            })
          }).catch(console.error);
        }
      }, 10000); // 10s
    }

    return () => {
      if ((window as any).hls) (window as any).hls.destroy();
      if (historyIntervalRef.current) clearInterval(historyIntervalRef.current);
    };
  }, [data, user]);

  const toggleWatchlist = async () => {
    if (!user) { alert("Bạn cần đăng nhập để dùng tính năng này"); return; }
    const movieId = data.movieId || data.id;
    
    if (inWatchlist && watchlistId) {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/public/watchlist/${watchlistId}`, { method: 'DELETE' });
      setInWatchlist(false);
      setWatchlistId(null);
    } else {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/public/watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, movieId: movieId })
      });
      // reload watchlist status
      setInWatchlist(true);
      fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/public/watchlist?userId=${user.userId}`)
        .then(res => res.json())
        .then(list => {
          const found = list.find((w: any) => w.movie.id === movieId);
          if (found) setWatchlistId(found.watchlistId);
        });
    }
  };

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { alert("Bạn cần đăng nhập để đánh giá"); return; }
    setSubmittingReview(true);
    
    const movieId = data.movieId || data.id;
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/public/reviews`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user.userId,
        movieId: movieId,
        rating: myRating,
        content: myComment
      })
    });
    
    setSubmittingReview(false);
    if (res.ok) {
      setMyComment("");
      fetchReviews(movieId); // reload reviews
    } else {
      const err = await res.text();
      alert(err || "Lỗi khi gửi đánh giá");
    }
  };

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
      const dur = videoRef.current.duration;
      if (isNaN(dur) || !isFinite(dur)) return;
      const newTime = (parseFloat(e.target.value) / 100) * dur;
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
    if (videoRef.current.paused) { videoRef.current.play().catch(() => {}); setIsPlaying(true); }
    else { videoRef.current.pause(); setIsPlaying(false); }
  };

  const seek = (amount: number) => {
    if (videoRef.current) {
      const dur = videoRef.current.duration;
      if (isNaN(dur) || !isFinite(dur)) return;
      const wasPlaying = !videoRef.current.paused;
      videoRef.current.currentTime = Math.max(0, Math.min(dur, videoRef.current.currentTime + amount));
      if (wasPlaying) videoRef.current.play().catch(() => {});
    }
  };

  const toggleFullScreen = () => {
    const doc = document as any;
    const isFullScreen = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

    if (isFullScreen) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
      else if (doc.mozCancelFullScreen) doc.mozCancelFullScreen();
      else if (doc.msExitFullscreen) doc.msExitFullscreen();
    } else {
      const container = containerRef.current as any;
      if (container) {
        if (container.requestFullscreen) container.requestFullscreen();
        else if (container.webkitRequestFullscreen) container.webkitRequestFullscreen();
        else if (container.mozRequestFullScreen) container.mozRequestFullScreen();
        else if (container.msRequestFullscreen) container.msRequestFullscreen();
      }
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-black text-white">Đang tải...</div>;

  const isSeries = movieDetails?.type === 2 || movieDetails?.Type === 2 || movieDetails?.movieType === 'series' || data?.movieType === 'series';
  const activeEpisode = isSeries 
    ? (movieDetails?.episodes?.find((e: any) => e.episodeId === currentEpisodeId)
       || movieDetails?.seasons?.flatMap((s: any) => s.episodes || []).find((e: any) => e.episodeId === currentEpisodeId))
    : null;

  const displayTitle = activeEpisode 
    ? `${movieDetails?.title || data?.title || ''} - Tập ${activeEpisode.episodeNumber}${activeEpisode.title ? `: ${activeEpisode.title}` : ''}`
    : (movieDetails?.title || data?.title || '');

  return (
    <div className="watch-page font-sans bg-[#0a0a0a] min-h-screen">
      <Head>
        <title>{data?.title} — TviEn</title>
        <style>{`
          /* Custom styles for the player to coexist with normal scrollable layout */
          .player-wrapper { width: 100%; position: relative; background: transparent; padding-top: 130px; margin-bottom: 20px; }
          
          .video-container { position: relative; width: 100%; aspect-ratio: 16/9; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.05); background: #000; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7); }
          .video-container:fullscreen { border-radius: 0; border: none; aspect-ratio: auto; width: 100vw; height: 100vh; }
          .video-container:-webkit-full-screen { border-radius: 0; border: none; aspect-ratio: auto; width: 100vw; height: 100vh; }
          .video-container:-moz-full-screen { border-radius: 0; border: none; aspect-ratio: auto; width: 100vw; height: 100vh; }
          .video-container:-ms-fullscreen { border-radius: 0; border: none; aspect-ratio: auto; width: 100vw; height: 100vh; }
          
          video { width: 100%; height: 100%; object-fit: contain; }

          /* 3 Vùng Tương Tác */
          .click-zones { position: absolute; inset: 0; display: flex; z-index: 5; }
          .zone-side { width: 30%; height: 100%; cursor: pointer; }
          .zone-center { width: 40%; height: 100%; cursor: pointer; }

          .hud { position: absolute; inset: 0; display: flex; flex-direction: column; justify-content: flex-end; z-index: 10; transition: opacity 0.4s ease; opacity: ${isHovered ? 1 : 0}; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 30%); pointer-events: none; }
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

      <Navbar 
        activeTab=""
        onTabChange={(tab: string) => router.push(`/?tab=${tab}`)}
        user={user}
        onLoginClick={() => setAuthModalOpen(true)}
        onLogoutClick={logout}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onSearchSubmit={onSearchSubmit}
        movies={movies}
        uniqueActors={uniqueActors}
        uniqueDirectors={uniqueDirectors}
      />

      <div className="player-wrapper max-w-[1200px] mx-auto px-8">
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-white font-sans">
            {displayTitle}
          </h1>
        </div>
        <div 
          ref={containerRef} 
          className="video-container" 
          onMouseEnter={() => setIsHovered(true)} 
          onMouseLeave={() => { setIsHovered(false); setShowSettings(false); }}
        >
          {(!data || data.error || !data.playUrl) ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505] text-white p-6 text-center space-y-4">
              <div className="text-3xl font-black uppercase tracking-widest font-sans text-neutral-500">Sắp ra mắt</div>
              <p className="text-[10px] text-neutral-600 uppercase tracking-[0.2em] font-bold">Nội dung này chưa được tải lên hoặc đang được xử lý.</p>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* SEASONS & EPISODES SELECTOR */}
      {(() => {
        const isSeries = movieDetails?.type === 2 || movieDetails?.Type === 2 || movieDetails?.movieType === 'series' || data?.movieType === 'series';
        if (!isSeries || !movieDetails?.seasons || movieDetails.seasons.length === 0) return null;
        
        return (
          <div className="max-w-[1200px] mx-auto px-8 mb-12 text-white">
            <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
              <h2 className="text-xl font-bold uppercase tracking-widest font-sans">Chọn Tập Phim</h2>
              {/* Season Selector tabs if more than 1 season */}
              {movieDetails.seasons.length > 1 && (
                <div className="flex gap-2">
                  {movieDetails.seasons
                    .sort((a: any, b: any) => a.seasonNumber - b.seasonNumber)
                    .map((season: any) => (
                      <button
                        key={season.seasonId}
                        onClick={() => setActiveSeasonId(season.seasonId)}
                        className={`px-4 py-2 text-xs font-black uppercase tracking-wider transition rounded-sm border ${
                          activeSeasonId === season.seasonId
                            ? 'bg-white text-black border-white'
                            : 'bg-transparent text-white border-white/10 hover:border-white/40'
                        }`}
                      >
                        Mùa {season.seasonNumber}
                      </button>
                    ))}
                </div>
              )}
            </div>

            {/* Episode Grid for active season */}
            {(() => {
              const activeSeason = movieDetails.seasons.find((s: any) => s.seasonId === activeSeasonId) || movieDetails.seasons[0];
              if (!activeSeason || !activeSeason.episodes || activeSeason.episodes.length === 0) {
                return <div className="text-white/40 text-sm">Không có tập phim nào trong mùa này.</div>;
              }

              return (
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
                  {activeSeason.episodes
                    .sort((a: any, b: any) => a.episodeNumber - b.episodeNumber)
                    .map((episode: any) => {
                      const isSelected = currentEpisodeId === episode.episodeId;
                      return (
                        <button
                          key={episode.episodeId}
                          onClick={() => selectEpisode(episode.episodeId)}
                          className={`flex items-center justify-center py-2.5 px-2 border rounded-sm transition text-center text-xs font-black uppercase tracking-wider ${
                            isSelected
                              ? 'bg-white text-black border-white shadow-[0_0_15px_rgba(255,255,255,0.15)] font-black'
                              : 'bg-[#141414] text-white border-[#2A2A2A] hover:border-white/40 hover:bg-[#1C1C1C]'
                          }`}
                        >
                          Tập {episode.episodeNumber}
                        </button>
                      );
                    })}
                </div>
              );
            })()}
          </div>
        );
      })()}

      {/* Details & Reviews Section */}
      <div className="max-w-[1200px] mx-auto w-full px-8 py-12 text-white">
        <div className="flex justify-between items-start mb-12">
          <div>
            <p className="text-white/60 max-w-2xl text-sm leading-relaxed">{data?.description}</p>
          </div>
          
          <button 
            onClick={toggleWatchlist}
            className={`flex items-center gap-3 px-6 py-3 rounded-sm font-semibold text-xs tracking-widest uppercase transition border ${inWatchlist ? 'bg-white text-black border-white hover:bg-white/90' : 'bg-transparent text-white border-white/20 hover:border-white/60'}`}
          >
            <Bookmark size={18} fill={inWatchlist ? "currentColor" : "none"} />
            {inWatchlist ? "In Watchlist" : "Add to List"}
          </button>
        </div>

        <div className="h-px w-full bg-white/10 mb-12"></div>

        {/* Reviews Area */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_350px] gap-12">
          
          {/* Reviews List */}
          <div>
            <h2 className="text-2xl font-serif font-bold mb-8">Reviews ({reviews.length})</h2>
            
            <div className="space-y-6">
              {reviews.map((r, i) => (
                <div key={i} className="bg-white/5 p-6 rounded-sm border border-white/5">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                        {r.user.avatarUrl ? <img src={r.user.avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <span className="text-white/60 font-bold">{r.user.displayName.charAt(0)}</span>}
                      </div>
                      <div>
                        <div className="font-bold text-sm">{r.user.displayName}</div>
                        <div className="text-[10px] text-white/40 tracking-wider uppercase mt-1">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-sm">
                      <Star size={14} fill="#eab308" className="text-yellow-500" />
                      <span className="text-xs font-bold">{r.rating}/10</span>
                    </div>
                  </div>
                  <p className="text-white/80 text-sm leading-relaxed">{r.content}</p>
                </div>
              ))}
              
              {reviews.length === 0 && (
                <div className="text-center py-12 border border-dashed border-white/10 rounded-sm">
                  <p className="text-white/40">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
                </div>
              )}
            </div>
          </div>

          {/* Add Review Form */}
          <div className="sticky top-12">
            <h3 className="text-lg font-bold mb-6 font-serif">Viết đánh giá</h3>
            {user ? (
              <form onSubmit={submitReview} className="bg-white/5 p-6 rounded-sm border border-white/5">
                <div className="mb-6">
                  <label className="block text-xs text-white/60 uppercase tracking-widest mb-3">Chấm điểm</label>
                  <div className="flex items-center gap-2">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => (
                      <button 
                        type="button"
                        key={n}
                        onClick={() => setMyRating(n)}
                        className={`w-6 h-6 flex items-center justify-center rounded-sm text-xs font-bold transition ${myRating >= n ? 'bg-yellow-500 text-black' : 'bg-white/10 text-white/40 hover:bg-white/20'}`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="mb-6">
                  <label className="block text-xs text-white/60 uppercase tracking-widest mb-3">Bình luận</label>
                  <textarea 
                    required
                    value={myComment}
                    onChange={e => setMyComment(e.target.value)}
                    className="w-full bg-black/50 border border-white/10 rounded-sm p-4 text-sm text-white focus:border-white/40 transition outline-none resize-none h-32"
                    placeholder="Chia sẻ cảm nghĩ của bạn về bộ phim này..."
                  ></textarea>
                </div>

                <button 
                  type="submit" 
                  disabled={submittingReview}
                  className="w-full bg-white text-black font-bold text-xs uppercase tracking-widest py-3 rounded-sm hover:bg-white/80 transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send size={16} /> Gửi đánh giá
                </button>
              </form>
            ) : (
              <div className="bg-white/5 p-6 rounded-sm border border-white/5 text-center">
                <p className="text-white/60 text-sm mb-4">Vui lòng đăng nhập để có thể tham gia bình luận và chấm điểm.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </div>
  );
}
