import React, { useEffect, useState, useRef, memo } from 'react';
import { useRouter } from 'next/router';
import { Search, User as UserIcon, X, LogOut, Filter, Film, Calendar, Tv, Sparkles, Video, Info } from 'lucide-react';

export const Navbar = memo(({ activeTab, onTabChange, user, onLoginClick, onLogoutClick, searchQuery, setSearchQuery, onSearchSubmit, movies = [], uniqueActors = [], uniqueDirectors = [] }: any) => {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [showFiltersPanel, setShowFiltersPanel] = useState(false);
  const [tempSearchQuery, setTempSearchQuery] = useState(searchQuery);
  const panelRef = useRef<HTMLDivElement>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  // Scroll to Hide Navbar logic
  const [isVisible, setIsVisible] = useState(true);
  const lastScrollY = useRef(0);

  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  useEffect(() => {
    if (isExpanded) {
      setShowFiltersPanel(false);
    }
  }, [isExpanded]);

  useEffect(() => {
    if (showFiltersPanel) {
      setIsExpanded(false);
    }
  }, [showFiltersPanel]);

  useEffect(() => {
    const handleScroll = () => {
      if (isExpanded) {
        setIsVisible(true);
        return;
      }
      const currentScrollY = window.scrollY;
      
      // Hide if scrolling down and scrolled past 100px. Show if scrolling up.
      if (currentScrollY > lastScrollY.current && currentScrollY > 100) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [isExpanded]);

  useEffect(() => {
    if (showFiltersPanel) {
      setTempSearchQuery(searchQuery);
    }
  }, [showFiltersPanel, searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showFiltersPanel &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        filterBtnRef.current &&
        !filterBtnRef.current.contains(event.target as Node)
      ) {
        setShowFiltersPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showFiltersPanel]);

  // ─── Filter Calculations & Synchronization ──────────────────────────────────
  const activeQuery = showFiltersPanel ? tempSearchQuery : searchQuery;
  const segments = activeQuery.split(',').map((s: string) => s.trim()).filter(Boolean);

  const activeYearSegment = segments.find((s: string) => s.toLowerCase().startsWith('năm:'));
  const activeYear = activeYearSegment ? activeYearSegment.substring('năm:'.length).trim() : null;

  const activeGenres = segments
    .filter((s: string) => s.toLowerCase().startsWith('thể loại:'))
    .map((s: string) => s.substring('thể loại:'.length).trim().toLowerCase());

  const activeAgeSegment = segments.find((s: string) => s.toLowerCase().startsWith('độ tuổi:'));
  const activeAge = activeAgeSegment ? activeAgeSegment.substring('độ tuổi:'.length).trim() : null;
  const activeTypeSegment = segments.find((s: string) => s.toLowerCase().startsWith('phân loại:'));
  const activeType = activeTypeSegment ? activeTypeSegment.substring('phân loại:'.length).trim() : null;

  // Dynamic values extracted from the database movies list
  const dbYears = Array.from(new Set<string>(movies.map((m: any) => m.releaseYear?.toString()).filter(Boolean)))
    .sort((a: string, b: string) => b.localeCompare(a));
  const displayedYears = dbYears.length > 0 ? dbYears : ['2026', '2025', '2024', '2023', '2022', '2021', '2020'];

  const dbGenres = Array.from(new Set<string>(movies.flatMap((m: any) => m.genres || []).filter(Boolean)))
    .sort((a: string, b: string) => a.localeCompare(b));
  const displayedGenres = dbGenres.length > 0 ? dbGenres : ['Sci-Fi', 'Mystery', 'Thriller', 'Action', 'Cyberpunk', 'Horror', 'Drama', 'Psychological', 'Comedy', 'Romance'];

  const dbAges = Array.from(new Set<string>(movies.map((m: any) => m.ageRating).filter(Boolean)))
    .sort((a: string, b: string) => a.localeCompare(b));
  const displayedAges = dbAges.length > 0 ? dbAges.map((age: string) => ({ code: age, desc: age })) : [
    { code: 'G', desc: 'G' },
    { code: 'PG', desc: 'PG' },
    { code: 'PG-13', desc: 'PG-13' },
    { code: 'R', desc: 'R' },
    { code: 'NC-17', desc: 'NC-17' }
  ];

  const toggleFilter = (type: 'năm' | 'thể loại' | 'độ tuổi' | 'phân loại' | 'all', value?: string) => {
    const currentSegments = tempSearchQuery.split(',').map((s: string) => s.trim()).filter(Boolean);
    
    if (type === 'all') {
      setTempSearchQuery('');
      return;
    }

    if (!value || value === 'Tất cả') {
      // Clear all segments of this type
      const newSegments = currentSegments.filter((seg: string) => {
        const lower = seg.toLowerCase();
        if (type === 'năm' && lower.startsWith('năm:')) return false;
        if (type === 'thể loại' && lower.startsWith('thể loại:')) return false;
        if (type === 'độ tuổi' && lower.startsWith('độ tuổi:')) return false;
        if (type === 'phân loại' && lower.startsWith('phân loại:')) return false;
        return true;
      });
      setTempSearchQuery(newSegments.join(', '));
      return;
    }

    // Toggle behavior
    if (type === 'thể loại') {
      // Genre: multi-select toggleable
      const targetSeg = `thể loại: ${value}`.toLowerCase();
      const exists = currentSegments.some((seg: string) => seg.toLowerCase() === targetSeg);
      
      let newSegments;
      if (exists) {
        newSegments = currentSegments.filter((seg: string) => seg.toLowerCase() !== targetSeg);
      } else {
        newSegments = [...currentSegments, `thể loại: ${value}`];
      }
      setTempSearchQuery(newSegments.join(', '));
    } else {
      // Year, Age, Type: single-select toggleable
      let alreadyActive = false;
      
      const newSegments = currentSegments.filter((seg: string) => {
        const lower = seg.toLowerCase();
        if (type === 'năm' && lower.startsWith('năm:')) {
          if (lower === `năm: ${value}`.toLowerCase()) {
            alreadyActive = true;
          }
          return false;
        }
        if (type === 'độ tuổi' && lower.startsWith('độ tuổi:')) {
          if (lower === `độ tuổi: ${value}`.toLowerCase()) {
            alreadyActive = true;
          }
          return false;
        }
        if (type === 'phân loại' && lower.startsWith('phân loại:')) {
          if (lower === `phân loại: ${value}`.toLowerCase()) {
            alreadyActive = true;
          }
          return false;
        }
        return true;
      });

      if (!alreadyActive) {
        if (type === 'năm') newSegments.push(`năm: ${value}`);
        else if (type === 'độ tuổi') newSegments.push(`độ tuổi: ${value}`);
        else if (type === 'phân loại') newSegments.push(`phân loại: ${value}`);
      }
      
      setTempSearchQuery(newSegments.join(', '));
    }
  };

  return (
    <nav className={`fixed top-0 w-full z-50 bg-black/20 backdrop-blur-2xl border-b border-white/5 transition-transform duration-500 ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="flex justify-between items-center px-8 md:px-16 h-24 max-w-[1600px] mx-auto">

        {/* Logo */}
        <div className="text-[28px] font-bold tracking-tighter text-white flex-shrink-0 cursor-pointer" onClick={() => router.push('/')}>TviEn</div>

        {/* Phần giữa: Tabs (bình thường) hoặc Search bar (khi expand) */}
        <div className="hidden md:flex flex-1 justify-center items-center px-12 relative">
          {/* Tabs — ẩn mượt khi expand */}
          <div className={`flex gap-12 text-[11px] tracking-[0.25em] uppercase font-medium text-white/40 transition-all duration-400 ${isExpanded ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
            <button onClick={() => onTabChange && onTabChange('trangchu')} className={`transition ${activeTab === 'trangchu' ? 'text-white border-b border-white pb-1' : 'hover:text-white'}`}>Trang chủ</button>
            <button onClick={() => onTabChange && onTabChange('tvseries')} className={`transition ${activeTab === 'tvseries' ? 'text-white border-b border-white pb-1' : 'hover:text-white'}`}>TVSeries</button>
            <button onClick={() => onTabChange && onTabChange('phimdoclap')} className={`transition ${activeTab === 'phimdoclap' ? 'text-white border-b border-white pb-1' : 'hover:text-white'}`}>Phim độc lập</button>
            <button onClick={() => onTabChange && onTabChange('phimthuongmai')} className={`transition ${activeTab === 'phimthuongmai' ? 'text-white border-b border-white pb-1' : 'hover:text-white'}`}>Phim thương mại</button>
            <button 
              ref={filterBtnRef}
              onClick={(e) => {
                e.preventDefault();
                setShowFiltersPanel(!showFiltersPanel);
              }} 
              className={`transition relative ${activeTab === 'locphim' || showFiltersPanel ? 'text-white border-b border-white pb-1' : 'hover:text-white'}`}
            >
              Lọc phim
            </button>
            <button onClick={() => onTabChange && onTabChange('thuvien')} className={`transition ${activeTab === 'thuvien' ? 'text-white border-b border-white pb-1' : 'hover:text-white'}`}>Thư viện</button>
            
          </div>

          {/* Search bar — hiện mượt khi expand, nằm absolute để che tabs */}
          <div className={`absolute inset-y-0 left-8 right-8 flex items-center transition-all duration-400 ${isExpanded ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
            {/* Icon Search bên trái — thay thế Filter */}
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setIsExpanded(true);
                setTimeout(() => inputRef.current?.focus(), 50);
              }}
              className="relative flex-shrink-0 mr-4 cursor-pointer group text-white/40 hover:text-white transition-colors"
            >
              <Search className="w-5 h-5" strokeWidth={1.5} />
            </button>

            {/* Input */}
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery.trim() !== '') {
                  setIsExpanded(false);
                  onSearchSubmit(searchQuery);
                } else if (e.key === 'Escape') {
                  setIsExpanded(false);
                  setSearchQuery('');
                }
              }}
              placeholder="Tìm phim, diễn viên: abc, đạo diễn: xyz..."
              className="flex-1 bg-transparent outline-none text-white text-sm font-light placeholder-white/30 transition-colors duration-300 min-w-0"
            />

            {/* Nút tìm kiếm (bên phải) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                if (searchQuery.trim() !== '') {
                  setIsExpanded(false);
                  onSearchSubmit(searchQuery);
                }
              }}
              className="flex-shrink-0 ml-4 px-4 py-1.5 bg-white/10 hover:bg-white text-white hover:text-black rounded-sm transition-colors text-[10px] font-bold tracking-widest uppercase border border-white/20 hover:border-transparent"
            >
              Tìm
            </button>
          </div>

          {/* Suggestions Dropdown — Hiển thị khi đang expand */}
          {isExpanded && (() => {
            const segments = searchQuery.split(',');
            const lastSegment = segments[segments.length - 1].trimStart();
            
            const isActorSearch = lastSegment.toLowerCase().startsWith('diễn viên:');
            const isDirectorSearch = lastSegment.toLowerCase().startsWith('đạo diễn:');
            const isGenreSearch = lastSegment.toLowerCase().startsWith('thể loại:');
            const isYearSearch = lastSegment.toLowerCase().startsWith('năm:');
            
            const searchTerm = isActorSearch ? lastSegment.substring('diễn viên:'.length).trim().toLowerCase() :
                               isDirectorSearch ? lastSegment.substring('đạo diễn:'.length).trim().toLowerCase() :
                               isGenreSearch ? lastSegment.substring('thể loại:'.length).trim().toLowerCase() :
                               isYearSearch ? lastSegment.substring('năm:'.length).trim().toLowerCase() :
                               lastSegment.toLowerCase();

            // Trạng thái: Ô tìm kiếm trống -> Hiển thị Bộ lọc Thông minh & Phổ biến
            if (searchQuery.trim() === '') {
              const popularGenres = displayedGenres.slice(0, 8);
              
              return (
                <div className="absolute top-[42px] left-8 right-8 bg-[#0c0c0e]/95 backdrop-blur-3xl border border-white/10 rounded-md p-4 shadow-[0_15px_50px_rgba(255,255,255,0.05)] flex flex-col gap-4 z-50 max-h-[380px] overflow-y-auto hide-scrollbar transition-all duration-300">
                  {/* Hướng dẫn cú pháp tìm kiếm */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-white">
                      <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                      <span>Bộ lọc Thông minh & Tìm kiếm Nâng cao</span>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed font-light">
                      Hỗ trợ tìm kết hợp nhiều bộ lọc bằng dấu phẩy. Ví dụ: <span className="text-white/60 font-mono">diễn viên: Keanu Reeves, thể loại: Sci-Fi</span>
                    </p>
                  </div>

                  {/* Nút cú pháp lọc nhanh */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery('diễn viên: ');
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/10 border border-white/5 hover:border-white/30 rounded-sm text-left transition-all duration-300 text-xs text-white/70 hover:text-white group"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-white/40">Diễn viên</span>
                        <span className="font-mono text-[10px]">diễn viên:</span>
                      </div>
                    </button>

                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery('đạo diễn: ');
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/10 border border-white/5 hover:border-white/30 rounded-sm text-left transition-all duration-300 text-xs text-white/70 hover:text-white group"
                    >
                      <Video className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-white/40">Đạo diễn</span>
                        <span className="font-mono text-[10px]">đạo diễn:</span>
                      </div>
                    </button>

                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery('thể loại: ');
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/10 border border-white/5 hover:border-white/30 rounded-sm text-left transition-all duration-300 text-xs text-white/70 hover:text-white group"
                    >
                      <Film className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-white/40">Thể loại</span>
                        <span className="font-mono text-[10px]">thể loại:</span>
                      </div>
                    </button>

                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery('năm: ');
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/10 border border-white/5 hover:border-white/30 rounded-sm text-left transition-all duration-300 text-xs text-white/70 hover:text-white group"
                    >
                      <Calendar className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-white/40">Năm</span>
                        <span className="font-mono text-[10px]">năm:</span>
                      </div>
                    </button>
                  </div>

                  {/* Danh sách Thể loại thịnh hành */}
                  <div className="flex flex-col gap-2">
                    <span className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Thể loại thịnh hành</span>
                    <div className="flex flex-wrap gap-1.5">
                      {popularGenres.map((cat) => (
                        <button
                          key={cat}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setSearchQuery((prev: string) => {
                              const cleaned = prev.trim();
                              if (!cleaned) return `thể loại: ${cat}`;
                              return cleaned.endsWith(',') ? `${cleaned} thể loại: ${cat}` : `${cleaned}, thể loại: ${cat}`;
                            });
                            setTimeout(() => inputRef.current?.focus(), 50);
                          }}
                          className="text-[10px] font-medium tracking-wide bg-white/5 hover:bg-white text-white/70 hover:text-black px-3 py-1 rounded transition-all duration-200 border border-white/5 hover:border-white/30"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Diễn viên & Đạo diễn tiêu biểu */}
                  <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3">
                    {uniqueActors.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Diễn viên nổi tiếng</span>
                        <div className="flex flex-wrap gap-1.5">
                          {uniqueActors.slice(0, 4).map((actor: string) => (
                            <button
                              key={actor}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSearchQuery((prev: string) => {
                                  const cleaned = prev.trim();
                                  if (!cleaned) return `diễn viên: ${actor}`;
                                  return cleaned.endsWith(',') ? `${cleaned} diễn viên: ${actor}` : `${cleaned}, diễn viên: ${actor}`;
                                });
                                setTimeout(() => inputRef.current?.focus(), 50);
                              }}
                              className="text-[10px] font-light bg-white/5 hover:bg-white text-white/60 hover:text-black px-2 py-0.5 rounded transition-all duration-150 border border-white/5 hover:border-white/30"
                            >
                              {actor}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {uniqueDirectors.length > 0 && (
                      <div className="flex flex-col gap-2">
                        <span className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Đạo diễn tiêu biểu</span>
                        <div className="flex flex-wrap gap-1.5">
                          {uniqueDirectors.slice(0, 4).map((dir: string) => (
                            <button
                              key={dir}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setSearchQuery((prev: string) => {
                                  const cleaned = prev.trim();
                                  if (!cleaned) return `đạo diễn: ${dir}`;
                                  return cleaned.endsWith(',') ? `${cleaned} đạo diễn: ${dir}` : `${cleaned}, đạo diễn: ${dir}`;
                                });
                                setTimeout(() => inputRef.current?.focus(), 50);
                              }}
                              className="text-[10px] font-light bg-white/5 hover:bg-white text-white/60 hover:text-black px-2 py-0.5 rounded transition-all duration-150 border border-white/5 hover:border-white/30"
                            >
                              {dir}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Trạng thái: Có từ khóa tìm kiếm -> Hiển thị Gợi ý Autocomplete
            let suggestions: { type: string, label: string, filter: string, slug?: string }[] = [];
            
            if (!isActorSearch && !isDirectorSearch && !isGenreSearch && !isYearSearch) {
              movies.filter((m: any) => m.title.toLowerCase().includes(searchTerm) || m.description?.toLowerCase().includes(searchTerm)).slice(0, 4).forEach((m: any) => {
                suggestions.push({ type: 'Phim', label: `${m.title} (${m.releaseYear})`, filter: 'movie', slug: m.slug || m.id });
              });
              uniqueActors.filter((a: any) => a.toLowerCase().includes(searchTerm)).slice(0, 3).forEach((a: any) => {
                suggestions.push({ type: 'Diễn viên', label: a, filter: 'actor' });
              });
              uniqueDirectors.filter((d: any) => d.toLowerCase().includes(searchTerm)).slice(0, 3).forEach((d: any) => {
                suggestions.push({ type: 'Đạo diễn', label: d, filter: 'director' });
              });
              const popularGenres = displayedGenres.slice(0, 8);
              popularGenres.filter((g: any) => g.toLowerCase().includes(searchTerm)).slice(0, 3).forEach((g: any) => {
                suggestions.push({ type: 'Thể loại', label: g, filter: 'genre' });
              });
              const years = ['2026', '2025', '2024', '2023', '2022'];
              years.filter((y: any) => y.includes(searchTerm)).slice(0, 3).forEach((y: any) => {
                suggestions.push({ type: 'Năm', label: y, filter: 'year' });
              });
            } else if (isActorSearch) {
              uniqueActors.filter((a: any) => a.toLowerCase().includes(searchTerm)).slice(0, 5).forEach((a: any) => {
                suggestions.push({ type: 'Diễn viên', label: a, filter: 'actor' });
              });
            } else if (isDirectorSearch) {
              uniqueDirectors.filter((d: any) => d.toLowerCase().includes(searchTerm)).slice(0, 5).forEach((d: any) => {
                suggestions.push({ type: 'Đạo diễn', label: d, filter: 'director' });
              });
            } else if (isGenreSearch) {
              const popularGenres = displayedGenres.slice(0, 8);
              popularGenres.filter((g: any) => g.toLowerCase().includes(searchTerm)).slice(0, 5).forEach((g: any) => {
                suggestions.push({ type: 'Thể loại', label: g, filter: 'genre' });
              });
            } else if (isYearSearch) {
              const years = ['2026', '2025', '2024', '2023', '2022'];
              years.filter((y: any) => y.includes(searchTerm)).slice(0, 5).forEach((y: any) => {
                suggestions.push({ type: 'Năm', label: y, filter: 'year' });
              });
            }

            if (suggestions.length === 0) return null;

            return (
              <div className="absolute top-[42px] left-8 right-8 bg-[#0c0c0e]/95 backdrop-blur-3xl border border-white/10 rounded-md p-4 shadow-[0_15px_50px_rgba(255,255,255,0.05)] flex flex-col gap-4 z-50">
                
                {/* Phần trên (Ảnh 3): Hướng dẫn cú pháp và Nút lọc nhanh */}
                <div className="flex flex-col gap-4 border-b border-white/5 pb-4">
                  {/* Hướng dẫn cú pháp tìm kiếm */}
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] font-semibold text-white">
                      <Sparkles className="w-3.5 h-3.5 text-white animate-pulse" />
                      <span>Bộ lọc Thông minh & Tìm kiếm Nâng cao</span>
                    </div>
                    <p className="text-[11px] text-white/40 leading-relaxed font-light">
                      Hỗ trợ tìm kết hợp nhiều bộ lọc bằng dấu phẩy. Ví dụ: <span className="text-white/60 font-mono">diễn viên: Keanu Reeves, thể loại: Sci-Fi</span>
                    </p>
                  </div>

                  {/* Nút cú pháp lọc nhanh */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery((prev: string) => {
                          const cleaned = prev.trim();
                          if (!cleaned) return 'diễn viên: ';
                          return cleaned.endsWith(',') ? `${cleaned} diễn viên: ` : `${cleaned}, diễn viên: `;
                        });
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/10 border border-white/5 hover:border-white/30 rounded-sm text-left transition-all duration-300 text-xs text-white/70 hover:text-white group"
                    >
                      <UserIcon className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-white/40">Diễn viên</span>
                        <span className="font-mono text-[10px]">diễn viên:</span>
                      </div>
                    </button>

                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery((prev: string) => {
                          const cleaned = prev.trim();
                          if (!cleaned) return 'đạo diễn: ';
                          return cleaned.endsWith(',') ? `${cleaned} đạo diễn: ` : `${cleaned}, đạo diễn: `;
                        });
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/10 border border-white/5 hover:border-white/30 rounded-sm text-left transition-all duration-300 text-xs text-white/70 hover:text-white group"
                    >
                      <Video className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-white/40">Đạo diễn</span>
                        <span className="font-mono text-[10px]">đạo diễn:</span>
                      </div>
                    </button>

                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery((prev: string) => {
                          const cleaned = prev.trim();
                          if (!cleaned) return 'thể loại: ';
                          return cleaned.endsWith(',') ? `${cleaned} thể loại: ` : `${cleaned}, thể loại: `;
                        });
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/10 border border-white/5 hover:border-white/30 rounded-sm text-left transition-all duration-300 text-xs text-white/70 hover:text-white group"
                    >
                      <Film className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-white/40">Thể loại</span>
                        <span className="font-mono text-[10px]">thể loại:</span>
                      </div>
                    </button>

                    <button
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSearchQuery((prev: string) => {
                          const cleaned = prev.trim();
                          if (!cleaned) return 'năm: ';
                          return cleaned.endsWith(',') ? `${cleaned} năm: ` : `${cleaned}, năm: `;
                        });
                        setTimeout(() => inputRef.current?.focus(), 50);
                      }}
                      className="flex items-center gap-2 px-3 py-2 bg-white/[0.02] hover:bg-white/10 border border-white/5 hover:border-white/30 rounded-sm text-left transition-all duration-300 text-xs text-white/70 hover:text-white group"
                    >
                      <Calendar className="w-3.5 h-3.5 text-white group-hover:scale-110 transition-transform" />
                      <div className="flex flex-col">
                        <span className="text-[9px] uppercase tracking-wider font-semibold text-white/40">Năm</span>
                        <span className="font-mono text-[10px]">năm:</span>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Kết quả gợi ý (Ảnh 2) */}
                <div className="flex flex-col gap-1">
                  <div className="px-3 py-1.5 text-[9px] uppercase tracking-[0.15em] font-semibold text-white/30 border-b border-white/5 mb-1 flex items-center justify-between">
                    <span>Kết quả gợi ý</span>
                    <span className="text-[8px] opacity-60 font-light lowercase">Nhấn Enter để tìm kiếm tất cả</span>
                  </div>
                  <div className="flex flex-col gap-1 max-h-[220px] overflow-y-auto hide-scrollbar pr-1">
                    {suggestions.map((s, idx) => {
                      let badgeStyle = "text-white/70 border-white/20 bg-transparent";
                      let Icon = Film;
                      if (s.filter === 'actor') {
                        badgeStyle = "text-white/70 border-white/20 bg-transparent";
                        Icon = UserIcon;
                      } else if (s.filter === 'director') {
                        badgeStyle = "text-white/70 border-white/20 bg-transparent";
                        Icon = Video;
                      } else if (s.filter === 'genre') {
                        badgeStyle = "text-white/70 border-white/20 bg-transparent";
                        Icon = Film;
                      } else if (s.filter === 'year') {
                        badgeStyle = "text-white/70 border-white/20 bg-transparent";
                        Icon = Calendar;
                      }

                      return (
                        <button 
                          key={idx}
                          onMouseDown={(e) => {
                            e.preventDefault(); // Ngăn ô input bị mất focus
                            if (s.filter === 'movie' && s.slug) {
                              setIsExpanded(false);
                              setSearchQuery('');
                              router.push(`/watch/${s.slug}`);
                              return;
                            }
                            const newSegments = [...segments];
                            let completedText = '';
                            if (s.filter === 'actor') completedText = 'diễn viên: ' + s.label;
                            else if (s.filter === 'director') completedText = 'đạo diễn: ' + s.label;
                            else if (s.filter === 'genre') completedText = 'thể loại: ' + s.label;
                            else if (s.filter === 'year') completedText = 'năm: ' + s.label;
                            
                            newSegments[newSegments.length - 1] = ' ' + completedText;
                            setSearchQuery(newSegments.join(',').trimStart() + ', ');
                            setTimeout(() => inputRef.current?.focus(), 50);
                          }}
                          className="text-left px-3 py-2 hover:bg-white/5 transition rounded-sm text-white/80 text-xs flex items-center justify-between w-full group"
                        >
                          <div className="flex items-center gap-3 truncate">
                            <Icon className="w-4 h-4 text-white/30 group-hover:text-white transition-colors flex-shrink-0" />
                            <span className="font-light truncate">{s.label}</span>
                          </div>
                          <span className={`text-[8px] uppercase tracking-wider font-bold border px-2 py-0.5 rounded-sm min-w-[75px] text-center ${badgeStyle}`}>{s.type}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Phải: Search icon + Sign In / Avatar — LUÔN cố định */}
        <div className="flex items-center gap-5 flex-shrink-0">
          {/* Search icon ↔ X toggle nhau tại cùng vị trí */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-white/60 hover:text-white transition-all duration-300"
          >
            {isExpanded
              ? <X className="w-5 h-5" />
              : <Search className="w-5 h-5" />
            }
          </button>

          {user ? (
            <div className="relative group cursor-pointer py-2">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
                  <UserIcon className="w-4 h-4 text-white/60" />
                </div>
              )}
              <div className="hidden group-hover:flex absolute top-full right-0 mt-2 bg-[#131313] border border-white/10 rounded-sm p-2 flex-col gap-2 shadow-2xl min-w-[150px] before:absolute before:content-[''] before:-top-2 before:left-0 before:right-0 before:h-2">
                <div className="px-3 py-2 text-white text-xs border-b border-white/10">{user.displayName}</div>
                <button onClick={onLogoutClick} className="flex items-center gap-2 px-3 py-2 text-white/60 hover:text-white hover:bg-white/5 transition text-xs text-left w-full rounded-sm">
                  <LogOut className="w-4 h-4" /> Đăng xuất
                </button>
              </div>
            </div>
          ) : (
            <button onClick={onLoginClick} className="text-white/60 hover:text-white transition text-xs font-semibold uppercase tracking-widest bg-white/5 px-4 py-2 rounded-sm border border-white/10 hover:bg-white/10">Sign In</button>
          )}
        </div>

      </div>

      {showFiltersPanel && (
        <div 
          ref={panelRef}
          className="absolute top-24 left-0 right-0 bg-[#0c0c0e]/95 backdrop-blur-3xl border-b border-white/5 py-8 px-8 md:px-16 shadow-[0_25px_60px_rgba(0,0,0,0.85)] z-40 animate-fade-in"
        >
          <div className="max-w-[1600px] mx-auto grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
            
            {/* Cột 1: Năm phát hành */}
            <div className="flex flex-col gap-3">
              <span className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Năm phát hành</span>
              <div className="h-[1px] bg-white/5 w-full" />
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => toggleFilter('năm')}
                  className={`text-[10px] font-light px-2.5 py-0.5 rounded transition-all duration-150 border ${
                    !activeYear 
                      ? 'bg-white text-black font-semibold border-white' 
                      : 'bg-white/5 text-white/50 hover:text-white border-white/5 hover:border-white/10'
                  }`}
                >
                  Tất cả
                </button>
                {displayedYears.map((y) => {
                  const isActive = activeYear === y;
                  return (
                    <button
                      key={y}
                      onClick={() => toggleFilter('năm', y)}
                      className={`text-[10px] font-light px-2.5 py-0.5 rounded transition-all duration-150 border ${
                        isActive 
                          ? 'bg-white text-black font-semibold border-white' 
                          : 'bg-white/5 text-white/50 hover:text-white border-white/5 hover:border-white/10'
                      }`}
                    >
                      {y}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cột 2: Độ tuổi */}
            <div className="flex flex-col gap-3">
              <span className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Độ tuổi</span>
              <div className="h-[1px] bg-white/5 w-full" />
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => toggleFilter('độ tuổi')}
                  className={`text-[10px] font-light px-2.5 py-0.5 rounded transition-all duration-150 border ${
                    !activeAge 
                      ? 'bg-white text-black font-semibold border-white' 
                      : 'bg-white/5 text-white/50 hover:text-white border-white/5 hover:border-white/10'
                  }`}
                >
                  Tất cả
                </button>
                {displayedAges.map((a) => {
                  const isActive = activeAge?.toLowerCase() === a.code.toLowerCase();
                  return (
                    <button
                      key={a.code}
                      onClick={() => toggleFilter('độ tuổi', a.code)}
                      className={`text-[10px] font-light px-2.5 py-0.5 rounded transition-all duration-150 border ${
                        isActive 
                          ? 'bg-white text-black font-semibold border-white' 
                          : 'bg-white/5 text-white/50 hover:text-white border-white/5 hover:border-white/10'
                      }`}
                      title={a.desc}
                    >
                      {a.code}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cột 3: Thể loại */}
            <div className="flex flex-col gap-3">
              <span className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Thể loại</span>
              <div className="h-[1px] bg-white/5 w-full" />
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => toggleFilter('thể loại')}
                  className={`text-[10px] font-light px-2.5 py-0.5 rounded transition-all duration-150 border ${
                    activeGenres.length === 0 
                      ? 'bg-white text-black font-semibold border-white' 
                      : 'bg-white/5 text-white/50 hover:text-white border-white/5 hover:border-white/10'
                  }`}
                >
                  Tất cả
                </button>
                {displayedGenres.map((g) => {
                  const isActive = activeGenres.includes(g.toLowerCase());
                  return (
                    <button
                      key={g}
                      onClick={() => toggleFilter('thể loại', g)}
                      className={`text-[10px] font-light px-2.5 py-0.5 rounded transition-all duration-150 border ${
                        isActive 
                          ? 'bg-white text-black font-semibold border-white' 
                          : 'bg-white/5 text-white/50 hover:text-white border-white/5 hover:border-white/10'
                      }`}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Cột 4: Phân loại */}
            <div className="flex flex-col gap-3">
              <span className="text-[9px] uppercase tracking-widest font-semibold text-white/30">Phân loại</span>
              <div className="h-[1px] bg-white/5 w-full" />
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => toggleFilter('phân loại')}
                  className={`text-[10px] font-light px-2.5 py-0.5 rounded transition-all duration-150 border ${
                    !activeType 
                      ? 'bg-white text-black font-semibold border-white' 
                      : 'bg-white/5 text-white/50 hover:text-white border-white/5 hover:border-white/10'
                  }`}
                >
                  Tất cả
                </button>
                {[
                  { label: 'Thương mại', query: 'blockbuster' },
                  { label: 'Độc lập', query: 'indie' }
                ].map((t) => {
                  const isActive = activeType?.toLowerCase() === t.query.toLowerCase();
                  return (
                    <button
                      key={t.query}
                      onClick={() => toggleFilter('phân loại', t.query)}
                      className={`text-[10px] font-light px-2.5 py-0.5 rounded transition-all duration-150 border ${
                        isActive 
                          ? 'bg-white text-black font-semibold border-white' 
                          : 'bg-white/5 text-white/50 hover:text-white border-white/5 hover:border-white/10'
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action buttons bar */}
            <div className="flex gap-4 justify-end w-full border-t border-white/5 pt-6 mt-4">
              <button
                type="button"
                onClick={() => {
                  setTempSearchQuery('');
                }}
                className="text-[10px] uppercase tracking-widest font-semibold px-5 py-2.5 rounded-sm bg-white/5 hover:bg-white/10 text-white/60 hover:text-white border border-white/5 transition-all duration-200"
              >
                Đặt lại
              </button>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery(tempSearchQuery);
                  onSearchSubmit(tempSearchQuery);
                  setShowFiltersPanel(false);
                }}
                className="text-[10px] uppercase tracking-widest font-bold px-8 py-2.5 rounded-sm bg-white hover:bg-white/80 text-black shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all duration-200 hover:scale-[1.02]"
              >
                Áp dụng bộ lọc
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
});
Navbar.displayName = 'Navbar';
