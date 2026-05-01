import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, CloudUpload, FileVideo, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

import { API_BASE, CDN_BASE } from '../../config';

interface MediaAssetFormProps {
  onClose: () => void;
  onSaved: () => void;
}

export function AddMediaAssetForm({ onClose, onSaved }: MediaAssetFormProps) {
  // --- STATE DỮ LIỆU ---
  const [movies, setMovies] = useState<any[]>([]);
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [selectedEpisode, setSelectedEpisode] = useState<string>("");
  const [assetType, setAssetType] = useState("MainVideo");
  const [searchQuery, setSearchQuery] = useState("");
  const [showMovieResults, setShowMovieResults] = useState(false);

  // --- STATE FILE & UPLOAD ---
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState("");
  const [eta, setEta] = useState("");
  const [uploadComplete, setUploadComplete] = useState(false);

  // --- STATE CẤU HÌNH INGEST (SIDEBAR) ---
  const [autoIngest, setAutoIngest] = useState(true);
  const [useDRM, setUseDRM] = useState(true);
  const [resolutions, setResolutions] = useState({ "1080p": true, "720p": true, "480p": false });

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch(`${API_BASE}/admin/system/tables/Movies`)
      .then(res => res.json())
      .then(data => setMovies(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedMovie && selectedMovie.movieType === 'series') {
      fetch(`${API_BASE}/admin/system/tables/Episodes`)
        .then(res => res.json())
        .then(data => {
            const filtered = data.filter((ep: any) => ep.movieId === selectedMovie.id);
            setEpisodes(filtered);
        })
        .catch(() => {});
    } else {
      setEpisodes([]);
      setSelectedEpisode("");
    }
  }, [selectedMovie]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleStartUpload = () => {
    if (!file || !selectedMovie) return;

    setUploading(true);
    setProgress(0);
    const startTime = Date.now();

    const formData = new FormData();
    formData.append('file', file);
    formData.append('movieId', String(selectedMovie.id ?? ''));
    if (selectedEpisode) formData.append('episodeId', selectedEpisode);
    formData.append('assetType', assetType);
    formData.append('autoIngest', String(autoIngest));
    
    const resList = Object.entries(resolutions)
      .filter(([_, val]) => val)
      .map(([key, _]) => key)
      .join(',');
    formData.append('resolutions', resList);

    // DÙNG XMLHttpRequest THAY CHO AXIOS ĐỂ THEO DÕI TIẾN TRÌNH KHÔNG CẦN THƯ VIỆN
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/admin/media-assets/upload`, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded * 100) / event.total);
        setProgress(percent);
        
        const timeElapsed = (Date.now() - startTime) / 1000;
        const speed = event.loaded / timeElapsed; // bytes per second
        setUploadSpeed((speed / (1024 * 1024)).toFixed(1) + " MB/s");
        
        const remainingBytes = event.total - event.loaded;
        const remainingSeconds = remainingBytes / speed;
        setEta(Math.ceil(remainingSeconds) + "s");
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        setUploadComplete(true);
        setUploading(false);
      } else {
        // Hiển thị chi tiết lỗi từ Server để debug
        const errorMsg = xhr.responseText || xhr.statusText || 'Unknown error';
        console.error('Upload error:', xhr.status, errorMsg);
        alert(`Lỗi ${xhr.status}: ${errorMsg}`);
        setUploading(false);
      }
    };

    xhr.onerror = () => {
      alert("Lỗi kết nối khi tải file lên!");
      setUploading(false);
    };

    xhr.send(formData);
  };

  const filteredMovies = movies.filter(m => m.title.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 lg:p-10 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-[#0D0D0D] w-full h-full lg:max-w-7xl lg:h-[85vh] border border-neutral-800 rounded-none lg:rounded-xl shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col overflow-hidden">
        
        {/* --- HEADER --- */}
        <header className="h-auto min-h-[80px] py-4 px-4 lg:px-8 border-b border-neutral-800 flex flex-col sm:flex-row items-center justify-between bg-neutral-900/50 gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                <CloudUpload className="text-white" size={20} />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-lg lg:text-xl font-black text-white tracking-tighter uppercase truncate">Tải lên Media</h1>
              <p className="hidden xs:block text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">Cloudflare R2 Ingest</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button onClick={onClose} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white transition-all">Hủy</button>
            {!uploadComplete ? (
               <button 
                disabled={!file || !selectedMovie || uploading}
                onClick={handleStartUpload}
                className={`h-10 lg:h-11 px-4 lg:px-8 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl flex items-center gap-2 shrink-0 ${(!file || !selectedMovie || uploading) ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-500 hover:scale-105'}`}
               >
                 {uploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                 <span className="xs:inline">Bắt đầu tải lên</span>
               </button>
            ) : (
                <button onClick={onSaved} className="h-10 lg:h-11 px-6 lg:px-8 rounded-sm bg-white text-black text-[10px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all shrink-0">Hoàn tất</button>
            )}
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* --- TRỤC CHÍNH (70%) --- */}
          <main className="flex-[0.7] p-8 lg:p-12 overflow-y-auto border-r border-neutral-800 hide-scrollbar space-y-10">
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-4 w-1 bg-white"></div>
                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Block 01: Gắn kết dữ liệu (Identification)</h2>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2 relative">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Chọn Phim (Movie)</label>
                        <input 
                            type="text" 
                            className="w-full bg-black border border-neutral-800 h-14 px-5 text-sm focus:border-white outline-none transition-all placeholder:text-neutral-800"
                            placeholder="Gõ để tìm phim..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setShowMovieResults(true); }}
                            onFocus={() => setShowMovieResults(true)}
                        />
                        {showMovieResults && searchQuery && (
                            <div className="absolute top-full left-0 w-full bg-neutral-900 border border-neutral-800 z-50 max-h-60 overflow-y-auto shadow-2xl rounded-b-lg">
                                {filteredMovies.map(m => (
                                    <div 
                                        key={m.id} 
                                        className="p-4 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0"
                                        onClick={() => { setSelectedMovie(m); setSearchQuery(m.title); setShowMovieResults(false); }}
                                    >
                                        <div className="text-sm font-bold text-white">{m.title}</div>
                                        <div className="text-[10px] text-neutral-500 uppercase">ID: {m.id}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Chọn Tập (Episode)</label>
                        <select 
                            disabled={!selectedMovie || selectedMovie.movieType !== 'series'}
                            className="w-full bg-black border border-neutral-800 h-14 px-5 text-sm focus:border-white outline-none transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                            value={selectedEpisode}
                            onChange={(e) => setSelectedEpisode(e.target.value)}
                        >
                            <option value="">-- Chọn tập phim --</option>
                            {episodes.map(ep => (
                                <option key={ep.episodeId} value={ep.episodeId}>Tập {ep.episodeNumber}: {ep.title}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Loại file (Asset Type)</label>
                    <select 
                        className="w-full bg-black border border-neutral-800 h-14 px-5 text-sm focus:border-white outline-none transition-all"
                        value={assetType}
                        onChange={(e) => setAssetType(e.target.value)}
                    >
                        <option value="MainVideo">Video luồng chính (Movie/Episode)</option>
                        <option value="Trailer">Trailer / Teaser</option>
                        <option value="Subtitle">Phụ đề (Subtitle)</option>
                        <option value="Poster">Ảnh Poster / Thumbnail</option>
                    </select>
                </div>
            </section>

            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-4 w-1 bg-white"></div>
                    <h2 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Block 02: Khu vực Upload (Cloud Ingest)</h2>
                </div>

                {!file ? (
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full h-72 border-2 border-dashed border-neutral-800 rounded-xl flex flex-col items-center justify-center gap-4 hover:border-neutral-500 hover:bg-white/[0.02] cursor-pointer transition-all group"
                    >
                        <div className="w-16 h-16 rounded-full bg-neutral-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                            <CloudUpload size={32} className="text-neutral-500 group-hover:text-white" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-neutral-400 group-hover:text-white">Kéo thả file Video (.mp4, .mkv) vào đây</p>
                            <p className="text-[10px] text-neutral-600 uppercase tracking-widest mt-1">Hoặc bấm để chọn từ máy tính</p>
                        </div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="video/*" onChange={handleFileSelect} />
                    </div>
                ) : (
                    <div className="w-full bg-neutral-900/30 border border-neutral-800 p-8 rounded-xl space-y-8 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                                    <FileVideo className="text-green-500" size={24} />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white truncate max-w-md">{file.name}</h3>
                                    <p className="text-[10px] text-neutral-500">{(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload</p>
                                </div>
                            </div>
                            {!uploading && !uploadComplete && (
                                <button onClick={() => setFile(null)} className="text-neutral-500 hover:text-red-500 transition-colors"><X size={20}/></button>
                            )}
                        </div>

                        {(uploading || uploadComplete) && (
                            <div className="space-y-4">
                                <div className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-white transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.5)]" 
                                        style={{ width: `${progress}%` }}
                                    ></div>
                                </div>
                                <div className="flex items-center justify-between">
                                    <div className="flex gap-6">
                                        <div className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Tiến độ: <span className="text-white ml-2">{progress}%</span></div>
                                        <div className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Tốc độ: <span className="text-white ml-2">{uploadSpeed || '--'}</span></div>
                                        <div className="text-[10px] font-black uppercase text-neutral-500 tracking-widest">Còn lại: <span className="text-white ml-2">{eta || '--'}</span></div>
                                    </div>
                                    {uploadComplete && <div className="flex items-center gap-2 text-green-500 text-[10px] font-black uppercase tracking-widest"><CheckCircle2 size={14}/> Tải lên thành công</div>}
                                </div>
                                
                                {!uploadComplete && (
                                    <div className="flex items-center gap-2 text-red-500 text-[9px] font-black uppercase tracking-widest animate-pulse">
                                        <AlertCircle size={14}/> Đang tải file lên Cloudflare R2. Vui lòng KHÔNG đóng tab hoặc làm mới trình duyệt!
                                    </div>
                                )}
                            </div>
                        )}

                        {uploadComplete && (
                            <div className="p-6 bg-green-500/5 border border-green-500/20 rounded-lg flex items-center justify-between">
                                <div className="text-[11px] font-bold text-green-400">Đã lưu file thô. Hệ thống đang tự động chuyển file sang tiến trình xử lý luồng.</div>
                                <button onClick={onSaved} className="text-[10px] font-black uppercase tracking-widest bg-green-600 text-white px-4 py-2 hover:bg-green-500 transition-all">Xem tiến trình Ingest</button>
                            </div>
                        )}
                    </div>
                )}
            </section>
          </main>

          <aside className="flex-[0.3] bg-neutral-950 p-8 space-y-10">
            <section className="space-y-6">
                <div className="flex items-center gap-3">
                    <div className="h-4 w-1 bg-neutral-600"></div>
                    <h2 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.3em]">Block 03: Xử lý hậu kỳ (Ingest)</h2>
                </div>

                <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-neutral-900/50 rounded-lg border border-white/5">
                        <div className="space-y-1">
                            <div className="text-[10px] font-black text-white uppercase tracking-widest">Tự động mã hóa HLS</div>
                            <div className="text-[9px] text-neutral-500">Cắt file thành các segment nhỏ .ts</div>
                        </div>
                        <button 
                            onClick={() => setAutoIngest(!autoIngest)}
                            className={`w-12 h-6 rounded-full relative transition-all ${autoIngest ? 'bg-green-600' : 'bg-neutral-800'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${autoIngest ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-neutral-900/50 rounded-lg border border-white/5">
                        <div className="space-y-1">
                            <div className="text-[10px] font-black text-white uppercase tracking-widest">Bảo vệ DRM (AES-128)</div>
                            <div className="text-[9px] text-neutral-500">Chống tải trộm video bằng encryption</div>
                        </div>
                        <button 
                            onClick={() => setUseDRM(!useDRM)}
                            className={`w-12 h-6 rounded-full relative transition-all ${useDRM ? 'bg-green-600' : 'bg-neutral-800'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${useDRM ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Độ phân giải đầu ra</label>
                    <div className="space-y-2">
                        {Object.entries(resolutions).map(([res, checked]) => (
                            <label key={res} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
                                <div 
                                    onClick={() => setResolutions({...resolutions, [res]: !checked})}
                                    className={`w-5 h-5 border rounded flex items-center justify-center transition-all ${checked ? 'bg-white border-white' : 'border-neutral-700 group-hover:border-neutral-500'}`}
                                >
                                    {checked && <div className="w-2.5 h-2.5 bg-black rounded-sm"></div>}
                                </div>
                                <span className={`text-xs font-bold ${checked ? 'text-white' : 'text-neutral-500'}`}>{res}</span>
                            </label>
                        ))}
                    </div>
                </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
