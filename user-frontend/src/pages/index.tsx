import React, { useEffect, useState, useRef, memo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Search, User, Play, X, PlayCircle } from 'lucide-react';
 
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
}
 
// ─── Constants ────────────────────────────────────────────────────────────────
const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:5113/api/public/gatekeeper';
const API_URL    = process.env.NEXT_PUBLIC_API_URL    ?? 'http://localhost:5113/api/admin/Movies';
 
function getISOWeek(date: Date): number {
  const startDate = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor((date.getTime() - startDate.getTime()) / 86_400_000);
  return Math.ceil((date.getDay() + 1 + days) / 7);
}
const CURRENT_WEEK = getISOWeek(new Date());
 
function normalizeMovie(d: any): Movie {
  return {
    id:                   d.id               ?? d.Id               ?? '',
    title:                d.title            ?? d.Title            ?? 'Untitled',
    slug:                 d.slug             ?? d.Slug             ?? '',
    description:          d.description      ?? d.Description      ?? '',
    posterUrl:            d.posterUrl        ?? d.PosterUrl,
    releaseYear:          d.releaseYear      ?? d.ReleaseYear      ?? 2024,
    weeklyViews:          d.weeklyViews      ?? d.WeeklyViews      ?? 0,
    weeklyViewsResetWeek: d.weeklyViewsResetWeek ?? d.WeeklyViewsResetWeek ?? 0,
    movieType:            d.movieType        ?? d.MovieType        ?? 'movie',
  };
}
 
// ─── Navbar (Optimized) ──────────────────────────────────────────────────────
const Navbar = memo(({ activeTab, onTabChange, onSearchOpen }: any) => (
  <nav className="fixed top-0 w-full z-50 bg-black/20 backdrop-blur-2xl border-b border-white/5">
    <div className="flex justify-between items-center px-8 md:px-16 h-24 max-w-[1600px] mx-auto">
      <div className="text-[28px] font-bold tracking-tighter text-white">TviEn</div>
      <div className="hidden md:flex gap-12 text-[11px] tracking-[0.25em] uppercase font-medium text-white/40">
        <button onClick={() => onTabChange('cinema')} className={`transition ${activeTab === 'cinema' ? 'text-white border-b border-white pb-1' : 'hover:text-white'}`}>Cinema</button>
        <button onClick={() => onTabChange('series')} className={`transition ${activeTab === 'series' ? 'text-white border-b border-white pb-1' : 'hover:text-white'}`}>Series</button>
        <button onClick={() => onTabChange('originals')} className={`transition ${activeTab === 'originals' ? 'text-white border-b border-white pb-1' : 'hover:text-white'}`}>Originals</button>
        <button onClick={() => onTabChange('library')} className={`transition ${activeTab === 'library' ? 'text-white border-b border-white pb-1' : 'hover:text-white'}`}>Library</button>
      </div>
      <div className="flex items-center gap-8">
        <button onClick={onSearchOpen} className="text-white/60 hover:text-white transition"><Search className="w-5 h-5" /></button>
        <button className="text-white/60 hover:text-white transition"><User className="w-5 h-5" /></button>
      </div>
    </div>
  </nav>
));
Navbar.displayName = 'Navbar';
 
// ─── HoverPlayer (Super Optimized - Lazy Video) ───────────────────────────────
const HoverPlayer = memo(({ id, title, posterUrl }: Movie) => {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const previewUrl = `${WORKER_URL}/video/${id}/preview.mp4`;
 
  return (
    <div
      onClick={() => router.push(`/watch/${id}`)}
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
      
      <div className="absolute inset-0 group-hover:bg-black/20 transition-colors z-20" />
      <div className="absolute bottom-0 left-0 w-full p-6 z-30 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300 bg-gradient-to-t from-black/80 to-transparent">
        <span className="text-white text-xs font-bold uppercase tracking-widest truncate block">{title}</span>
      </div>
    </div>
  );
});
HoverPlayer.displayName = 'HoverPlayer';
 
// ─── ContinueCard (Optimized) ─────────────────────────────────────────────────
const ContinueCard = memo(({ title, imgUrl, progress, movieId }: { title: string; imgUrl: string; progress: number; movieId?: string }) => {
  const router = useRouter();
  return (
    <div 
      onClick={() => movieId && router.push(`/watch/${movieId}`)}
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('cinema');
 
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
    fetch(API_URL)
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
        <Navbar activeTab={activeTab} onTabChange={handleTabChange} onSearchOpen={() => setSearchOpen(true)} />
        
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
            <button className="bg-white text-black px-10 py-4 rounded-sm font-semibold text-[11px] uppercase tracking-[0.2em] hover:bg-white/80 transition-all flex items-center gap-3">
              <Play className="w-5 h-5 fill-current" /> Play Now
            </button>
          </div>
        </header>
 
        <main className="w-full max-w-[1600px] mx-auto px-8 md:px-16 pt-24">
          <section className="mb-24">
            <h2 className="text-[42px] font-serif font-bold text-white mb-12 tracking-tight">New & Noteworthy</h2>
            <div className="flex gap-6 overflow-x-auto pb-10 hide-scrollbar">
              {loading ? [1,2,3,4,5].map(i => <div key={i} className="w-[240px] aspect-[2/3] bg-white/5 animate-pulse rounded-sm" />) :
                filteredMovies.map(m => <HoverPlayer key={m.id} {...m} />)
              }
            </div>
          </section>
 
          <section className="mb-24">
            <h2 className="text-[42px] font-serif font-bold text-white mb-12 tracking-tight">Continue Watching</h2>
            <div className="flex gap-6 overflow-x-auto pb-10 hide-scrollbar">
              <ContinueCard title="Echoes of Silence" progress={75} imgUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuD63HDODUKXchyc1i-5yUlOP408n4WiNeQsrSApMuE-DpBczngjwylsEruWvwQXx7BQkm-QH8spSo1V_1yy-aydc5wspZhxC1P9_oCxTr9fdZGRnAtqI4IDyYAaKFzNXz72yJC5UyKrLdWQlaJKnOxHTLi82wMLGyfxKdfUvJ-BOYIKWrh6BqLqiOJ08k6kINDV4RhVCQKj2oezCl1FJ3HCzTN9AwoTVeo_r3gqPdDp9I5aWixDT2qw4cEiJaRU07syVJOfSgKN2hUE" />
              <ContinueCard title="Dune: Part Two" progress={30} imgUrl="https://lh3.googleusercontent.com/aida-public/AB6AXuA9qY04G39OpNTNBchQLE0JT09lrnFe0ZuURnboSIQehu_1MKMJfXX8fcnTcdZbsroKifq2-gUiROtrlfICIJ-lFfdeIkZCSH4Xo548OACnWOyT6KAqoFNgRjCtcZ5N3SFXi3niNq7fuOq54kCkf3VfHZHzzwLC_OZ7Q5y29l3VYSL9ZbYcTACvswGIDdtdPLirpkA5VvVbus9viQ5czfHmiiRUl9kDr-wV2Nk_hnBns7ShZP6OdtLHZJamUsraJchRJ-4VMKBEFKuB" />
            </div>
          </section>
        </main>
 
        <footer className="w-full py-24 bg-[#0A0A0A] mt-24 border-t border-white/5 text-center">
          <p className="text-[10px] tracking-[0.4em] uppercase text-white/10">© 2024 TVIEN. THE VOID IS CALLING.</p>
        </footer>
      </div>
    </>
  );
}
