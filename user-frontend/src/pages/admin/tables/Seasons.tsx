import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AddModal, Field, inp, sel, tex } from '../components/SharedUI';
import { API_BASE } from '../config';
import { AutocompleteInput, ACOption } from '../autocomplete';

export interface SeasonRow {
  id?: string | number;
  Id?: string | number;
  seasonId?: string | number;
  titleId?: string | number;
  movieId?: string | number;
  seasonNumber?: number;
  name?: string;
  releaseYear?: number;
  plotSynopsis?: string;
  posterUrl?: string;
  createdAt?: string;
  [key: string]: any;
}

export interface MovieRow {
  id?: number | string;
  Id?: number | string;
  title?: string;
  Title?: string;
  type?: string; // Series / SingleMovie
  [key: string]: any;
}

function highlightText(text: string, keyword: string) {
  if (!keyword.trim()) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-white text-black rounded-[2px] px-[1.5px] font-bold">{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </span>
  );
}

export default function SeasonsTable() {
  const [data, setData] = useState<SeasonRow[]>([]);
  const [movies, setMovies] = useState<MovieRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiMissing, setApiMissing] = useState(false);
  const [filterMovieId, setFilterMovieId] = useState<string>('ALL');
  const [isAdding, setIsAdding] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<ACOption[]>([]);

  // Searchable Dropdown State cho bộ lọc Season
  const [isFilterDropdownOpen, setIsFilterDropdownOpen] = useState(false);
  const [filterSearchQuery, setFilterSearchQuery] = useState('');
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Đóng dropdown khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Form State
  const [formData, setFormData] = useState({
    movieId: '',
    seasonNumber: 1,
    name: '',
    releaseYear: new Date().getFullYear(),
    plotSynopsis: '',
    posterUrl: '',
    status: 1
  });

  const handleLocalImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 300; // Kích thước poster tối ưu cực kỳ sắc nét và siêu nhẹ (~15KB)
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setFormData(prev => ({ ...prev, posterUrl: compressedBase64 }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Tải danh sách Phim làm Dictionary Lookup
  const loadMovies = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/Movies/search?limit=1000`);
      if (res.ok) {
        const list = await res.json();
        setMovies(list);
        // Thiết lập giá trị mặc định cho form nếu danh sách có phim
        if (list.length > 0) {
          const firstId = list[0].id || list[0].Id;
          setFormData(prev => ({ ...prev, movieId: String(firstId) }));
        }
      }
    } catch (e) {
      console.error('Lỗi khi nạp từ điển Movies:', e);
    }
  }, []);

  // Tải dữ liệu Mùa phim trực tiếp từ CSDL
  const loadSeasons = useCallback(async () => {
    setLoading(true);
    setApiMissing(false);
    try {
      const res = await fetch(`${API_BASE}/admin/system/tables/Seasons`);
      if (res.status === 404) {
        // Model Season chưa được đăng ký vào AppDbContext ở backend
        setApiMissing(true);
        setData([]);
        return;
      }
      if (res.ok) {
        const rawList: SeasonRow[] = await res.json();
        // Sắp xếp mặc định theo số thứ tự mùa
        rawList.sort((a, b) => (a.seasonNumber || 0) - (b.seasonNumber || 0));
        setData(rawList);
      }
    } catch (err) {
      console.error('Lỗi nạp bảng Seasons:', err);
      // Nếu lỗi kết nối, hiển thị bảng rỗng
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMovies();
    loadSeasons();
  }, [loadMovies, loadSeasons]);

  // Trích xuất ID duy nhất của dòng
  const getRowId = (item: SeasonRow) => {
    return String(item.id || item.Id || item.seasonId || '');
  };

  // Lấy ID Phim gốc từ dòng (Hỗ trợ linh hoạt cả 2 trường hợp titleId hoặc movieId)
  const getMasterId = (item: SeasonRow) => {
    return String(item.titleId || item.movieId || '');
  };

  // Tra cứu Tên phim chuẩn UX thông qua Lookup Dictionary
  const getMovieTitle = (item: SeasonRow) => {
    const targetId = getMasterId(item);
    const m = movies.find(x => String(x.id || x.Id) === targetId);
    return m ? (m.title || m.Title || 'Không tên') : 'Không xác định';
  };

  const handleDelete = async (item: SeasonRow) => {
    const rowId = getRowId(item);
    if (!rowId) return;
    if (!confirm('⚠️ Bạn có chắc chắn muốn xóa bản ghi Mùa phim này khỏi CSDL?')) return;

    try {
      const res = await fetch(`${API_BASE}/admin/system/tables/Seasons/${encodeURIComponent(rowId)}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadSeasons();
      } else {
        alert('Không thể xóa bản ghi: API trả về lỗi.');
      }
    } catch (e) {
      alert('Lỗi kết nối khi xóa bản ghi.');
    }
  };

  const handleCreate = async () => {
    if (!formData.movieId) {
      alert('Vui lòng chọn Phim gốc!');
      return;
    }

    // Payload gửi lên API hỗ trợ gửi song song cả 2 key để phòng thủ
    // Backend EF Core tự động bắt key tương ứng với cấu trúc class Model
    const payload = {
      titleId: formData.movieId,
      movieId: formData.movieId, // Nếu C# dùng public int MovieId
      seasonNumber: formData.seasonNumber,
      name: formData.name || `Season ${formData.seasonNumber}`,
      releaseYear: formData.releaseYear,
      plotSynopsis: formData.plotSynopsis,
      posterUrl: formData.posterUrl,
      status: formData.status
    };

    // Nếu ID là dạng chuỗi hay số, thử parse sang int cho MovieId nếu cần
    // Tự động tương thích với bộ Serializer của C#
    if (!isNaN(Number(formData.movieId))) {
      (payload as any).movieId = Number(formData.movieId);
      (payload as any).titleId = Number(formData.movieId);
    }

    try {
      const res = await fetch(`${API_BASE}/admin/system/tables/Seasons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setIsAdding(false);
        setSelectedMovie([]);
        // Reset form và tăng số tập
        setFormData(prev => ({
          ...prev,
          seasonNumber: prev.seasonNumber + 1,
          name: '',
          plotSynopsis: '',
          posterUrl: '',
          status: 1
        }));
        loadSeasons();
      } else {
        const text = await res.text();
        alert(`Không thể tạo Mùa phim: ${text}`);
      }
    } catch (e) {
      alert('Lỗi kết nối tới Server.');
    }
  };

  // Lọc dữ liệu hiển thị
  const filteredData = data.filter(item => {
    if (filterMovieId === 'ALL') return true;
    return getMasterId(item) === filterMovieId;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="space-y-3">
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none flex items-center gap-3">
            📁 Quản lý Mùa Phim
            <span className="text-primary text-[10px] px-2 py-1 bg-primary/10 border border-primary/30 rounded font-mono align-middle">
              LIVE DB
            </span>
          </h2>
          <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em]">
            Kết nối trực tiếp CSDL thật (Database Realtime API)
          </p>
        </div>

        {!apiMissing && (
          <button 
            onClick={() => setIsAdding(true)} 
            className="h-11 px-8 bg-white text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all rounded-sm flex items-center gap-2 self-start lg:self-auto shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            <span className="material-symbols-outlined text-sm font-bold">add</span>
            Thêm Mùa Phim
          </button>
        )}
      </div>

      {/* BẪY LỖI 404 - HƯỚNG DẪN TẠO MODEL C# */}
      {apiMissing && (
        <div className="border border-amber-500/30 bg-amber-500/5 p-6 rounded-sm space-y-4">
          <div className="flex items-center gap-3 text-amber-400">
            <span className="material-symbols-outlined text-2xl animate-pulse">warning</span>
            <h3 className="text-sm font-black uppercase tracking-widest">
              Bảng `Seasons` chưa được khởi tạo trên Backend
            </h3>
          </div>
          <p className="text-xs text-neutral-300 leading-relaxed">
            Hệ thống phát hiện API <code className="text-amber-300 bg-black px-1.5 py-0.5 rounded font-mono">GET /admin/system/tables/Seasons</code> trả về mã lỗi <strong>404 Not Found</strong>. Điều này có nghĩa là lớp Model <strong>Season</strong> chưa được định nghĩa hoặc đăng ký vào <code className="text-neutral-400 font-mono">AppDbContext</code> ở C#.
          </p>
          <div className="bg-black/60 border border-neutral-800 p-4 rounded text-xs space-y-2 font-mono text-neutral-400">
            <div className="text-[10px] text-primary uppercase font-bold tracking-widest">💡 Hướng dẫn bổ sung ở Backend (Để hệ thống tự động ăn khớp):</div>
            <div>1. Tạo file <span className="text-white">backend/Models/Season.cs</span> với cấu trúc class Season chứa các trường: Id, TitleId (hoặc MovieId), SeasonNumber, ReleaseYear.</div>
            <div>2. Mở file <span className="text-white">backend/Models/AppDbContext.cs</span> và thêm dòng:</div>
            <div className="text-green-400 pl-4">public DbSet&lt;Season&gt; Seasons &#123; get; set; &#125;</div>
            <div>3. Khởi động lại backend, hệ thống Reflection sẽ tự động cung cấp đầy đủ API REST CRUD mà không cần viết thêm Controller!</div>
          </div>
          <div className="pt-2">
            <button 
              onClick={loadSeasons} 
              className="h-9 px-6 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-amber-400 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">refresh</span>
              Tải lại trạng thái kết nối
            </button>
          </div>
        </div>
      )}

      {/* BỘ LỌC KẾT HỢP DICTIONARY LOOKUP */}
      {!apiMissing && (
        <div className="bg-[#0A0A0A] border border-neutral-900 p-6 rounded-sm space-y-3">
          <label className="block text-[9px] font-black text-neutral-500 uppercase tracking-[0.3em]">
            🎯 Bộ lọc: Tra cứu ngầm (Searchable Dictionary Lookup)
          </label>
          <div className="max-w-md relative" ref={filterDropdownRef}>
            {/* Dropdown Trigger Button */}
            <button
              type="button"
              onClick={() => {
                setIsFilterDropdownOpen(!isFilterDropdownOpen);
                setFilterSearchQuery(''); // Reset tìm kiếm mỗi lần mở
              }}
              className="w-full bg-black border border-neutral-800 h-11 px-4 text-xs font-bold text-white focus:border-white hover:border-neutral-700 outline-none transition-all rounded-sm flex items-center justify-between shadow-inner"
            >
              <span className="truncate flex items-center gap-2">
                {filterMovieId === 'ALL' ? (
                  <span className="text-yellow-400 font-bold flex items-center gap-2">Tất cả các Phim trực tiếp</span>
                ) : (() => {
                  const sel = movies.find(m => String(m.id || m.Id) === filterMovieId);
                  if (!sel) return <span className="text-white">Không rõ phim</span>;
                  const poster = sel.posterUrl || sel.PosterUrl;
                  return (
                    <span className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-neutral-800 overflow-hidden flex items-center justify-center border border-neutral-700/30 flex-shrink-0">
                        {poster ? (
                          <img src={poster} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                        ) : (
                          <span className="material-symbols-outlined text-[12px] text-neutral-500">movie</span>
                        )}
                      </div>
                      <span className="text-white text-xs font-bold truncate">{sel.title || sel.Title || 'Không tên'}</span>
                    </span>
                  );
                })()}
              </span>
              <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${isFilterDropdownOpen ? 'rotate-180' : ''}`}>
                keyboard_arrow_down
              </span>
            </button>

            {/* Floating Dropdown Panel */}
            {isFilterDropdownOpen && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-neutral-950 border border-neutral-800 rounded-sm shadow-[0_15px_50px_rgba(0,0,0,0.9)] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                {/* Search Bar inside Panel */}
                <div className="p-2 border-b border-neutral-900 bg-neutral-900/40 flex items-center gap-2">
                  <span className="material-symbols-outlined text-neutral-500 text-[16px] pl-2">search</span>
                  <input
                    type="text"
                    placeholder="Tìm tên phim nhanh..."
                    value={filterSearchQuery}
                    onChange={e => setFilterSearchQuery(e.target.value)}
                    className="w-full bg-transparent text-xs text-white placeholder-neutral-600 outline-none py-1.5"
                    autoFocus
                  />
                  {filterSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setFilterSearchQuery('')}
                      className="text-neutral-500 hover:text-white transition-colors text-xs px-2"
                    >
                      ×
                    </button>
                  )}
                </div>

                {/* Scrollable Results List */}
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  {/* Select All option */}
                  <button
                    type="button"
                    onClick={() => {
                      setFilterMovieId('ALL');
                      setIsFilterDropdownOpen(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-xs transition-colors flex items-center justify-between ${filterMovieId === 'ALL' ? 'bg-neutral-900 text-white font-black' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`}
                  >
                    <span className="flex items-center gap-2">Tất cả các Phim</span>
                    {filterMovieId === 'ALL' && <span className="material-symbols-outlined text-[14px] text-yellow-400">check</span>}
                  </button>

                  <div className="h-px bg-neutral-900" />

                  {/* List of matching movies */}
                  {movies.filter(m => 
                    (m.title || m.Title || '').toLowerCase().includes(filterSearchQuery.toLowerCase())
                  ).length === 0 ? (
                    <div className="px-4 py-8 text-center text-[10px] text-neutral-600 uppercase tracking-widest font-black">
                      Không tìm thấy phim phù hợp
                    </div>
                  ) : (
                    movies.filter(m => 
                      (m.title || m.Title || '').toLowerCase().includes(filterSearchQuery.toLowerCase())
                    ).map(m => {
                      const mid = String(m.id || m.Id);
                      const isSelected = filterMovieId === mid;
                      const title = m.title || m.Title || 'Không tên';
                      const poster = m.posterUrl || m.PosterUrl;
                      const year = m.releaseYear || m.ReleaseYear || '2026';
                      const isSeries = String(m.type || m.Type || '') === '2' || String(m.type || m.Type || '').toLowerCase() === 'tvseries' || m.movieType === 'TvSeries';
                      const typeText = isSeries ? 'Phim bộ' : 'Phim lẻ';

                      return (
                        <button
                          key={mid}
                          type="button"
                          onClick={() => {
                            setFilterMovieId(mid);
                            setIsFilterDropdownOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3 text-xs transition-colors flex items-center gap-3 ${isSelected ? 'bg-neutral-900 text-white font-black' : 'text-neutral-400 hover:bg-neutral-900/50 hover:text-white'}`}
                        >
                          {/* Circular Poster Avatar */}
                          <div className="w-8 h-8 rounded-full bg-neutral-800 flex-shrink-0 overflow-hidden flex items-center justify-center border border-neutral-700/30">
                            {poster ? (
                              <img src={poster} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                            ) : (
                              <span className="material-symbols-outlined text-[14px] text-neutral-500">movie</span>
                            )}
                          </div>

                          {/* Info Column */}
                          <div className="flex-1 min-w-0">
                            <div className="text-[13px] font-semibold text-white truncate">
                              {highlightText(title, filterSearchQuery)}
                            </div>
                            <div className="text-[11px] text-neutral-500 truncate mt-0.5">
                              {year} • {typeText}
                            </div>
                          </div>

                          {/* Check Icon */}
                          {isSelected && <span className="material-symbols-outlined text-[16px] text-primary flex-shrink-0">check_circle</span>}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="text-[10px] text-neutral-600 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px] text-primary">info</span>
            Hiển thị chuẩn UX: Tự động trích xuất Tên phim tương ứng từ {movies.length} tác phẩm nạp về.
          </div>
        </div>
      )}

      {/* BẢNG DỮ LIỆU */}
      {!apiMissing && (
        loading ? (
          <div className="py-20 text-center text-neutral-500 font-black uppercase tracking-[0.4em] animate-pulse">
            Đang truy xuất dữ liệu thực tế từ Database...
          </div>
        ) : filteredData.length === 0 ? (
          <div className="py-24 border border-dashed border-neutral-800 rounded-sm bg-neutral-900/20 text-center space-y-4">
            <div className="text-[10px] text-neutral-600 font-black uppercase tracking-[0.4em]">
              Bảng `Seasons` hiện đang trống hoặc không có dữ liệu khớp bộ lọc
            </div>
            <button 
              onClick={() => setIsAdding(true)} 
              className="text-[9px] font-black uppercase tracking-widest text-white hover:underline"
            >
              Bấm vào đây để tạo bản ghi Mùa đầu tiên vào CSDL
            </button>
          </div>
        ) : (
          <div className="bg-[#141414] border border-[#2A2A2A] rounded-sm overflow-hidden shadow-2xl">
            <div className="overflow-x-auto hide-scrollbar">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-[#1A1A1A] border-b border-[#2A2A2A]">
                  <tr>
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em] w-28">Mã PK (Row ID)</th>
                    <th className="px-6 py-4 text-[9px] font-black text-primary uppercase tracking-[0.3em]">Tác phẩm gốc (Lookup UX)</th>
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em] text-center w-20">Thứ tự</th>
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em]">Tên Mùa</th>
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em] text-center w-24">Năm PH</th>
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em]">Tóm tắt nội dung</th>
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em] text-center w-20">Poster</th>
                    <th className="px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em] text-right w-20">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2A2A2A]">
                  {filteredData.map((item, idx) => {
                    const rowId = getRowId(item);
                    const masterId = getMasterId(item);
                    const movieTitle = getMovieTitle(item);

                    return (
                      <tr key={rowId || idx} className="hover:bg-white/[0.02] transition-colors group">
                        {/* PK */}
                        <td className="px-6 py-4 font-mono text-xs text-neutral-500 font-bold">
                          {rowId.length > 10 ? `${rowId.substring(0, 8)}...` : rowId}
                        </td>

                        {/* Tác phẩm gốc - Lookup Dictionary */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-white px-2 py-0.5 bg-neutral-800 rounded border border-neutral-700">
                              {movieTitle}
                            </span>
                            <span className="text-[9px] text-neutral-600 font-mono">(FK: {masterId})</span>
                          </div>
                        </td>

                        {/* Thứ tự */}
                        <td className="px-6 py-4 text-center font-bold text-xs text-neutral-300">
                          {item.seasonNumber ?? '-'}
                        </td>

                        {/* Tên Mùa */}
                        <td className="px-6 py-4 text-xs font-semibold text-neutral-200">
                          {item.name || `Season ${item.seasonNumber ?? ''}`}
                        </td>

                        {/* Năm PH */}
                        <td className="px-6 py-4 text-center text-xs text-neutral-400 font-mono">
                          {item.releaseYear ?? '-'}
                        </td>

                        {/* Tóm tắt */}
                        <td className="px-6 py-4">
                          <p className="text-xs text-neutral-400 line-clamp-2 max-w-md italic">
                            {item.plotSynopsis || '- Trống -'}
                          </p>
                        </td>

                        {/* Poster */}
                        <td className="px-6 py-4 text-center">
                          {item.posterUrl ? (
                            <img 
                              src={item.posterUrl} 
                              alt="" 
                              className="w-9 h-12 object-cover rounded mx-auto border border-neutral-800"
                              onError={e => (e.currentTarget.style.display = 'none')}
                            />
                          ) : (
                            <span className="text-[10px] text-neutral-700">-</span>
                          )}
                        </td>

                        {/* Thao tác */}
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDelete(item)} 
                            title="Xóa Mùa phim khỏi CSDL"
                            className="p-1.5 hover:bg-red-500/10 rounded text-neutral-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <span className="material-symbols-outlined !text-[18px]">delete</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}

      {/* FULLSCREEN FORM OVERLAY */}
      {isAdding && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl overflow-y-auto pt-10 pb-20 custom-scrollbar animate-in fade-in duration-300 text-left">
          <div className="max-w-[1200px] mx-auto px-6">
            
            {/* HEADER */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-12 border-b border-neutral-900 pb-6">
              <div>
                <h2 className="text-3xl font-black text-white tracking-tighter uppercase leading-none">New Season</h2>
                <p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em] mt-3">
                  Khởi tạo mùa phim mới trực tiếp vào CSDL hệ thống TviEn
                </p>
              </div>
              <div className="flex gap-4">
                <button 
                  onClick={() => setIsAdding(false)} 
                  className="h-11 px-8 bg-neutral-900 text-neutral-500 text-[10px] font-black uppercase tracking-widest border border-neutral-800 hover:text-white hover:border-neutral-700 transition-all rounded-sm"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreate} 
                  className="h-11 px-10 bg-white text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all rounded-sm shadow-[0_0_30px_rgba(255,255,255,0.15)]"
                >
                  Save Season
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              {/* MAIN COLUMN (LEFT) - 8 Cols */}
              <div className="lg:col-span-8 space-y-10">
                
                {/* ZONE 1: CORE METADATA */}
                <div className="bg-[#0A0A0A] border border-neutral-900 p-10 rounded-sm space-y-8 shadow-2xl">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-[11px] font-black text-neutral-600 tracking-[0.4em] uppercase">1. Core Metadata</span>
                    <div className="h-px flex-1 bg-neutral-900"></div>
                  </div>

                  <AutocompleteInput 
                    label="Chọn Phim gốc trực tiếp từ CSDL *" 
                    placeholder="Gõ tên phim..."
                    searchUrl={kw => `${API_BASE}/admin/Movies/search?keyword=${encodeURIComponent(kw)}&type=TvSeries`}
                    mapResult={m => ({ id: m.movieId || m.id, label: m.title || m.Title || 'Không tên', avatar: m.posterUrl, sub: m.releaseYear })}
                    selected={selectedMovie}
                    onChange={(moviesSelected) => {
                      setSelectedMovie(moviesSelected);
                      if (moviesSelected.length > 0) {
                        setFormData(prev => ({ ...prev, movieId: String(moviesSelected[0].id) }));
                      } else {
                        setFormData(prev => ({ ...prev, movieId: '' }));
                      }
                    }}
                    multiple={false}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <Field label="Thứ tự Mùa (Season #) *">
                      <input 
                        type="number" 
                        min="1"
                        value={formData.seasonNumber} 
                        onChange={e => setFormData({ ...formData, seasonNumber: parseInt(e.target.value) || 1 })}
                        className={inp} 
                      />
                    </Field>

                    <Field label="Năm phát hành *">
                      <input 
                        type="number" 
                        value={formData.releaseYear} 
                        onChange={e => setFormData({ ...formData, releaseYear: parseInt(e.target.value) || new Date().getFullYear() })}
                        className={inp} 
                      />
                    </Field>
                  </div>

                  <Field label="Tên riêng của mùa (Tùy chọn)">
                    <input 
                      placeholder="VD: Phần 3: Huyết Chiến (Để trống tự động gán Season #)"
                      value={formData.name} 
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      className={inp} 
                    />
                  </Field>
                </div>

                {/* ZONE 2: CONTENT & SUMMARY */}
                <div className="bg-[#0A0A0A] border border-neutral-900 p-10 rounded-sm space-y-8 shadow-2xl">
                  <div className="flex items-center gap-4 mb-2">
                    <span className="text-[11px] font-black text-neutral-600 tracking-[0.4em] uppercase">2. Plot & Summary</span>
                    <div className="h-px flex-1 bg-neutral-900"></div>
                  </div>

                  <Field label="Tóm tắt nội dung Mùa phim">
                    <textarea 
                      placeholder="Nhập tóm tắt bối cảnh riêng cho mùa này..."
                      value={formData.plotSynopsis} 
                      onChange={e => setFormData({ ...formData, plotSynopsis: e.target.value })}
                      className={`${tex} min-h-[250px]`} 
                    />
                  </Field>
                </div>
              </div>

              {/* SIDE COLUMN (RIGHT) - 4 Cols */}
              <div className="lg:col-span-4 space-y-10">
                
                {/* POSTER PREVIEW (2:3) */}
                <div className="bg-[#0A0A0A] border border-neutral-900 p-8 rounded-sm space-y-8 shadow-2xl">
                  <label className="text-[11px] font-black text-neutral-600 uppercase tracking-widest block border-b border-neutral-900 pb-3">Poster (2:3)</label>
                  
                  <div className="relative aspect-[2/3] bg-black border border-neutral-800 rounded-sm overflow-hidden flex items-center justify-center group shadow-inner">
                    {formData.posterUrl ? (
                      <>
                        <img 
                          src={formData.posterUrl} 
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                          onError={e => { e.currentTarget.src = 'https://placehold.co/400x600/101010/555555?text=Error'; }}
                        />
                        {formData.posterUrl.startsWith('data:') && (
                          <span className="absolute bottom-3 right-3 bg-green-500 text-[9px] text-black font-black px-2 py-0.5 rounded-sm uppercase tracking-wider">
                            Local
                          </span>
                        )}
                      </>
                    ) : (
                      <div className="text-center space-y-3">
                        <span className="material-symbols-outlined text-neutral-800 text-7xl">image</span>
                        <div className="text-[10px] text-neutral-600 font-black uppercase tracking-widest">No Poster Selected</div>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/80 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center gap-3 p-4 text-center">
                      <label className="cursor-pointer bg-white text-black px-6 py-3 text-[11px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl rounded-sm">
                        Tải ảnh lên
                        <input type="file" className="hidden" accept="image/*" onChange={handleLocalImageUpload} />
                      </label>
                      <div className="text-[9px] text-neutral-500 uppercase font-black">Hoặc dán URL ở ô dưới đây</div>
                    </div>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-neutral-900">
                    <label className="block text-[10px] font-black text-neutral-500 uppercase tracking-widest">Đường dẫn Poster (URL)</label>
                    <input 
                      placeholder="Dán liên kết ảnh từ bên ngoài..."
                      value={formData.posterUrl} 
                      onChange={e => setFormData({ ...formData, posterUrl: e.target.value })}
                      className={inp} 
                    />
                  </div>
                </div>

                {/* PUBLISHING STATUS */}
                <div className="bg-[#0D0D0D] border border-neutral-900 p-8 rounded-sm space-y-6 shadow-2xl">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-neutral-500 uppercase tracking-widest">Publish Status</span>
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, status: formData.status === 1 ? 0 : 1 })} 
                      className={`w-14 h-7 rounded-full transition-all relative flex items-center ${formData.status === 1 ? 'bg-green-500' : 'bg-neutral-800'}`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white transition-all absolute shadow-sm ${formData.status === 1 ? 'left-8' : 'left-1'}`}></div>
                    </button>
                  </div>
                  <div className="text-[9px] text-neutral-600 italic leading-relaxed font-bold border-t border-neutral-900 pt-4">
                    Kích hoạt để người dùng xem được Mùa phim bộ này trên trang chủ.
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
