import React, { useEffect, useState, useRef, memo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Search, User as UserIcon, Play, X, PlayCircle, LogOut, Filter } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import AuthModal from '@/components/auth/AuthModal';
import { Navbar } from '@/components/Navbar';
 
// ─── Types ───────────────────────────────────────────────────────────────────
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
  ageRating?: string;
  genres?: string[];
}
 
// ─── Constants ────────────────────────────────────────────────────────────────
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:5113/api/public/gatekeeper';
const BASE_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api';
const API_URL      = `${BASE_API_URL.replace(/\/$/, '')}/admin/Movies`;

 
function getISOWeek(date: Date): number {
  const startDate = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startDate.getTime()) / 86_400_000);
  return Math.ceil((date.getDay() + 1 + days) / 7);
}
const CURRENT_WEEK = getISOWeek(new Date());
 
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
    ageRating:            d.ageRating        ?? d.AgeRating        ?? '',
    genres:               d.genres           ?? d.Genres           ?? [],
  };
}
 

 
// ─── HoverPlayer (Super Optimized - Lazy Video) ───────────────────────────────
const HoverPlayer = memo(({ id, slug, title, posterUrl, description }: Movie) => {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const previewUrl = `${WORKER_URL}/video/${id}/preview.mp4`;
 
  return (
    <div
      onClick={() => router.push(`/watch/${slug || id}`)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="flex-none w-[240px] aspect-[2/3] relative group overflow-hidden bg-[#201f1f] cursor-pointer rounded-sm"
    >
      {/* Chỉ mount Video khi thực sự Hover - Cực kỳ tiết kiệm CPU & Băng thông */}
      {isHovered && (
        <video 
          src={previewUrl} 
          autoPlay 
          muted 
          loop 
          playsInline 
          className="absolute inset-0 w-full h-full object-cover z-20 animate-fade-in" 
        />
      )}
      
      <img 
        src={posterUrl} 
        alt={title} 
        loading="lazy"
        className={`absolute inset-0 w-full h-full object-cover z-10 transition-all duration-700 ${isHovered ? 'opacity-0 scale-105' : 'opacity-100'}`} 
      />
      
      {/* Khung nội dung bao trùm toàn bộ thẻ (từ trên xuống), hiển thị khi hover */}
      <div className="absolute inset-0 p-5 z-30 flex flex-col justify-start gap-2.5 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 bg-black/60 backdrop-blur-[1px] rounded-sm">
        <span className="text-white text-xs font-bold uppercase tracking-widest block border-b border-white/10 pb-1.5 truncate" title={title}>{title}</span>
        {description && (
          <p className="text-[10px] text-white/80 font-light line-clamp-[17] leading-relaxed overflow-hidden">
            {description}
          </p>
        )}
      </div>
    </div>
  );
});
HoverPlayer.displayName = 'HoverPlayer';
 
// ─── ContinueCard (Optimized) ─────────────────────────────────────────────────
const ContinueCard = memo(({ title, imgUrl, progress, movieId, slug }: { title: string; imgUrl: string; progress: number; movieId?: string; slug?: string }) => {
  const router = useRouter();
  return (
    <div 
      onClick={() => (slug || movieId) && router.push(`/watch/${slug || movieId}`)}
      className="flex-none w-[420px] aspect-video relative group overflow-hidden bg-[#201f1f] cursor-pointer rounded-sm"
    >
      <img src={imgUrl} alt={title} loading="lazy" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-100" />
      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
        <PlayCircle className="w-16 h-16 text-white" strokeWidth={1} />
      </div>
      <div className="absolute bottom-0 left-0 w-full h-[3px] bg-white/10">
        <div className="h-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)] transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
});
ContinueCard.displayName = 'ContinueCard';
 
// ─── Main Component ──────────────────────────────────────────────────────────
export default function CinemaApp() {
  const router = useRouter();
  const { tab: urlTab } = router.query;
  
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const urlSearchQuery = router.query.q as string;
  const [activeTab, setActiveTab] = useState('cinema');
  
  const uniqueActors = React.useMemo(() => Array.from(new Set(movies.flatMap(m => m.crews?.filter(c => c.roleId === 2).map(c => c.fullName) || []))), [movies]);
  const uniqueDirectors = React.useMemo(() => Array.from(new Set(movies.flatMap(m => m.crews?.filter(c => c.roleId === 1).map(c => c.fullName) || []))), [movies]);
  
  const { user, logout } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const [history, setHistory] = useState<any[]>([]);
  const [watchlist, setWatchlist] = useState<any[]>([]);

  useEffect(() => {
    if (user && user.userId) {
      fetch(`${BASE_API_URL.replace(/\/$/, '')}/public/watchhistory?userId=${user.userId}`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch history");
          return res.json();
        })
        .then(data => setHistory(Array.isArray(data) ? data : []))
        .catch(err => {
          console.error(err);
          setHistory([]);
        });
        
      fetch(`${BASE_API_URL.replace(/\/$/, '')}/public/watchlist?userId=${user.userId}`)
        .then(res => {
          if (!res.ok) throw new Error("Failed to fetch watchlist");
          return res.json();
        })
        .then(data => setWatchlist(Array.isArray(data) ? data : []))
        .catch(err => {
          console.error(err);
          setWatchlist([]);
        });
    } else {
      setHistory([]);
      setWatchlist([]);
    }
  }, [user]);
 


  // 1. Sync Tab from URL
  useEffect(() => {
    if (urlTab) setActiveTab(urlTab as string);
  }, [urlTab]);

  // 2. Tab Change Handler
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    router.push({ query: { tab } }, undefined, { shallow: true });
  };

  // 3. Scroll Restoration Logic
  useEffect(() => {
    const handleScroll = () => {
      sessionStorage.setItem('cinema_scroll_pos', window.scrollY.toString());
    };
    window.addEventListener('scroll', handleScroll);
    
    const savedPos = sessionStorage.getItem('cinema_scroll_pos');
    if (savedPos) {
      setTimeout(() => window.scrollTo(0, parseInt(savedPos)), 100);
    }

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetch(`${API_URL}?t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        let list = Array.isArray(data) ? data : (Object.values(data).find(v => Array.isArray(v)) as any[]) || [];
        setMovies(list.map(normalizeMovie));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredMovies = movies.filter(m => {
    if (activeTab === 'series') return m.movieType === 'series';
    if (activeTab === 'cinema') return m.movieType === 'movie';
    return true;
  });

  const featured = filteredMovies.length > 0 ? filteredMovies[0] : (movies[0] || null);
  const trending = filteredMovies.filter(m => m.weeklyViewsResetWeek === CURRENT_WEEK).sort((a,b) => (b.weeklyViews||0)-(a.weeklyViews||0)).slice(0, 10);
 
  return (
    <>
      <Head>
        <title>TviEn — The Void is Calling</title>
        <style>{`
          /* Ẩn thanh cuộn toàn cục */
          html, body, #__next {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          html::-webkit-scrollbar, body::-webkit-scrollbar, #__next::-webkit-scrollbar {
            display: none;
          }

          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { 
            -ms-overflow-style: none; 
            scrollbar-width: none; 
          }
          @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
          .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        `}</style>
      </Head>
 
      <div className="bg-[#131313] min-h-screen font-sans selection:bg-white selection:text-black antialiased">
        <Navbar 
          activeTab={activeTab} 
          onTabChange={handleTabChange} 
          user={user}
          onLoginClick={() => setAuthModalOpen(true)}
          onLogoutClick={logout}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearchSubmit={(q: string) => router.push(`/?q=${encodeURIComponent(q.trim())}`, undefined, { shallow: true })}
          movies={movies}
          uniqueActors={uniqueActors}
          uniqueDirectors={uniqueDirectors}
        />
        
        {activeTab === 'library' ? (
          <main className="w-full max-w-[1600px] mx-auto px-8 md:px-16 pt-32 pb-24 min-h-[70vh]">
            {!user ? (
              <div className="text-center mt-32">
                <h2 className="text-4xl font-serif text-white mb-6">Your Library</h2>
                <p className="text-white/40 mb-10 text-lg">Sign in to sync your watch history and saved movies.</p>
                <button onClick={() => setAuthModalOpen(true)} className="bg-white text-black px-10 py-4 rounded-sm font-bold text-xs uppercase tracking-widest hover:bg-white/90">Sign In</button>
              </div>
            ) : (
              <>
                <section className="mb-24">
                  <h2 className="text-[42px] font-serif font-bold text-white mb-12 tracking-tight">My Watchlist</h2>
                  {watchlist.length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-white/5 rounded-sm bg-white/[0.01]">
                      <p className="text-white/30 text-lg font-light tracking-wide">Danh sách trống. Hãy thêm phim vào danh sách xem sau.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-8">
                      {watchlist.map(w => (
                        <div key={w.watchlistId} className="transform hover:scale-105 transition-transform duration-300">
                          <HoverPlayer id={w.movie.id} slug={w.movie.slug} title={w.movie.title} posterUrl={w.movie.posterUrl} description={w.movie.description} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
                
                <section className="mb-24">
                  <h2 className="text-[42px] font-serif font-bold text-white mb-12 tracking-tight">Watch History</h2>
                  {history.length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-white/5 rounded-sm bg-white/[0.01]">
                      <p className="text-white/30 text-lg font-light tracking-wide">Bạn chưa xem bộ phim nào.</p>
                    </div>
                  ) : (
                    <div className="flex gap-10 overflow-x-auto pb-10 hide-scrollbar">
                      {history.map(h => (
                        <ContinueCard 
                          key={h.historyId} 
                          title={h.movie.title} 
                          progress={h.isCompleted ? 100 : Math.min(100, (h.progressSeconds / 7200) * 100)}
                          imgUrl={h.movie.posterUrl} 
                          movieId={h.movie.id} 
                          slug={h.movie.slug}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}
          </main>
        ) : urlSearchQuery ? (() => {
          const isMatch = (m: Movie, q: string) => {
            if (!q.trim()) return true;
            const segments = q.split(',').map(s => s.trim()).filter(Boolean);
            const actors: string[] = []; 
            const directors: string[] = []; 
            const years: string[] = []; 
            const genres: string[] = []; 
            const ages: string[] = []; 
            const types: string[] = []; 
            const titles: string[] = [];

            segments.forEach(seg => {
                const lower = seg.toLowerCase();
                if (lower.startsWith('diễn viên:')) actors.push(seg.substring('diễn viên:'.length).trim().toLowerCase());
                else if (lower.startsWith('đạo diễn:')) directors.push(seg.substring('đạo diễn:'.length).trim().toLowerCase());
                else if (lower.startsWith('năm:')) years.push(seg.substring('năm:'.length).trim().toLowerCase());
                else if (lower.startsWith('thể loại:')) genres.push(seg.substring('thể loại:'.length).trim().toLowerCase());
                else if (lower.startsWith('độ tuổi:')) ages.push(seg.substring('độ tuổi:'.length).trim().toLowerCase());
                else if (['g', 'pg', 'pg-13', 'r', 'nc-17'].includes(lower)) ages.push(lower);
                else if (['blockbuster', 'indie'].includes(lower)) types.push(lower);
                else titles.push(lower);
            });

            if (actors.length > 0 && !actors.every(a => m.crews?.some(c => c.roleId === 2 && c.fullName.toLowerCase().includes(a)))) return false;
            if (directors.length > 0 && !directors.every(d => m.crews?.some(c => c.roleId === 1 && c.fullName.toLowerCase().includes(d)))) return false;
            if (years.length > 0 && !years.every(y => m.releaseYear?.toString().includes(y))) return false;
            if (genres.length > 0 && !genres.every(g => 
              m.genres?.some(mg => mg.toLowerCase() === g) || 
              m.title.toLowerCase().includes(g) || 
              m.description?.toLowerCase().includes(g)
            )) return false;
            if (ages.length > 0 && !ages.every(a => m.ageRating?.toLowerCase().includes(a))) return false;
            if (types.length > 0 && !types.every(t => {
              if (t === 'blockbuster') return (m.weeklyViews || 0) > 5 || (m.weeklyViewsResetWeek || 0) > 0;
              if (t === 'indie') return (m.weeklyViews || 0) <= 5;
              return true;
            })) return false;
            if (titles.length > 0 && !titles.every(t => 
              m.title.toLowerCase().includes(t) || 
              m.description?.toLowerCase().includes(t) ||
              m.crews?.some(c => c.fullName.toLowerCase().includes(t)) ||
              m.releaseYear?.toString().includes(t)
            )) return false;
            return true;
          };
          const results = movies.filter(m => isMatch(m, urlSearchQuery));

          return (
            <main className="w-full max-w-[1600px] mx-auto px-8 md:px-16 pt-32 min-h-[70vh]">
              <div className="mb-12">
                <button onClick={() => { setSearchQuery(''); router.push('/', undefined, { shallow: true }); }} className="text-white/40 hover:text-white flex items-center gap-2 mb-8 transition-colors text-sm uppercase tracking-widest">
                  <X className="w-4 h-4"/> Xóa tìm kiếm
                </button>
                <h1 className="text-[42px] font-serif font-bold text-white tracking-tight">
                  Kết quả tìm kiếm cho "{urlSearchQuery}"
                </h1>
                <p className="text-white/40 mt-2">
                  Tìm thấy {results.length} phim
                </p>
              </div>
              
              {results.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-white/5 rounded-sm bg-white/[0.01]">
                  <p className="text-white/30 text-lg font-light tracking-wide">Không tìm thấy phim nào phù hợp.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
                  {results.map(m => (
                    <HoverPlayer key={m.id} {...m} />
                  ))}
                </div>
              )}
            </main>
          );
        })() : (
          <>
            {/* Hero */}
            <header className="relative w-full h-[90vh] min-h-[700px] flex items-end overflow-hidden">
              <img src={featured?.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2000'} alt="" className="absolute inset-0 w-full h-full object-cover scale-105 z-0" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-[#131313]/60 to-transparent z-10" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#131313]/80 via-transparent to-transparent z-10" />
              <div className="relative z-20 w-full max-w-[1600px] mx-auto px-8 md:px-16 pb-24">
                <h1 className="text-6xl md:text-8xl font-serif font-bold text-white mb-6 max-w-4xl tracking-tight leading-[0.9]">
                  {featured?.title || 'The Echoes of Silence'}
                </h1>
                <p className="text-white/60 text-lg max-w-2xl mb-10 font-light leading-relaxed">
                  {featured?.description || 'In a world where sound is forbidden, one rebel discovers a frequency that could shatter the fragile peace of the utopia.'}
                </p>
                <button onClick={() => featured && router.push(`/watch/${featured.slug || featured.id}`)} className="bg-white text-black px-10 py-4 rounded-sm font-semibold text-[11px] uppercase tracking-[0.2em] hover:bg-white/80 transition-all flex items-center gap-3">
                  <Play className="w-5 h-5 fill-current" /> Play Now
                </button>
              </div>
            </header>
    
            <main className="w-full max-w-[1600px] mx-auto px-8 md:px-16 pt-24">
              {history.length > 0 && (
                <section className="mb-24">
                  <h2 className="text-[42px] font-serif font-bold text-white mb-12 tracking-tight">Continue Watching</h2>
                  <div className="flex gap-10 overflow-x-auto pb-10 hide-scrollbar">
                    {history.map(h => (
                      <ContinueCard 
                        key={h.historyId} 
                        title={h.movie.title} 
                        progress={h.isCompleted ? 100 : Math.min(100, (h.progressSeconds / 7200) * 100)}
                        imgUrl={h.movie.posterUrl} 
                        movieId={h.movie.id} 
                        slug={h.movie.slug}
                      />
                    ))}
                  </div>
                </section>
              )}

              <section className="mb-24">
                <h2 className="text-[42px] font-serif font-bold text-white mb-12 tracking-tight">New & Noteworthy</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
                  {loading ? [1,2,3,4,5].map(i => <div key={i} className="w-full aspect-[2/3] bg-white/5 animate-pulse rounded-sm" />) :
                    filteredMovies.map(m => <HoverPlayer key={m.id} {...m} />)
                  }
                </div>
              </section>
            </main>
          </>
        )}
 
        <footer className="w-full py-24 bg-[#0A0A0A] mt-24 border-t border-white/5 text-center">
          <p className="text-[10px] tracking-[0.4em] uppercase text-white/10">© 2026 TVIEN. THE VOID IS CALLING.</p>
        </footer>



        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
      </div>
    </>
  );
}