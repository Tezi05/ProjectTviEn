import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  AddGenreForm, AddPersonForm, AddEpisodeForm, AddRoleForm,
  AddMovieGenreForm, AddMovieCrewForm, AddUserForm, AddReviewForm, AddWatchlistForm
} from './forms';

const API_BASE = 'http://localhost:5113/api';

const ALL_TABLES = [
  { id: 'Movies', label: '🎬 Movies', icon: 'movie', group: 'CONTENT' },
  { id: 'Genres', label: '🏷️ Genres', icon: 'category', group: 'CONTENT' },
  { id: 'Persons', label: '⭐ People', icon: 'group', group: 'CONTENT' },
  { id: 'Episodes', label: '📺 Episodes', icon: 'subscriptions', group: 'CONTENT' },
  { id: 'Videos', label: '📹 Videos (HLS)', icon: 'account_tree', group: 'SYSTEM' },
  { id: 'IngestJobs', label: '⚙️ Ingest Jobs', icon: 'terminal', group: 'SYSTEM' },
  { id: 'MediaAssets', label: '📦 Media Assets', icon: 'inventory_2', group: 'SYSTEM' },
  { id: 'Streams', label: '📡 Streams', icon: 'settings_input_antenna', group: 'SYSTEM' },
  { id: 'Users', label: '👥 Users', icon: 'person', group: 'USER DATA' },
  { id: 'Reviews', label: '💬 Reviews', icon: 'rate_review', group: 'USER DATA' },
  { id: 'WatchHistories', label: '🕒 History', icon: 'history', group: 'USER DATA' },
  { id: 'Watchlists', label: '💖 Watchlists', icon: 'favorite', group: 'USER DATA' },
  { id: 'Roles', label: '🛡️ Roles', icon: 'admin_panel_settings', group: 'USER DATA' },
  { id: 'MovieGenres', label: '🔗 Movie-Genre', icon: 'link', group: 'RELATIONS' },
  { id: 'MovieCrews', label: '🔗 Movie-Crew', icon: 'link', group: 'RELATIONS' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [activeTable, setActiveTable] = useState('Overview');
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [trashView, setTrashView] = useState(false);
  const [data, setData] = useState<any[] | null>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [addingTable, setAddingTable] = useState<string | null>(null);

  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    if (!router.isReady) return;
    const { table, view: v, trash } = router.query;
    if (table) setActiveTable(table as string);
    if (v) setView(v as 'list' | 'editor');
    if (trash) setTrashView(trash === 'true');
  }, [router.isReady, router.query]);

  const navigateTo = (table: string, v: 'list' | 'editor' = 'list', tView: boolean = false) => {
    setActiveTable(table);
    setView(v);
    setTrashView(tView);
    setError(null);
    router.push({ query: { table, view: v, trash: String(tView) } }, undefined, { shallow: true });
  };

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/system/stats`);
      if (res.ok) setStats(await res.json());
      else setStats({});
    } catch (err) { setStats({}); }
  }, []);

  const fetchData = useCallback(async () => {
    if (activeTable === 'Overview') return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/system/tables/${activeTable}?isDeleted=${trashView}`);
      if (res.ok) {
        setData(await res.json());
      } else {
        const errText = await res.text();
        setError(`Lỗi Server (${res.status}): ${errText || 'Không rõ nguyên nhân'}`);
        setData(null);
      }
    } catch (err: any) { 
      setError(`Lỗi kết nối: ${err.message}`);
      setData(null); 
    }
    finally { setLoading(false); }
  }, [activeTable, trashView]);

  useEffect(() => { if (isMounted) fetchStats(); }, [activeTable, fetchStats, isMounted]);
  useEffect(() => { if (isMounted && view === 'list') fetchData(); }, [view, fetchData, trashView, isMounted]);

  const handleDelete = async (id: any) => {
    if (trashView) {
      if (!confirm(`⚠️ Xóa VĨNH VIỄN mục này? Hành động này không thể hoàn tác!`)) return;
      try {
        const res = await fetch(`${API_BASE}/admin/system/tables/${activeTable}/${id}/force`, { method: 'DELETE' });
        if (res.ok) { fetchData(); fetchStats(); }
      } catch (err) {}
    } else {
      if (!confirm(`Ẩn mục này vào Thùng rác?`)) return;
      try {
        const res = await fetch(`${API_BASE}/admin/system/tables/${activeTable}/${id}`, { method: 'DELETE' });
        if (res.ok) { fetchData(); fetchStats(); }
      } catch (err) {}
    }
  };

  const handleRestore = async (id: any) => {
    try {
      const res = await fetch(`${API_BASE}/admin/system/tables/${activeTable}/${id}/restore`, { method: 'POST' });
      if (res.ok) { fetchData(); fetchStats(); }
    } catch (err) {}
  };

  const FORMS: Record<string, React.FC<{ onSaved: () => void; onClose: () => void }>> = {
    Genres: AddGenreForm, Persons: AddPersonForm, Episodes: AddEpisodeForm,
    Roles: AddRoleForm, MovieGenres: AddMovieGenreForm, MovieCrews: AddMovieCrewForm,
    Users: AddUserForm, Reviews: AddReviewForm, Watchlists: AddWatchlistForm,
  };

  if (!isMounted) return <div className="bg-[#0A0A0A] min-h-screen"></div>;

  return (
    <div className="bg-[#0A0A0A] text-[#E5E2E1] font-sans antialiased min-h-screen flex selection:bg-white selection:text-black">
      <Head><title>TviEn Admin - {activeTable}</title></Head>

      <aside className="fixed h-full w-[260px] left-0 top-0 border-r border-neutral-800 bg-neutral-950 flex flex-col z-50">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-primary-container flex items-center justify-center shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            <span className="material-symbols-outlined text-neutral-950" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
          </div>
          <div><div className="text-lg font-black tracking-tighter text-neutral-100 uppercase">TviEn Admin</div><div className="text-[10px] tracking-tight uppercase font-medium text-neutral-500">System Control</div></div>
        </div>
        <nav className="flex-1 overflow-y-auto hide-scrollbar px-2 pb-10">
          <button onClick={() => navigateTo('Overview')} className={`w-full flex items-center gap-3 py-2 px-4 rounded transition-all mb-4 ${activeTable === 'Overview' ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`}>
            <span className="material-symbols-outlined text-[18px]">dashboard</span><span className="text-[11px] tracking-tight uppercase font-black">Overview</span>
          </button>
          {['CONTENT', 'SYSTEM', 'USER DATA', 'RELATIONS'].map(group => (
            <div key={group} className="mt-6 mb-2">
              <div className="px-4 text-[9px] font-black text-neutral-600 tracking-[0.3em] uppercase mb-2">{group}</div>
              {ALL_TABLES.filter(t => t.group === group).map(table => {
                return (
                  <button key={table.id} onClick={() => navigateTo(table.id)} className={`w-full flex items-center gap-3 py-2 px-4 rounded transition-all mb-1 group/btn ${activeTable === table.id ? 'bg-neutral-800 text-neutral-50' : 'text-neutral-500 hover:bg-neutral-900/50 hover:text-neutral-300'}`}>
                    <span className="material-symbols-outlined text-[18px]">{table.icon}</span>
                    <span className="text-[11px] tracking-tight uppercase font-semibold">{table.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 ml-[260px] flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 h-[60px] w-full flex items-center justify-between px-6 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 z-40">
          <div className="flex items-center gap-4"><span className="text-xs font-bold text-neutral-500 uppercase tracking-[0.2em]">TviEn API Control</span><span className="text-neutral-700">/</span><span className="text-sm font-black text-neutral-100 uppercase tracking-tighter">{activeTable}</span></div>
          <div className="flex items-center gap-6"><div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div><button onClick={() => { fetchData(); fetchStats(); }} className="material-symbols-outlined text-neutral-500 hover:text-white transition-colors">refresh</button></div>
        </header>

        <main className="p-8 flex-1 overflow-y-auto hide-scrollbar">
          {activeTable === 'Overview' 
            ? <Overview stats={stats} onSelect={(t: string) => navigateTo(t)} /> 
            : view === 'editor' && activeTable === 'Movies' 
              ? <MovieEditorView movie={editingItem} onCancel={() => navigateTo('Movies', 'list')} onSaved={() => navigateTo('Movies', 'list')} /> 
              : <GenericListView 
                  title={activeTable} 
                  data={data} 
                  loading={loading} 
                  error={error}
                  trashView={trashView}
                  onTabChange={(t: boolean) => navigateTo(activeTable, 'list', t)}
                  onAdd={!trashView && (activeTable === 'Movies' || FORMS[activeTable]) ? () => {
                    if (activeTable === 'Movies') { setEditingItem(null); setView('editor'); navigateTo('Movies', 'editor'); }
                    else setAddingTable(activeTable);
                  } : undefined}
                  onEdit={activeTable === 'Movies' && !trashView ? (item: any) => { setEditingItem(item); navigateTo('Movies', 'editor'); } : undefined} 
                  onDelete={handleDelete} 
                  onRestore={handleRestore} 
                />
          }
          {addingTable && FORMS[addingTable] && React.createElement(FORMS[addingTable], {
            onSaved: () => { fetchData(); fetchStats(); },
            onClose: () => setAddingTable(null)
          })}
        </main>
      </div>

      <style jsx global>{`
        html, body, #__next { overflow: hidden; height: 100%; -ms-overflow-style: none; scrollbar-width: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar, #__next::-webkit-scrollbar { display: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; overflow-y: auto; overflow-x: auto; }
      `}</style>
    </div>
  );
}

function Overview({ stats, onSelect }: any) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-12"><h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">System Overview</h1><p className="text-xs text-neutral-500 uppercase tracking-[0.3em]">Cái nào có dữ liệu thì lấy lên — Theo dõi theo phân mục hệ thống.</p></div>
      {['CONTENT', 'SYSTEM', 'USER DATA', 'RELATIONS'].map(group => (
        <div key={group} className="mb-12">
          <div className="flex items-center gap-4 mb-6"><div className="h-px flex-1 bg-neutral-900"></div><h2 className="text-[10px] font-black text-neutral-600 tracking-[0.5em] uppercase">{group}</h2><div className="h-px flex-1 bg-neutral-900"></div></div>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {ALL_TABLES.filter(t => t.group === group).map(table => {
              const count = stats[table.id] || 0;
              const hasData = count > 0;
              return (
                <button key={table.id} onClick={() => onSelect(table.id)} className={`p-6 border text-left transition-all duration-300 group relative overflow-hidden rounded-sm hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(255,255,255,0.1)] ${hasData ? 'bg-neutral-800/50 border-neutral-700 hover:border-white hover:bg-neutral-800' : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-500'}`}>
                  <div className="flex justify-between items-start mb-4"><span className={`material-symbols-outlined text-2xl transition-colors ${hasData ? 'text-primary group-hover:text-white' : 'text-neutral-700 group-hover:text-white'}`} style={{ fontVariationSettings: hasData ? "'FILL' 1" : "" }}>{table.icon}</span><span className={`text-[9px] font-black px-2 py-1 rounded transition-colors ${hasData ? 'bg-green-500/20 text-green-400 group-hover:bg-white group-hover:text-black' : 'bg-neutral-900 text-neutral-700 group-hover:bg-white group-hover:text-black'}`}>{hasData ? 'ACTIVE' : 'EMPTY'}</span></div>
                  <div className={`text-[10px] font-black uppercase tracking-widest mb-1 transition-colors ${hasData ? 'text-neutral-500 group-hover:text-white' : 'text-neutral-700 group-hover:text-white'}`}>{table.label}</div><div className={`text-3xl font-black tabular-nums tracking-tighter transition-colors ${hasData ? 'text-white group-hover:text-white' : 'text-neutral-800 group-hover:text-white'}`}>{count}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function GenericListView({ title, data, loading, error, trashView, onTabChange, onAdd, onEdit, onDelete, onRestore }: any) {
  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    // Chỉ bỏ qua những trường hệ thống thực sự không cần thiết
    const skip = ['passwordHash', 'securityStamp', 'concurrencyStamp', 'encryptionKey', 'isDeleted', 'IsDeleted'];
    return Object.keys(data[0]).filter(k => !skip.includes(k));
  }, [data]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase">{title}</h1>
          <div className="flex gap-6 mt-4 border-b border-neutral-800">
            <button onClick={() => onTabChange(false)} className={`pb-2 text-[10px] font-black uppercase tracking-widest transition-all ${!trashView ? 'text-white border-b-2 border-white' : 'text-neutral-600 hover:text-neutral-400'}`}>Active Records</button>
            <button onClick={() => onTabChange(true)} className={`pb-2 text-[10px] font-black uppercase tracking-widest transition-all ${trashView ? 'text-red-500 border-b-2 border-red-500' : 'text-neutral-600 hover:text-neutral-400'}`}>Hidden / Trash</button>
          </div>
        </div>
        {onAdd && <button onClick={onAdd} className="bg-white text-black text-[11px] font-black px-6 h-10 rounded-sm flex items-center gap-2 hover:bg-neutral-200 transition-all uppercase tracking-widest shadow-xl"><span className="material-symbols-outlined !text-[16px]">add</span> Add Record</button>}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-950/30 border border-red-900 rounded-sm">
          <div className="flex items-center gap-2 text-red-500 mb-1">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span className="text-[10px] font-black uppercase tracking-widest">Database Error Occurred</span>
          </div>
          <div className="text-[12px] text-red-400 font-mono break-all">{error}</div>
          <div className="mt-3 text-[10px] text-neutral-500 italic">Gợi ý: Nếu lỗi nói về thiếu cột 'IsDeleted', hãy chạy 'dotnet ef database update'.</div>
        </div>
      )}

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-sm overflow-hidden shadow-2xl">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#1A1A1A] border-b border-[#2A2A2A]">
              <tr>{columns.map(col => <th key={col} className="px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em]">{col}</th>)}<th className="px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em] text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {loading ? (<tr><td colSpan={columns.length + 1} className="text-center py-24"><div className="animate-pulse text-xs text-neutral-600 uppercase tracking-[0.4em] font-black">Connecting to Core...</div></td></tr>) : data === null ? (<tr><td colSpan={columns.length + 1} className="text-center py-24"><div className="text-red-500 text-[10px] font-black uppercase tracking-widest">⚠️ Lỗi dữ liệu - Kiểm tra thông báo đỏ bên trên</div></td></tr>) : data.length === 0 ? (<tr><td colSpan={columns.length + 1} className="text-center py-24 text-[10px] text-neutral-700 uppercase tracking-[0.5em] font-black italic">{trashView ? 'Trash is empty' : 'Table is currently empty'}</td></tr>) : data.map((item, idx) => {
                return (
                <tr key={idx} className={`hover:bg-white/[0.02] transition-colors group ${trashView ? 'opacity-50' : ''}`}>
                  {columns.map(col => (<td key={col} className="px-6 py-4"><span className="text-[12px] text-neutral-100 truncate block max-w-[220px] font-medium" title={String(item[col] ?? '')}>{String(item[col] ?? '')}</span></td>))}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                      {trashView ? (
                        <button onClick={() => onRestore && onRestore(item.id || item.Id || item.movieId || item.userId || item.genreId || item.personId || item.episodeId || item.videoId)} className="p-1.5 hover:bg-green-500/10 rounded text-neutral-500 hover:text-green-500 transition-all" title="Restore"><span className="material-symbols-outlined !text-[18px]">settings_backup_restore</span></button>
                      ) : (onEdit && <button onClick={() => onEdit(item)} className="p-1.5 hover:bg-white/10 rounded text-neutral-500 hover:text-white transition-all"><span className="material-symbols-outlined !text-[18px]">edit</span></button>)}
                      <button onClick={() => onDelete(item.id || item.Id || item.movieId || item.userId || item.genreId || item.personId || item.episodeId || item.videoId)} className="p-1.5 hover:bg-red-500/10 rounded text-neutral-500 hover:text-red-500 transition-all" title={trashView ? "Delete Permanently" : "Hide"}><span className="material-symbols-outlined !text-[18px]">{trashView ? 'delete_forever' : 'delete'}</span></button>
                    </div>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MovieEditorView({ movie, onCancel, onSaved }: any) {
  const [formData, setFormData] = useState(movie || { movieId: '', title: '', description: '', releaseYear: 2024, movieType: 'movie' });
  const handleSave = async () => {
    if (!formData.movieId || !formData.title) return alert('Vui lòng nhập ID và Tiêu đề!');
    const url = movie ? `${API_BASE}/admin/Movies/${movie.movieId}` : `${API_BASE}/admin/Movies`;
    const res = await fetch(url, { method: movie ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
    if (res.ok) onSaved();
  };
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-12">
        <div className="space-y-1"><h2 className="text-3xl font-black text-white tracking-tighter uppercase">{movie ? 'Editor: Update Movie' : 'Editor: New Movie'}</h2><p className="text-[10px] text-neutral-500 uppercase tracking-[0.4em]">Configure core metadata parameters.</p></div>
        <div className="flex gap-4"><button onClick={onCancel} className="h-10 px-8 bg-neutral-900 text-neutral-400 border border-neutral-800 text-[10px] font-black uppercase tracking-widest hover:text-white hover:border-neutral-600 transition-all">Cancel</button><button onClick={handleSave} className="h-10 px-8 bg-white text-black text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all shadow-2xl">Publish Movie</button></div>
      </div>
      <div className="bg-neutral-900/50 border border-neutral-800 p-10 space-y-8 rounded-sm shadow-2xl">
          <div className="grid grid-cols-2 gap-10"><input readOnly={!!movie} className="bg-black border border-neutral-800 h-12 px-5 text-sm focus:border-white outline-none transition-all font-medium" value={formData.movieId} onChange={e => setFormData({...formData, movieId: e.target.value})} placeholder="Movie ID" /><input className="bg-black border border-neutral-800 h-12 px-5 text-sm focus:border-white outline-none transition-all font-medium" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Movie Title" /></div>
          <textarea className="w-full bg-black border border-neutral-800 min-h-[250px] p-6 text-sm focus:border-white outline-none transition-all leading-relaxed font-medium" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} placeholder="Description" />
      </div>
    </div>
  );
}
