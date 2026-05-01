import React, { useState, useEffect } from 'react';
import { API_BASE, CDN_BASE } from '../../config';
import { AddModal, Field, inp, sel, tex, lbl, toSlug } from '../../components/SharedUI';

export default function MovieEditor({ movie, onCancel, onSaved }: any) {
  const isEdit = !!movie;
  const [activeTab, setActiveTab] = useState<'info' | 'video'>('info');
  const [formData, setFormData] = useState<any>(movie || { movieId: '', title: '', originalTitle: '', slug: '', description: '', releaseYear: 2024, duration: 0, ageRating: 'P', status: 0, genreIds: [], crewMembers: [] });
  const [isSlugLocked, setIsSlugLocked] = useState(isEdit);
  const [allGenres, setAllGenres] = useState<any[]>([]);
  const [allPersons, setAllPersons] = useState<any[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);
  const [presignedUrls, setPresignedUrls] = useState<Record<string, string>>({});
  const [pendingPoster, setPendingPoster] = useState<File | null>(null);
  const [pendingBackdrop, setPendingBackdrop] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchExtras = async () => {
      setLoadingExtras(true);
      try {
        const [gRes, pRes] = await Promise.all([
          fetch(`${API_BASE}/admin/system/tables/Genres`),
          fetch(`${API_BASE}/admin/system/tables/Persons`)
        ]);
        if (gRes.ok) setAllGenres(await gRes.json());
        if (pRes.ok) setAllPersons(await pRes.json());

        if (isEdit) {
          const res = await fetch(`${API_BASE}/admin/Movies/${movie.id || movie.movieId || movie.Id || movie.genreId}`);
          if (res.ok) {
            const fullMovie = await res.json();
            setFormData({
              ...fullMovie,
              genreIds: fullMovie.genres?.map((g: any) => g.genreId) || fullMovie.genreIds || [],
              crewMembers: fullMovie.crew?.map((c: any) => ({ personId: c.personId, roleId: c.roleId })) || fullMovie.crewMembers || []
            });
          }
        }
      } catch (err) {} finally { setLoadingExtras(false); }
    };
    fetchExtras();
  }, [isEdit, movie]);

  const handleSave = async () => {
    if (!formData.title || !formData.slug) return alert('Vui lòng nhập đủ thông tin!');
    setIsSaving(true);
    try {
      const id = formData.id || formData.movieId || formData.Id || formData.genreId;
      const url = isEdit ? `${API_BASE}/admin/Movies/${id}` : `${API_BASE}/admin/Movies`;
      
      // Tạo bản sao dữ liệu để tránh gửi ID khi Thêm mới
      const dataToSend = { ...formData };
      if (!isEdit) {
        delete dataToSend.id;
        delete dataToSend.Id;
        delete dataToSend.movieId;
        delete dataToSend.MovieId;
      }

      const res = await fetch(url, { 
        method: isEdit ? 'PUT' : 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(dataToSend) 
      });

      if (res.ok) {
        const savedMovie = await res.json();
        const savedId = savedMovie.id || savedMovie.movieId || savedMovie.Id;

        // Upload ảnh nếu có file chờ
        if (pendingPoster) await uploadFile('poster', pendingPoster, savedId);
        if (pendingBackdrop) await uploadFile('backdrop', pendingBackdrop, savedId);

        onSaved();
      } else {
        const errText = await res.text();
        alert(`Lỗi khi lưu phim: ${res.status} - ${errText}`);
      }
    } catch (err) {
      alert("Lỗi kết nối khi lưu phim");
    } finally {
      setIsSaving(false);
    }
  };

  const uploadFile = async (type: 'poster' | 'backdrop', file: File, id: any) => {
    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    try {
      await fetch(`${API_BASE}/admin/Movies/${id}/upload-${type}`, { 
        method: 'POST', 
        body: formDataUpload 
      });
    } catch (err) {
      console.error(`Error uploading ${type}:`, err);
    }
  };

  const fetchPresignedUrl = async (objectKey: string): Promise<string> => {
    if (!objectKey || objectKey.startsWith('http')) return objectKey;
    if (presignedUrls[objectKey]) return presignedUrls[objectKey];

    const id = formData.id || formData.movieId || formData.Id;
    try {
      const res = await fetch(`${API_BASE}/admin/Movies/image-url/${id}?key=${encodeURIComponent(objectKey)}`);
      if (res.ok) {
        const json = await res.json();
        setPresignedUrls(prev => ({ ...prev, [objectKey]: json.url }));
        return json.url;
      }
    } catch (err) { console.error("Error fetching presigned URL:", err); }
    return '';
  };

  useEffect(() => {
    const loadImages = async () => {
      if (formData.posterUrl && !formData.posterUrl.startsWith('http')) {
        await fetchPresignedUrl(formData.posterUrl);
      }
      if (formData.backdropUrl && !formData.backdropUrl.startsWith('http')) {
        await fetchPresignedUrl(formData.backdropUrl);
      }
    };
    loadImages();
  }, [formData.posterUrl, formData.backdropUrl]);

  const handleImageUpload = async (type: 'poster' | 'backdrop', file: File) => {
    const localUrl = URL.createObjectURL(file);
    setFormData((prev: any) => ({ ...prev, [`local${type}Preview`]: localUrl }));
    
    if (type === 'poster') setPendingPoster(file);
    else setPendingBackdrop(file);
  };

  const getImageUrl = (path: string, localPreview?: string) => {
    if (localPreview) return localPreview;
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return presignedUrls[path] || ''; 
  };

  const toSlug = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/([^0-9a-z-\s])/g, '').replace(/(\s+)/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  if (loadingExtras) return <div className="text-center py-20 text-neutral-500 uppercase tracking-[0.4em] font-black animate-pulse">Loading Assets...</div>;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-[1600px] mx-auto pb-20 px-4 lg:px-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
        <div>
          <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">{isEdit ? 'Update Movie' : 'New Movie'}</h2>
          <div className="flex gap-8 mt-6 border-b border-neutral-900">
            <button onClick={() => setActiveTab('info')} className={`pb-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'info' ? 'text-white border-b-2 border-white' : 'text-neutral-600 hover:text-neutral-400'}`}>Thông tin phim</button>
            <button onClick={() => setActiveTab('video')} className={`pb-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all ${activeTab === 'video' ? 'text-white border-b-2 border-white' : 'text-neutral-600 hover:text-neutral-400'}`}>Quản lý Video</button>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={onCancel} className="h-12 px-10 bg-neutral-900 text-neutral-500 border border-neutral-800 text-[11px] font-black uppercase tracking-widest hover:text-white hover:border-neutral-700 transition-all">Cancel</button>
          <button onClick={handleSave} className="h-12 px-12 bg-white text-black text-[11px] font-black uppercase tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.15)] hover:scale-105 active:scale-95 transition-all">Publish</button>
        </div>
      </div>

      {activeTab === 'info' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* MAIN COLUMN */}
          <div className="lg:col-span-8 space-y-10">
            {/* ZONE 1: CORE INFO */}
            <div className="bg-[#0A0A0A] border border-neutral-900 p-10 rounded-sm space-y-10 shadow-2xl">
              <div className="flex items-center gap-4 mb-2"><span className="text-[11px] font-black text-neutral-600 tracking-[0.4em] uppercase">1. Core Metadata</span><div className="h-px flex-1 bg-neutral-900"></div></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Tên phim</label>
                  <input className="w-full bg-black border border-neutral-800 h-14 px-6 text-base focus:border-white outline-none transition-all font-medium text-white" value={formData.title || ''} onChange={e => { const val = e.target.value; setFormData((p:any) => ({...p, title: val, slug: isSlugLocked ? p.slug : toSlug(val) })); }} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Tên gốc</label>
                  <input className="w-full bg-black border border-neutral-800 h-14 px-6 text-base focus:border-white outline-none transition-all font-medium text-white" value={formData.originalTitle || ''} onChange={e => setFormData({...formData, originalTitle: e.target.value})} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Năm phát hành</label>
                  <input type="number" className="w-full bg-black border border-neutral-800 h-14 px-6 text-base focus:border-white outline-none transition-all font-medium text-white" value={formData.releaseYear || 0} onChange={e => setFormData({...formData, releaseYear: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Thời lượng (Phút)</label>
                  <input type="number" className="w-full bg-black border border-neutral-800 h-14 px-6 text-base focus:border-white outline-none transition-all font-medium text-white" value={formData.duration || 0} onChange={e => setFormData({...formData, duration: parseInt(e.target.value)})} />
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Phân loại tuổi</label>
                  <select className="w-full bg-black border border-neutral-800 h-14 px-6 text-base focus:border-white outline-none transition-all font-medium text-white" value={formData.ageRating || ''} onChange={e => setFormData({...formData, ageRating: e.target.value})}>
                    <option value="P">P (All)</option><option value="13+">13+</option><option value="C16">C16</option><option value="C18">C18</option>
                  </select>
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest flex justify-between"><span>Slug (SEO URL)</span><button onClick={() => setIsSlugLocked(!isSlugLocked)} className="text-[9px] border border-neutral-800 px-3 py-1 rounded hover:bg-white hover:text-black transition-all uppercase">{isSlugLocked ? 'Unlock' : 'Lock'}</button></label>
                <input readOnly={isSlugLocked} className={`w-full bg-black border border-neutral-800 h-14 px-6 text-base outline-none transition-all font-mono ${isSlugLocked ? 'text-neutral-600 cursor-not-allowed' : 'text-primary border-neutral-600'}`} value={formData.slug || ''} onChange={e => setFormData({...formData, slug: toSlug(e.target.value)})} />
              </div>
            </div>

            {/* ZONE 2: CONTENT */}
            <div className="bg-[#0A0A0A] border border-neutral-900 p-10 rounded-sm space-y-10 shadow-2xl">
              <div className="flex items-center gap-4 mb-2"><span className="text-[11px] font-black text-neutral-600 tracking-[0.4em] uppercase">2. Content & Media</span><div className="h-px flex-1 bg-neutral-900"></div></div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Mô tả phim</label>
                <textarea className="w-full bg-black border border-neutral-800 min-h-[300px] p-8 text-base focus:border-white outline-none transition-all font-medium leading-relaxed text-white" value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Trailer URL</label>
                <input className="w-full bg-black border border-neutral-800 h-14 px-6 text-base focus:border-white outline-none transition-all font-medium text-white" value={formData.trailerUrl || ''} onChange={e => setFormData({...formData, trailerUrl: e.target.value})} />
              </div>
            </div>

            {/* ZONE 3: RELATIONSHIPS */}
            <div className="bg-[#0A0A0A] border border-neutral-900 p-10 rounded-sm space-y-12 shadow-2xl">
              <div className="flex items-center gap-4 mb-2"><span className="text-[11px] font-black text-neutral-600 tracking-[0.4em] uppercase">3. Relationships</span><div className="h-px flex-1 bg-neutral-900"></div></div>
              
              <div className="space-y-6">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Thể loại (Genres)</label>
                <div className="flex flex-wrap gap-3">
                  {allGenres.map(g => (
                    <button key={g.genreId} onClick={() => { 
                      const ids = [...(formData.genreIds || [])]; 
                      const idx = ids.indexOf(g.genreId); 
                      if (idx > -1) ids.splice(idx, 1); else ids.push(g.genreId); 
                      setFormData({...formData, genreIds: ids}); 
                    }} className={`px-6 py-3 text-[11px] font-black uppercase tracking-widest rounded-sm transition-all border ${formData.genreIds?.includes(g.genreId) ? 'bg-white text-black border-white' : 'bg-transparent text-neutral-600 border-neutral-800 hover:border-neutral-500 hover:text-neutral-300'}`}>{g.name}</button>
                  ))}
                </div>
              </div>

              <div className="space-y-6">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Nhân sự & Vai trò (Crew)</label>
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {formData.crewMembers?.map((cm: any, idx: number) => {
                    const person = allPersons.find(p => p.id === cm.personId);
                    return (
                      <div key={idx} className="flex items-center gap-6 bg-black border border-neutral-800 p-5 rounded-sm group hover:border-neutral-600 transition-all">
                        <div className="flex-1 text-[13px] font-bold text-white uppercase tracking-tight">{person?.fullName || 'Unknown'}</div>
                        <select className="bg-neutral-900 border border-neutral-800 text-[10px] font-black uppercase px-4 py-2 outline-none focus:border-white transition-all text-neutral-400" value={cm.roleId} onChange={e => { const m = [...formData.crewMembers]; m[idx].roleId = parseInt(e.target.value); setFormData({...formData, crewMembers: m}); }}>
                          <option value={1}>Đạo diễn</option><option value={2}>Diễn viên</option><option value={3}>Biên kịch</option>
                        </select>
                        <button onClick={() => { const m = [...formData.crewMembers]; m.splice(idx, 1); setFormData({...formData, crewMembers: m}); }} className="material-symbols-outlined text-neutral-700 hover:text-red-500 transition-colors !text-[20px]">close</button>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3">
                  <select id="newPerson" className="flex-1 bg-black border border-neutral-800 text-[11px] font-black uppercase px-6 h-14 outline-none focus:border-neutral-600 transition-all text-white">
                    <option value="">+ Thêm nhân sự mới...</option>
                    {allPersons.filter(p => !formData.crewMembers?.some((cm: any) => cm.personId === p.id)).map(p => <option key={p.id} value={p.id}>{p.fullName}</option>)}
                  </select>
                  <button onClick={() => { const s = document.getElementById('newPerson') as HTMLSelectElement; if (!s.value) return; const m = [...(formData.crewMembers || [])]; m.push({ personId: s.value, roleId: 2 }); setFormData({...formData, crewMembers: m}); s.value = ""; }} className="bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-black uppercase px-10 h-14 transition-all">Add</button>
                </div>
              </div>
            </div>
          </div>

          {/* SIDE COLUMN */}
          <div className="lg:col-span-4 space-y-10">
            {/* POSTER PREVIEW */}
            <div className="bg-[#0A0A0A] border border-neutral-900 p-8 rounded-sm space-y-8 shadow-2xl">
              <label className="text-[11px] font-black text-neutral-600 uppercase tracking-widest block border-b border-neutral-900 pb-3">Poster (2:3)</label>
              <div className="relative aspect-[2/3] bg-black border border-neutral-800 rounded-sm overflow-hidden flex items-center justify-center group shadow-inner">
                {(formData.posterUrl || formData.localposterPreview) ? (
                  <img 
                    src={getImageUrl(formData.posterUrl, formData.localposterPreview)} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    onError={async (e) => { 
                      const target = e.target as HTMLImageElement;
                      const key = formData.posterUrl;
                      if (key && !key.startsWith('http')) {
                        setPresignedUrls(prev => { const next = {...prev}; delete next[key]; return next; });
                        const newUrl = await fetchPresignedUrl(key);
                        if (newUrl) target.src = newUrl;
                      } else {
                        target.src = 'https://placehold.co/400x600/000/fff?text=Error'; 
                      }
                    }}
                  />
                ) : <span className="material-symbols-outlined text-neutral-900 text-8xl">image</span>}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <label className="cursor-pointer bg-white text-black px-6 py-3 text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-2xl">Change Image<input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleImageUpload('poster', e.target.files[0])} /></label>
                </div>
              </div>
            </div>

            {/* BACKDROP PREVIEW */}
            <div className="bg-[#0A0A0A] border border-neutral-900 p-8 rounded-sm space-y-8 shadow-2xl">
              <label className="text-[11px] font-black text-neutral-600 uppercase tracking-widest block border-b border-neutral-900 pb-3">Backdrop (16:9)</label>
              <div className="relative aspect-[16/9] bg-black border border-neutral-800 rounded-sm overflow-hidden flex items-center justify-center group shadow-inner">
                {(formData.backdropUrl || formData.localbackdropPreview) ? (
                  <img 
                    src={getImageUrl(formData.backdropUrl, formData.localbackdropPreview)} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
                    onError={async (e) => { 
                      const target = e.target as HTMLImageElement;
                      const key = formData.backdropUrl;
                      if (key && !key.startsWith('http')) {
                        setPresignedUrls(prev => { const next = {...prev}; delete next[key]; return next; });
                        const newUrl = await fetchPresignedUrl(key);
                        if (newUrl) target.src = newUrl;
                      } else {
                        target.src = 'https://placehold.co/800x450/000/fff?text=Error'; 
                      }
                    }}
                  />
                ) : <span className="material-symbols-outlined text-neutral-900 text-8xl">panorama</span>}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <label className="cursor-pointer bg-white text-black px-6 py-3 text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-2xl">Change Image<input type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && handleImageUpload('backdrop', e.target.files[0])} /></label>
                </div>
              </div>
            </div>

            {/* ZONE 4: PUBLISHING */}
            <div className="bg-[#0D0D0D] border border-white/5 p-10 rounded-sm space-y-10 shadow-2xl sticky top-24">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-black text-neutral-400 uppercase tracking-widest">Publish Status</span>
                <button onClick={() => setFormData({...formData, status: formData.status === 1 ? 0 : 1})} className={`w-14 h-7 rounded-full transition-all relative flex items-center ${formData.status === 1 ? 'bg-green-500' : 'bg-neutral-800'}`}><div className={`w-5 h-5 rounded-full bg-white transition-all absolute shadow-sm ${formData.status === 1 ? 'left-8' : 'left-1'}`}></div></button>
              </div>
              <div className="space-y-5 pt-6 border-t border-white/5">
                <div className="flex justify-between text-[10px] uppercase tracking-tighter"><span className="text-neutral-600 font-bold">Created</span><span className="text-neutral-400 font-black">{formData.createdAt ? new Date(formData.createdAt).toLocaleString() : 'Now'}</span></div>
                <div className="flex justify-between text-[10px] uppercase tracking-tighter"><span className="text-neutral-600 font-bold">Last Update</span><span className="text-neutral-400 font-black">{formData.updatedAt ? new Date(formData.updatedAt).toLocaleString() : 'Now'}</span></div>
              </div>
              <p className="text-[10px] text-neutral-700 uppercase leading-relaxed text-center font-bold italic opacity-60">Lưu ý: Sau khi lưu thông tin, hãy chuyển qua tab Quản lý Video để kiểm tra các luồng phát HLS.</p>
            </div>
          </div>
        </div>
      ) : (
        /* TAB QUẢN LÝ VIDEO (STREAMING) */
        <div className="animate-in fade-in zoom-in-95 duration-500 max-w-5xl mx-auto">
          <div className="bg-[#0A0A0A] border border-neutral-900 p-12 rounded-sm shadow-2xl">
            <h3 className="text-2xl font-black text-white uppercase tracking-tighter mb-10">HLS Streaming Nodes</h3>
            {formData.videos?.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                {formData.videos.map((v: any) => (
                  <div key={v.videoId} className="bg-black border border-neutral-800 p-8 rounded-sm space-y-6 relative overflow-hidden group hover:border-neutral-600 transition-all">
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-primary opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-6">
                         <div className="w-16 h-16 bg-neutral-900 rounded-sm flex items-center justify-center"><span className="material-symbols-outlined text-neutral-500 text-3xl">play_circle</span></div>
                         <div><div className="text-[11px] font-black text-neutral-600 uppercase mb-1 tracking-widest">Resolution</div><div className="text-3xl font-black text-white">{v.resolution}</div></div>
                      </div>
                      <span className={`text-[10px] font-black px-4 py-2 rounded-sm ${v.isEncrypted ? 'bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.2)]' : 'bg-neutral-800 text-neutral-500'}`}>{v.isEncrypted ? '🔐 ENCRYPTED' : '🔓 OPEN'}</span>
                    </div>
                    <div className="pt-6 border-t border-neutral-900">
                      <div className="text-[9px] font-black text-neutral-700 uppercase mb-3 tracking-widest">Internal Storage Key (R2 Object)</div>
                      <div className="text-[12px] font-mono text-neutral-500 break-all bg-neutral-950 p-5 rounded-sm border border-neutral-900">{v.videoId}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-24 text-center space-y-6 bg-black/40 border border-dashed border-neutral-800 rounded-sm">
                <span className="material-symbols-outlined text-neutral-800 text-7xl">cloud_off</span>
                <p className="text-[12px] text-neutral-600 uppercase font-black tracking-widest italic">No streaming nodes detected. Please run the ingest workflow.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
