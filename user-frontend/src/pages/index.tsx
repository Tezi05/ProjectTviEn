import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Search, User, Play, Plus } from 'lucide-react';

interface Movie {
  id: string;
  title: string;
  slug: string;
  posterUrl?: string;
}

// 1. Header (Floating Glassmorphism)
const Navbar = () => (
  <nav className="fixed top-4 left-1/2 -translate-x-1/2 w-[95%] max-w-7xl z-50 rounded-2xl bg-white/10 backdrop-blur-md px-6 py-4 flex justify-between items-center border border-white/5">
    <div className="text-white text-xl font-bold tracking-widest">CINEMA</div>
    <div className="flex gap-6 text-gray-300">
      <Search className="w-5 h-5 cursor-pointer hover:text-white transition" />
      <User className="w-5 h-5 cursor-pointer hover:text-white transition" />
    </div>
  </nav>
);

// 2. Hero Section
const Hero = ({ featured }: { featured: Movie | null }) => (
  <div className="relative w-full h-[85vh]">
    <img 
      src="https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2000&auto=format&fit=crop" 
      alt="Hero Cover" 
      className="w-full h-full object-cover"
    />
    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-black/40 to-transparent"></div>
    <div className="absolute inset-0 bg-gradient-to-r from-[#0a0a0a]/90 via-black/40 to-transparent"></div>

    <div className="absolute bottom-20 left-12 md:left-24">
      <div className="flex items-center gap-4 mb-2">
        <h1 className="text-white text-6xl md:text-8xl font-black uppercase tracking-tighter">
          {featured ? featured.title : "TviEn Movie"}
        </h1>
        <button className="bg-white/90 hover:bg-white text-black p-4 rounded-full transition-transform hover:scale-105 mt-2">
          <Play className="w-8 h-8 ml-1" fill="currentColor" />
        </button>
      </div>
      <p className="text-gray-400 text-sm tracking-widest uppercase font-semibold">
        {featured ? "FEATURED • 2026" : "WELCOME"}
      </p>
    </div>
  </div>
);

// 3. HoverPlayer Component (Thay thế MovieCard cũ)
const HoverPlayer = ({ id, title, slug, posterUrl }: Movie) => {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  
  // Logic hiển thị ảnh: 1. PosterUrl, 2. Thumbnail từ R2, 3. Unsplash (Fallback)
  const hash = title.charCodeAt(0) + title.charCodeAt(title.length - 1);
  const fallbackImgUrl = `https://images.unsplash.com/photo-${1500000000000 + hash}?q=80&w=400&h=600&auto=format&fit=crop`;
  
  // URL Worker/Gatekeeper - Có thể đưa vào biến môi trường
  const workerUrl = "http://localhost:5113/api/public/gatekeeper"; 
  const [cacheBuster] = React.useState(Date.now()); // Chống bóng ma Cache (Khởi tạo 1 lần khi mount)
  const defaultThumbnailUrl = `${workerUrl}/video/${id}/thumbnail.jpg?v=${cacheBuster}`;
  const previewVideoUrl = `${workerUrl}/video/${id}/preview.mp4?v=${cacheBuster}`;

  return (
    <div
      onClick={() => router.push(`/watch/${id}`)}
      onMouseEnter={() => {
          if (videoRef.current) {
              const playPromise = videoRef.current.play();
              if (playPromise !== undefined) playPromise.catch(() => {});
          }
      }}
      onMouseLeave={() => {
          if (videoRef.current) {
              videoRef.current.pause();
              videoRef.current.currentTime = 0;
          }
      }}
      className="relative w-40 md:w-48 aspect-[2/3] rounded-xl overflow-hidden shrink-0 group cursor-pointer"
    >
      <div className="w-full h-full bg-gray-900 border border-white/10 relative">
        <video 
           ref={videoRef}
           src={previewVideoUrl}
           className="w-full h-full object-cover absolute inset-0 z-0"
           preload="metadata"
           muted
           loop
           playsInline
        />
        <img 
          src={posterUrl || defaultThumbnailUrl} 
          alt={title} 
          className="w-full h-full object-cover absolute inset-0 z-10 transition-opacity duration-700 group-hover:opacity-0" 
          onError={(e) => { 
             // Nếu ảnh thumbnail lỗi (phim cũ chưa có), chuyển sang Unsplash
             if (e.currentTarget.src !== fallbackImgUrl) {
                e.currentTarget.src = fallbackImgUrl;
             }
          }}
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-4 z-20 pointer-events-none">
        <div className="flex justify-between items-end transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
          <span className="text-white font-bold text-sm truncate pr-2">{title}</span>
          <div className="bg-white p-1.5 rounded-full flex-shrink-0">
            <Play className="w-3 h-3 text-black ml-0.5" fill="currentColor" />
          </div>
        </div>
      </div>
    </div>
  );
};

// 4. Continue Watching Card
const ContinueCard = ({ title, imgUrl, progress }: { title: string, imgUrl: string, progress: number }) => (
  <div className="relative w-64 md:w-80 aspect-video rounded-xl overflow-hidden shrink-0 group cursor-pointer">
    <img src={imgUrl} alt={title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
    <div className="absolute inset-0 bg-black/30 group-hover:bg-black/10 transition-colors duration-300 flex items-center justify-center">
        <Play className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" fill="currentColor" />
    </div>
    <div className="absolute bottom-0 w-full bg-black/60 backdrop-blur-sm p-3">
      <span className="text-white text-sm font-medium">{title}</span>
      <div className="w-full bg-gray-700 h-1 mt-2 rounded-full overflow-hidden">
        <div className="bg-white h-full" style={{ width: `${progress}%` }}></div>
      </div>
    </div>
  </div>
);

// 5. Section/Row Component
const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
  <div className="mt-12 pl-12 md:pl-24">
    <h2 className="text-white text-lg font-bold mb-4">{title}</h2>
    <div className="flex gap-4 overflow-x-auto pb-4 pr-12 md:pr-24" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
      {children}
    </div>
  </div>
);

// 6. Minimal Footer
const Footer = () => (
  <footer className="w-full mt-24 py-12 border-t border-white/5 flex flex-col items-center gap-6 text-xs text-gray-600">
    <div className="flex gap-8 uppercase tracking-widest font-semibold">
      <a href="#" className="hover:text-white transition">Giới thiệu</a>
      <a href="#" className="hover:text-white transition">Điều khoản</a>
      <a href="#" className="hover:text-white transition">Quyền riêng tư</a>
      <a href="#" className="hover:text-white transition">Liên hệ</a>
    </div>
    <p>© 2026 CINEMA PLATFORM. ALL RIGHTS RESERVED.</p>
  </footer>
);

export default function StreamingApp() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Gọi API động lấy danh sách phim
    fetch('http://localhost:5113/api/admin/Movies')
      .then(res => res.json())
      .then(data => {
        const mappedData = data.map((d: any) => ({
          ...d,
          id: d.id || d.Id,
          title: d.title || d.Title,
          slug: d.slug || d.Slug,
          posterUrl: d.posterUrl || d.PosterUrl,
          weeklyViews: d.weeklyViews || d.WeeklyViews || 0,
          weeklyViewsResetWeek: d.weeklyViewsResetWeek || d.WeeklyViewsResetWeek || 0
        }));
        setMovies(mappedData);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to fetch movies:", err);
        setLoading(false);
      });
  }, []);

  const featuredMovie = movies.length > 0 ? movies[0] : null;

  return (
    <div className="bg-[#0a0a0a] min-h-screen font-sans overflow-x-hidden selection:bg-white selection:text-black pb-8">
      <Navbar />
      <Hero featured={featuredMovie} />
      
      <div className="-mt-20 relative z-10">
        <Section title="Phim Mới Cập Nhật">
          {loading && <div className="text-gray-500">Đang tải dữ liệu động từ API...</div>}
          {!loading && movies.length === 0 && (
            <div className="text-gray-500 text-sm italic">Chưa có bộ phim nào trên hệ thống.</div>
          )}
          {movies.map((movie) => (
            <HoverPlayer key={movie.id} id={movie.id} title={movie.title} slug={movie.slug} posterUrl={movie.posterUrl} />
          ))}
        </Section>

        {/* Template Mẫu Khung Cảnh */}
        <Section title="Lịch Sử">
          <ContinueCard title="Tự động Phát tập kế tiếp" progress={65} imgUrl="https://images.unsplash.com/photo-1508921912186-1d1a45ebb3c1?q=80&w=600&auto=format&fit=crop" />
          <ContinueCard title="Dune: Part Hai - Đoạn 3" progress={30} imgUrl="https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?q=80&w=600&auto=format&fit=crop" />
        </Section>

        {!loading && movies.length > 0 && (
          <Section title="Xu Hướng Tuần Này">
            {movies
              .filter((movie: any) => {
                 // Tính toán số hiệu tuần hiện tại (ISO week)
                 const currentDate = new Date();
                 const startDate = new Date(currentDate.getFullYear(), 0, 1);
                 const days = Math.floor((currentDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
                 const currentWeek = Math.ceil((currentDate.getDay() + 1 + days) / 7);
                 
                 // So sánh với tuần được lưu trong backend
                 return movie.weeklyViewsResetWeek === currentWeek && movie.weeklyViews > 0;
              })
              .sort((a: any, b: any) => b.weeklyViews - a.weeklyViews)
              .slice(0, 10) // Lấy top 10
              .map((movie) => (
                <HoverPlayer key={movie.id} id={movie.id} title={movie.title} slug={movie.slug} posterUrl={movie.posterUrl} />
            ))}
            
            {/* Fallback nếu tuần này chưa có ai xem phim nào */}
            {movies.filter((movie: any) => {
                 const currentDate = new Date();
                 const startDate = new Date(currentDate.getFullYear(), 0, 1);
                 const days = Math.floor((currentDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));
                 const currentWeek = Math.ceil((currentDate.getDay() + 1 + days) / 7);
                 return movie.weeklyViewsResetWeek === currentWeek && movie.weeklyViews > 0;
            }).length === 0 && movies.slice(0, 5).map((movie) => (
               <HoverPlayer key={movie.id} id={movie.id} title={movie.title} slug={movie.slug} posterUrl={movie.posterUrl} />
            ))}
          </Section>
        )}
      </div>

      <Footer />
    </div>
  );
}
