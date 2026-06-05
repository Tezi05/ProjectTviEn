import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, CloudUpload, FileVideo, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { API_BASE } from '../../config';
import { AutocompleteInput, ACOption } from '../../autocomplete';

interface MediaAssetFormProps {
  onClose: () => void;
  onSaved: () => void;
}

// Giai đoạn pipeline
type PipelineStage = 'idle' | 'uploading' | 'ingesting' | 'done' | 'failed';

const STAGE_LABELS: Record<PipelineStage, string> = {
  idle: '',
  uploading: 'Đang tải file lên R2...',
  ingesting: 'Worker đang xử lý & mã hóa HLS...',
  done: 'Video đã sẵn sàng để phát!',
  failed: 'Có lỗi xảy ra trong quá trình xử lý.',
};

// Tính % tổng thể từ 3 giai đoạn: upload(0-40%), ingest(40-85%), hls_ready(85-100%)
function calcOverallProgress(stage: PipelineStage, uploadPct: number): number {
  if (stage === 'idle') return 0;
  if (stage === 'uploading') return Math.round(uploadPct * 0.4); // 0 → 40%
  if (stage === 'ingesting') return 40; // chờ ingest, giữ ở 40%
  if (stage === 'done') return 100;
  if (stage === 'failed') return 0;
  return 0;
}

export function AddMediaAssetForm({ onClose, onSaved }: MediaAssetFormProps) {
  const [episodes, setEpisodes] = useState<any[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<ACOption[]>([]);
  const [selectedEpisode, setSelectedEpisode] = useState('');
  const [assetType, setAssetType] = useState('MainVideo');

  // Phát hiện Series dựa trên metadata trả về từ search API
  const isSeries = !!(selectedMovie[0] as any)?.isSeries;

  const [file, setFile] = useState<File | null>(null);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadSpeed, setUploadSpeed] = useState('');
  const [eta, setEta] = useState('');
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [ingestLog, setIngestLog] = useState('');
  const [ingestMovieId, setIngestMovieId] = useState<number | null>(null);

  const [autoIngest, setAutoIngest] = useState(true);
  const [useDRM, setUseDRM] = useState(true);
  const [resolutions, setResolutions] = useState({ '1080p': true, '720p': true, '480p': true });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Tải episodes khi chọn phim
  useEffect(() => {
    if (selectedMovie[0]) {
      fetch(`${API_BASE}/admin/system/tables/Episodes`)
        .then(r => r.json())
        .then(d => setEpisodes(d.filter((ep: any) => ep.movieId === selectedMovie[0].id)))
        .catch(() => {});
    } else {
      setEpisodes([]);
      setSelectedEpisode('');
    }
  }, [selectedMovie]);

  // Dọn dẹp interval khi unmount
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Bắt đầu poll IngestJob sau khi upload xong
  const startIngestPolling = (movieId: number) => {
    setStage('ingesting');
    setIngestMovieId(movieId);
    setUploadPct(40); // ✅ Khởi tạo về 40% để fakeTicker đếm tăng dần chính xác từ 40 -> 85%

    // fake smooth progress từ 40 → 85 trong lúc đợi
    const fakeTicker = setInterval(() => {
      setUploadPct(prev => {
        const next = prev + 1;
        if (next >= 85) { clearInterval(fakeTicker); return 85; }
        return next;
      });
    }, 2000);

    pollRef.current = setInterval(async () => {
      try {
        // Kiểm tra IngestJob
        const jobsRes = await fetch(`${API_BASE}/admin/system/tables/IngestJobs`);
        if (!jobsRes.ok) return;
        const jobs: any[] = await jobsRes.json();
        const myJob = jobs
          .filter(j => j.movieId === movieId)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

        if (myJob) {
          setIngestLog(myJob.status);
          if (myJob.status === 'failed') {
            clearInterval(fakeTicker);
            clearInterval(pollRef.current!);
            setStage('failed');
            return;
          }
          if (myJob.status === 'done') {
            // ✅ Khi Job chuyển sang 'done', Worker đã hoàn thành lưu DB + upload R2
            // Hoàn tất 100% ngay lập tức để tránh lỗi đứng im 85% đối với Episode (do Video.MovieId của tập phim bộ được set null trong DB)
            clearInterval(fakeTicker);
            clearInterval(pollRef.current!);
            setUploadPct(100);
            setStage('done');
          }
        }
      } catch { /* ignore */ }
    }, 4000); // poll mỗi 4 giây
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) setFile(e.target.files[0]);
  };

  const handleStartUpload = () => {
    if (!file || !selectedMovie[0]) return;

    setStage('uploading');
    setUploadPct(0);
    const startTime = Date.now();
    const movieId = Number(selectedMovie[0].id);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('movieId', String(movieId));
    if (selectedEpisode) formData.append('episodeId', selectedEpisode);
    formData.append('assetType', assetType);
    formData.append('autoIngest', String(autoIngest));
    const resList = Object.entries(resolutions).filter(([_, v]) => v).map(([k]) => k).join(',');
    formData.append('resolutions', resList);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/admin/media-assets/upload`, true);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const pct = Math.round((event.loaded / event.total) * 100);
        setUploadPct(pct);
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = event.loaded / elapsed;
        setUploadSpeed((speed / (1024 * 1024)).toFixed(1) + ' MB/s');
        const remaining = (event.total - event.loaded) / speed;
        setEta(Math.ceil(remaining) + 's');
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        startIngestPolling(movieId);
      } else {
        alert(`Lỗi upload ${xhr.status}: ${xhr.responseText}`);
        setStage('idle');
      }
    };

    xhr.onerror = () => { alert('Lỗi kết nối khi tải file lên!'); setStage('idle'); };
    xhr.send(formData);
  };

  const overallPct = stage === 'ingesting' || stage === 'done'
    ? (stage === 'done' ? 100 : uploadPct)
    : calcOverallProgress(stage, uploadPct);

  const isActive = stage !== 'idle';

  // Blocked khi: phim là Series và đang chọn MainVideo nhưng chưa chọn Episode
  const isUploadBlocked = isSeries && assetType === 'MainVideo' && !selectedEpisode;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 lg:p-10 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-[#0D0D0D] w-full h-full lg:max-w-7xl lg:h-[90vh] border border-neutral-800 rounded-none lg:rounded-xl shadow-[0_0_100px_rgba(0,0,0,1)] flex flex-col overflow-hidden">

        {/* HEADER */}
        <header className="h-auto min-h-[80px] py-4 px-4 lg:px-8 border-b border-neutral-800 flex flex-col sm:flex-row items-center justify-between bg-neutral-900/50 gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <CloudUpload className="text-white" size={20} />
            </div>
            <div>
              <h1 className="text-lg lg:text-xl font-black text-white tracking-tighter uppercase truncate">Tải lên Media</h1>
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mt-0.5">Cloudflare R2 Ingest Pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button onClick={onClose} className="px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-neutral-400 hover:text-white transition-all">Hủy</button>
            {stage !== 'done' ? (
              <button
                disabled={!file || !selectedMovie[0] || isActive || isUploadBlocked}
                onClick={handleStartUpload}
                className={`h-10 lg:h-11 px-4 lg:px-8 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl flex items-center gap-2 shrink-0 ${(!file || !selectedMovie[0] || isActive || isUploadBlocked) ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-500 hover:scale-105'}`}
              >
                {isActive ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                <span>{isActive ? 'Đang xử lý...' : 'Bắt đầu tải lên'}</span>
              </button>
            ) : (
              <button onClick={onSaved} className="h-10 lg:h-11 px-6 lg:px-8 rounded-sm bg-white text-black text-[10px] font-black uppercase tracking-widest shadow-2xl hover:scale-105 transition-all shrink-0">
                Hoàn tất ✓
              </button>
            )}
          </div>
        </header>

        {/* THANH TIẾN TRÌNH 3 GIAI ĐOẠN TOÀN CỤC */}
        {isActive && (
          <div className="px-4 lg:px-8 py-5 border-b border-neutral-900 bg-black/30 space-y-4">
            {/* Steps indicator */}
            <div className="flex items-center gap-0">
              {[
                { key: 'upload', label: 'Upload R2', pct: '0–40%', done: stage !== 'uploading', active: stage === 'uploading' },
                { key: 'ingest', label: 'Worker Ingest', pct: '40–85%', done: stage === 'done', active: stage === 'ingesting' },
                { key: 'hls', label: 'HLS Ready', pct: '85–100%', done: stage === 'done', active: false },
              ].map((s, i) => (
                <React.Fragment key={s.key}>
                  <div className="flex flex-col items-center gap-1 min-w-[80px]">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${s.done ? 'bg-green-500 text-black' : s.active ? 'bg-white text-black animate-pulse' : 'bg-neutral-800 text-neutral-500'}`}>
                      {s.done ? '✓' : i + 1}
                    </div>
                    <span className={`text-[9px] font-black uppercase tracking-wider ${s.done ? 'text-green-400' : s.active ? 'text-white' : 'text-neutral-600'}`}>{s.label}</span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-px mb-5 transition-all ${s.done ? 'bg-green-500' : 'bg-neutral-800'}`} />}
                </React.Fragment>
              ))}
            </div>

            {/* Thanh progress chính */}
            <div className="space-y-2">
              <div className="h-3 w-full bg-neutral-900 rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${stage === 'done' ? 'bg-green-500 shadow-[0_0_20px_rgba(34,197,94,0.6)]' : 'bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)]'}`}
                  style={{ width: `${overallPct}%` }}
                />
                {/* Shimmer animation khi đang xử lý */}
                {stage !== 'done' && (
                  <div className="absolute inset-0 overflow-hidden rounded-full">
                    <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" style={{ transform: `translateX(${overallPct * 2}%)` }} />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div className="flex gap-4">
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                    Tổng tiến độ: <span className={`ml-1 ${stage === 'done' ? 'text-green-400' : 'text-white'}`}>{overallPct}%</span>
                  </span>
                  {stage === 'uploading' && uploadSpeed && (
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                      Tốc độ: <span className="ml-1 text-white">{uploadSpeed}</span>
                    </span>
                  )}
                  {stage === 'uploading' && eta && (
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                      Còn: <span className="ml-1 text-white">{eta}</span>
                    </span>
                  )}
                  {stage === 'ingesting' && ingestLog && (
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">
                      Job: <span className="ml-1 text-amber-400 uppercase">{ingestLog}</span>
                    </span>
                  )}
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest ${stage === 'done' ? 'text-green-400 flex items-center gap-1' : 'text-neutral-400 animate-pulse'}`}>
                  {stage === 'done' && <CheckCircle2 size={12} />}
                  {STAGE_LABELS[stage]}
                </span>
              </div>
            </div>

            {/* Cảnh báo khi đang upload/ingest */}
            {(stage === 'uploading' || stage === 'ingesting') && (
              <div className="flex items-center gap-2 text-amber-500 text-[9px] font-black uppercase tracking-widest animate-pulse">
                <AlertCircle size={12} />
                Đang xử lý — Vui lòng KHÔNG đóng tab hoặc làm mới trình duyệt!
              </div>
            )}
          </div>
        )}

        <div className="flex flex-1 overflow-hidden">
          {/* MAIN */}
          <main className="flex-[0.7] p-8 lg:p-12 overflow-y-auto border-r border-neutral-800 hide-scrollbar space-y-10">
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-4 w-1 bg-white"></div>
                <h2 className="text-[11px] font-black text-white uppercase tracking-[0.3em]">Block 01: Gắn kết dữ liệu (Identification)</h2>
              </div>

              {/* CẢNH BÁO KHI LÀ SERIES NHƯNG CHƯA CHỌN TẬP */}
              {isSeries && !selectedEpisode && (
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={16} />
                  <div className="space-y-1">
                    <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Series — Phải chọn Tập phim</div>
                    <div className="text-[10px] text-amber-300/70 leading-relaxed">
                      Phim này là <b>Phim Bộ (Series)</b>. Bạn <b>không thể</b> tải Video chính trực tiếp vào gốc phim bộ.<br />
                      Hãy chọn <b>đúng Tập phim</b> ở ô bên phải trước khi upload MainVideo.
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Chọn Phim (Movie) *</label>
                  <AutocompleteInput
                    placeholder="Gõ tên phim..."
                    searchUrl={kw => `${API_BASE}/admin/Movies/search?keyword=${encodeURIComponent(kw)}`}
                    mapResult={m => ({
                      id: m.movieId || m.id,
                      label: m.title,
                      avatar: m.posterUrl ?? '',
                      sub: [m.releaseYear, m.isSeries ? `Series (${m.episodeCount} tập)` : 'Phim lẻ'].filter(Boolean).join(' • '),
                      isSeries: m.isSeries,
                      episodeCount: m.episodeCount
                    })}
                    selected={selectedMovie}
                    onChange={v => { setSelectedMovie(v); setSelectedEpisode(''); setAssetType('MainVideo'); }}
                    multiple={false}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Chọn Tập (Episode)</label>
                  <select
                    disabled={!selectedMovie[0] || episodes.length === 0}
                    className="w-full bg-black border border-neutral-800 h-11 px-4 text-sm focus:border-white outline-none transition-all disabled:opacity-30 disabled:cursor-not-allowed rounded-sm"
                    value={selectedEpisode}
                    onChange={e => setSelectedEpisode(e.target.value)}
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
                  className="w-full bg-black border border-neutral-800 h-11 px-4 text-sm focus:border-white outline-none transition-all rounded-sm"
                  value={assetType}
                  onChange={e => setAssetType(e.target.value)}
                >
                  {/* Ẩn option MainVideo nếu là Series nhưng chưa chọn Episode */}
                  {(!isSeries || selectedEpisode) && (
                    <option value="MainVideo">Video luồng chính (Movie/Episode)</option>
                  )}
                  {isSeries && !selectedEpisode && (
                    <option value="" disabled>⚠ Chọn Tập phim trước để upload MainVideo</option>
                  )}
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
                <div className="w-full bg-neutral-900/30 border border-neutral-800 p-8 rounded-xl space-y-6 animate-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center">
                        <FileVideo className={stage === 'done' ? 'text-green-500' : 'text-green-500'} size={24} />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-white truncate max-w-md">{file.name}</h3>
                        <p className="text-[10px] text-neutral-500">
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                          {stage === 'done' && <span className="ml-2 text-green-400 font-bold">• ✓ Đã xử lý thành công</span>}
                          {stage === 'uploading' && <span className="ml-2 text-white font-bold">• Đang upload {uploadPct}%</span>}
                          {stage === 'ingesting' && <span className="ml-2 text-amber-400 font-bold">• Worker đang encode HLS...</span>}
                        </p>
                      </div>
                    </div>
                    {stage === 'idle' && (
                      <button onClick={() => setFile(null)} className="text-neutral-500 hover:text-red-500 transition-colors"><X size={20} /></button>
                    )}
                  </div>

                  {stage === 'done' && (
                    <div className="p-6 bg-green-500/5 border border-green-500/20 rounded-lg flex items-center justify-between gap-4">
                      <div className="space-y-1">
                        <div className="text-[12px] font-black text-green-400 flex items-center gap-2"><CheckCircle2 size={14} /> Ingest hoàn tất — HLS đã sẵn sàng trên Cloudflare R2</div>
                        <div className="text-[10px] text-neutral-500">Video có thể phát ngay trên hệ thống TviEn.</div>
                      </div>
                      <button onClick={onSaved} className="text-[10px] font-black uppercase tracking-widest bg-green-600 text-white px-4 py-2 hover:bg-green-500 transition-all rounded-sm shrink-0">
                        Xem Video ›
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>
          </main>

          {/* SIDEBAR */}
          <aside className="flex-[0.3] bg-neutral-950 p-8 space-y-10 overflow-y-auto hide-scrollbar">
            <section className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-4 w-1 bg-neutral-600"></div>
                <h2 className="text-[11px] font-black text-neutral-400 uppercase tracking-[0.3em]">Block 03: Xử lý hậu kỳ (Ingest)</h2>
              </div>

              <div className="space-y-4">
                {[
                  { label: 'Tự động mã hóa HLS', sub: 'Cắt file thành các segment nhỏ .ts', val: autoIngest, set: setAutoIngest },
                  { label: 'Bảo vệ DRM (AES-128)', sub: 'Chống tải trộm video bằng encryption', val: useDRM, set: setUseDRM },
                ].map(item => (
                  <div key={item.label} className="flex items-center justify-between p-4 bg-neutral-900/50 rounded-lg border border-white/5">
                    <div className="space-y-1">
                      <div className="text-[10px] font-black text-white uppercase tracking-widest">{item.label}</div>
                      <div className="text-[9px] text-neutral-500">{item.sub}</div>
                    </div>
                    <button onClick={() => item.set(!item.val)} className={`w-12 h-6 rounded-full relative transition-all ${item.val ? 'bg-green-600' : 'bg-neutral-800'}`}>
                      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${item.val ? 'left-7' : 'left-1'}`}></div>
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Độ phân giải đầu ra</label>
                {Object.entries(resolutions).map(([res, checked]) => (
                  <label key={res} className="flex items-center gap-3 p-3 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group">
                    <div
                      onClick={() => setResolutions({ ...resolutions, [res]: !checked })}
                      className={`w-5 h-5 border rounded flex items-center justify-center transition-all ${checked ? 'bg-white border-white' : 'border-neutral-700 group-hover:border-neutral-500'}`}
                    >
                      {checked && <div className="w-2.5 h-2.5 bg-black rounded-sm"></div>}
                    </div>
                    <span className={`text-xs font-bold ${checked ? 'text-white' : 'text-neutral-500'}`}>{res}</span>
                  </label>
                ))}
              </div>
            </section>

            {/* Pipeline legend */}
            <section className="space-y-4 border-t border-neutral-900 pt-6">
              <div className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Quy trình xử lý</div>
              {[
                { pct: '0–40%', label: 'Upload file → R2 Storage', color: 'bg-white' },
                { pct: '40–85%', label: 'Worker encode HLS + DRM', color: 'bg-amber-500' },
                { pct: '85–100%', label: 'Video sẵn sàng phát', color: 'bg-green-500' },
              ].map(s => (
                <div key={s.pct} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${s.color}`}></div>
                  <div className="text-[9px] text-neutral-500 font-bold"><span className="text-neutral-400">{s.pct}</span> — {s.label}</div>
                </div>
              ))}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}

export default function DummyNextPage() { return null; }
