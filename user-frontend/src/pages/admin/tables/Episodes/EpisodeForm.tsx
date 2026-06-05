import React, { useState, useEffect } from 'react';
import { API_BASE } from '../../config';
import { AddModal, Field, inp, sel, tex, lbl, toSlug } from '../../components/SharedUI';
import { AutocompleteInput, ACOption } from '../../autocomplete';

export default function EpisodeForm({ onSaved, onClose, episode }: { onSaved: () => void; onClose: () => void; episode?: any }) {
  const isEdit = !!episode;
  const [activeTab, setActiveTab] = useState<'info' | 'video'>('info');
  const [formData, setFormData] = useState<any>(episode || { 
    movieId: '', 
    title: '', 
    slug: '', 
    description: '', 
    episodeNumber: 1, 
    seasonNumber: 1, 
    airDate: new Date().toISOString().split('T')[0],
    status: 1
  });
  const [selectedMovie, setSelectedMovie] = useState<ACOption[]>([]);
  const [isSlugLocked, setIsSlugLocked] = useState(isEdit);

  useEffect(() => {
    if (isEdit && episode.movieId) {
      // Mock fetch movie info for autocomplete if needed, 
      // or just set it if episode has movie title
      setSelectedMovie([{ id: episode.movieId, label: episode.movieTitle || 'Linked Movie' }]);
    }
  }, [isEdit, episode]);

  const handleSave = async () => {
    if (!formData.title || !selectedMovie[0]) return alert('Vui lòng chọn Phim và nhập Tiêu đề tập!');
    const dataToSend = { ...formData, movieId: selectedMovie[0].id };
    const url = isEdit ? `${API_BASE}/admin/system/tables/Episodes/${episode.episodeId}` : `${API_BASE}/admin/system/tables/Episodes`;
    const res = await fetch(url, { 
      method: isEdit ? 'PUT' : 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify(dataToSend) 
    });
    if (res.ok) onSaved(); else alert('Lỗi khi lưu tập phim!');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl overflow-y-auto pt-10 pb-20 custom-scrollbar">
      <div className="max-w-[1200px] mx-auto px-6">
        {/* HEADER */}
        <div className="flex items-center justify-between mb-12">
          <div>
            <h2 className="text-3xl font-black text-white tracking-tighter uppercase">{isEdit ? 'Update Episode' : 'New Episode'}</h2>
            <div className="flex gap-8 mt-6">
              <button onClick={() => setActiveTab('info')} className={`pb-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'info' ? 'text-white border-b-2 border-white' : 'text-neutral-600'}`}>Thông tin tập</button>
              <button onClick={() => setActiveTab('video')} className={`pb-2 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'video' ? 'text-white border-b-2 border-white' : 'text-neutral-600'}`}>Luồng phát (HLS)</button>
            </div>
          </div>
          <div className="flex gap-4">
            <button onClick={onClose} className="h-10 px-8 bg-neutral-900 text-neutral-500 text-[10px] font-black uppercase tracking-widest border border-neutral-800 hover:text-white transition-all">Cancel</button>
            <button onClick={handleSave} className="h-10 px-10 bg-white text-black text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">Save Episode</button>
          </div>
        </div>

        {activeTab === 'info' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* ZONE 1 & 2: CORE & CONTENT */}
            <div className="lg:col-span-8 space-y-8">
              <div className="bg-[#0A0A0A] border border-neutral-900 p-8 rounded-sm space-y-8">
                <div className="flex items-center gap-4 mb-2"><span className="text-[10px] font-black text-neutral-600 tracking-[0.3em] uppercase">1. Core Metadata</span><div className="h-px flex-1 bg-neutral-900"></div></div>
                
                <AutocompleteInput 
                  label="Thuộc phim (Movie) *" 
                  placeholder="Gõ tên phim..."
                  searchUrl={kw => `${API_BASE}/admin/Movies/search?keyword=${encodeURIComponent(kw)}&type=TvSeries`}
                  mapResult={m => ({ id: m.movieId || m.id, label: m.title, avatar: m.posterUrl, sub: m.releaseYear })}
                  selected={selectedMovie}
                  onChange={setSelectedMovie}
                  multiple={false}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Field label="Tiêu đề tập *">
                    <input className={inp} value={formData.title || ''} onChange={e => {
                      const val = e.target.value;
                      setFormData((p: any) => ({ ...p, title: val, slug: isSlugLocked ? p.slug : toSlug(val) }));
                    }} />
                  </Field>
                  <Field label="Slug (SEO URL)">
                    <input className={`${inp} font-mono ${isSlugLocked ? 'opacity-50' : 'text-primary'}`} value={formData.slug || ''} readOnly={isSlugLocked} onChange={e => setFormData({...formData, slug: toSlug(e.target.value)})} />
                  </Field>
                </div>

                <div className="grid grid-cols-3 gap-6">
                  <Field label="Số tập (Episode #)">
                    <input type="number" className={inp} value={formData.episodeNumber || 1} onChange={e => setFormData({...formData, episodeNumber: parseInt(e.target.value)})} />
                  </Field>
                  <Field label="Mùa (Season #)">
                    <input type="number" className={inp} value={formData.seasonNumber || 1} onChange={e => setFormData({...formData, seasonNumber: parseInt(e.target.value)})} />
                  </Field>
                  <Field label="Ngày chiếu">
                    <input type="date" className={inp} value={formData.airDate?.split('T')[0] || ''} onChange={e => setFormData({...formData, airDate: e.target.value})} />
                  </Field>
                </div>
              </div>

              <div className="bg-[#0A0A0A] border border-neutral-900 p-8 rounded-sm space-y-6">
                <div className="flex items-center gap-4 mb-2"><span className="text-[10px] font-black text-neutral-600 tracking-[0.3em] uppercase">2. Episode Summary</span><div className="h-px flex-1 bg-neutral-900"></div></div>
                <Field label="Mô tả nội dung tập">
                  <textarea className={`${tex} min-h-[200px]`} value={formData.description || ''} onChange={e => setFormData({...formData, description: e.target.value})} />
                </Field>
              </div>
            </div>

            {/* ZONE 4: STATUS & SIDE */}
            <div className="lg:col-span-4 space-y-8">
              <div className="bg-[#0D0D0D] border border-neutral-900 p-8 rounded-sm space-y-8">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Publishing Status</span>
                  <button onClick={() => setFormData({...formData, status: formData.status === 1 ? 0 : 1})} className={`w-12 h-6 rounded-full relative flex items-center transition-all ${formData.status === 1 ? 'bg-green-500' : 'bg-neutral-800'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full absolute transition-all ${formData.status === 1 ? 'right-1' : 'left-1'}`}></div>
                  </button>
                </div>
                <p className="text-[10px] text-neutral-700 italic font-bold">Lưu ý: Đảm bảo đã chọn đúng Phim để tập phim xuất hiện trong danh sách phát của phim đó.</p>
              </div>
            </div>
          </div>
        ) : (
          /* VIDEO TAB */
          <div className="bg-[#0A0A0A] border border-neutral-900 p-12 rounded-sm text-center">
             <span className="material-symbols-outlined text-neutral-800 text-6xl mb-4">video_library</span>
             <p className="text-neutral-600 text-[11px] font-black uppercase tracking-[0.2em]">Cấu hình Streaming cho tập phim sẽ khả dụng sau khi lưu thông tin cơ bản.</p>
          </div>
        )}
      </div>
    </div>
  );
}
