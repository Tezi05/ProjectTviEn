import React, { useState, useEffect } from 'react';
import { GenericListView } from '../../components/GenericListView';
import { API_BASE } from '../../config';
import EpisodeForm from './EpisodeForm';

export default function EpisodesTable({ fetchStats }: any) {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [trashView, setTrashView] = useState(false);
  
  // Data states
  const [episodesData, setEpisodesData] = useState<any[]>([]);
  const [moviesData, setMoviesData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Nested view state
  const [selectedMovie, setSelectedMovie] = useState<any>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!selectedMovie) {
        // Cấp 1: Tải danh sách phim (chỉ lấy Phim Bộ)
        const res = await fetch(`${API_BASE}/admin/system/tables/Movies?isDeleted=${trashView}`);
        if (res.ok) {
          const mData = await res.json();
          // Filter out only TV Series (Type === 2 or 'TvSeries')
          setMoviesData(mData.filter((m: any) => m.type === 2 || m.type === 'TvSeries'));
        } else setError("Không thể tải danh sách phim");
      } else {
        // Cấp 2: Tải danh sách tập phim của phim đã chọn
        const res = await fetch(`${API_BASE}/admin/system/tables/Episodes?isDeleted=${trashView}`);
        if (res.ok) {
          const eData = await res.json();
          setEpisodesData(eData.filter((e: any) => e.movieId === selectedMovie.movieId || e.movieId === selectedMovie.id));
        } else setError("Không thể tải danh sách tập phim");
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [trashView, selectedMovie]);

  const handleDelete = async (item: any) => {
    const id = item.episodeId || item.id;
    if (trashView) {
      if (!confirm(`⚠️ Xóa VĨNH VIỄN tập phim này?`)) return;
      await fetch(`${API_BASE}/admin/system/tables/Episodes/${id}/force`, { method: 'DELETE' });
    } else {
      if (!confirm(`Ẩn tập phim này vào Thùng rác?`)) return;
      await fetch(`${API_BASE}/admin/system/tables/Episodes/${id}`, { method: 'DELETE' });
    }
    fetchData(); fetchStats();
  };

  const handleRestore = async (item: any) => {
    const id = item.episodeId || item.id;
    await fetch(`${API_BASE}/admin/system/tables/Episodes/${id}/restore`, { method: 'POST' });
    fetchData(); fetchStats();
  };

  if (view === 'editor') {
    return <EpisodeForm 
      episode={editingItem} 
      onSaved={() => { setView('list'); setEditingItem(null); fetchData(); fetchStats(); }} 
      onClose={() => { setView('list'); setEditingItem(null); }}
    />;
  }

  // Cấp 1: Danh sách Phim Bộ
  if (!selectedMovie) {
    return (
      <GenericListView 
        title="TV Series (Quản lý Tập)"
        data={moviesData}
        loading={loading}
        error={error}
        trashView={trashView}
        onTabChange={setTrashView}
        customActions={(item: any) => (
          <button 
            onClick={() => { setSelectedMovie(item); setTrashView(false); }} 
            className="p-1.5 hover:bg-blue-500/10 rounded text-neutral-500 hover:text-blue-400 transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-1"
          >
            <span className="material-symbols-outlined !text-[18px]">format_list_numbered</span>
            Quản lý Tập
          </button>
        )}
      />
    );
  }

  // Cấp 2: Danh sách Tập Phim
  return (
    <div className="space-y-6">
      <button 
        onClick={() => { setSelectedMovie(null); setTrashView(false); }}
        className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500 hover:text-white flex items-center gap-2 transition-colors"
      >
        <span className="material-symbols-outlined !text-[14px]">arrow_back</span>
        Quay lại danh sách Phim Bộ
      </button>
      
      <GenericListView 
        title={`Episodes: ${selectedMovie.title}`}
        data={episodesData}
        loading={loading}
        error={error}
        trashView={trashView}
        onTabChange={setTrashView}
        onAdd={() => { 
          // Truyền sẵn thông tin phim vào EpisodeForm
          setEditingItem({ 
            movieId: selectedMovie.movieId || selectedMovie.id, 
            movieTitle: selectedMovie.title 
          }); 
          setView('editor'); 
        }}
        onEdit={(item: any) => { setEditingItem(item); setView('editor'); }}
        onDelete={handleDelete}
        onRestore={handleRestore}
      />
    </div>
  );
}
