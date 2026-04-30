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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    setIsSidebarOpen(false);
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
      if (!confirm(`⚠️ Xóa VĨNH VIỄN mục này?`)) return;
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

      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] lg:hidden" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <aside className={`fixed h-full w-[260px] left-0 top-0 border-r border-neutral-800 bg-neutral-950 flex flex-col z-[60] transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        <div className="p-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded bg-white flex items-center justify-center">
              <span className="material-symbols-outlined text-black text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>shield</span>
            </div>
            <div>
              <div className="text-lg font-black tracking-tighter text-neutral-100 uppercase leading-none">TviEn Admin</div>
              <div className="text-[10px] tracking-tight uppercase font-medium text-neutral-500 mt-1">System Control</div>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-neutral-500 hover:text-white">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto hide-scrollbar px-2 pb-10">
          <button onClick={() => navigateTo('Overview')} className={`w-full flex items-center gap-3 py-2 px-4 rounded transition-all mb-4 ${activeTable === 'Overview' ? 'bg-white text-black' : 'text-neutral-500 hover:text-white'}`}>
            <span className="material-symbols-outlined text-[18px]">dashboard</span><span className="text-[11px] tracking-tight uppercase font-black">Overview</span>
          </button>
          {['CONTENT', 'SYSTEM', 'USER DATA', 'RELATIONS'].map(group => (
            <div key={group} className="mt-6 mb-2">
              <div className="px-4 text-[9px] font-black text-neutral-600 tracking-[0.3em] uppercase mb-2">{group}</div>
              {ALL_TABLES.filter(t => t.group === group).map(table => (
                <button key={table.id} onClick={() => navigateTo(table.id)} className={`w-full flex items-center gap-3 py-2 px-4 rounded transition-all mb-1 group/btn ${activeTable === table.id ? 'bg-neutral-800 text-neutral-50' : 'text-neutral-500 hover:bg-neutral-900/50 hover:text-neutral-300'}`}>
                  <span className="material-symbols-outlined text-[18px]">{table.icon}</span>
                  <span className="text-[11px] tracking-tight uppercase font-semibold">{table.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex-1 lg:ml-[260px] flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 h-[60px] w-full flex items-center justify-between px-4 lg:px-6 bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 z-40">
          <div className="flex items-center gap-3 lg:gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-neutral-400 hover:text-white"><span className="material-symbols-outlined">menu</span></button>
            <div className="flex items-center gap-2 lg:gap-4">
              <span className="hidden sm:inline text-xs font-bold text-neutral-500 uppercase tracking-[0.2em]">TviEn API Control</span>
              <span className="hidden sm:inline text-neutral-700">/</span>
              <span className="text-sm font-black text-neutral-100 uppercase tracking-tighter">{activeTable}</span>
            </div>
          </div>
          <div className="flex items-center gap-4 lg:gap-6"><div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div><button onClick={() => { fetchData(); fetchStats(); }} className="material-symbols-outlined text-neutral-500 hover:text-white transition-colors">refresh</button></div>
        </header>

        <main className="p-4 lg:p-8 flex-1 overflow-y-auto hide-scrollbar">
          {activeTable === 'Overview' 
            ? <Overview stats={stats} onSelect={(t: string) => navigateTo(t)} /> 
            : view === 'editor' && activeTable === 'Movies' 
              ? <MovieEditorView movie={editingItem} onCancel={() => navigateTo('Movies', 'list')} onSaved={() => navigateTo('Movies', 'list')} /> 
              : <GenericListView 
                  title={activeTable} data={data} loading={loading} error={error} trashView={trashView}
                  onTabChange={(t: boolean) => navigateTo(activeTable, 'list', t)}
                  onAdd={!trashView && (activeTable === 'Movies' || FORMS[activeTable]) ? () => {
                    if (activeTable === 'Movies') { setEditingItem(null); setView('editor'); navigateTo('Movies', 'editor'); }
                    else setAddingTable(activeTable);
                  } : undefined}
                  onEdit={activeTable === 'Movies' && !trashView ? (item: any) => { setEditingItem(item); navigateTo('Movies', 'editor'); } : undefined} 
                  onDelete={handleDelete} onRestore={handleRestore} 
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
      <div className="mb-8 lg:mb-12"><h1 className="text-3xl lg:text-4xl font-black text-white tracking-tighter uppercase mb-2">System Overview</h1><p className="text-[10px] text-neutral-500 uppercase tracking-[0.3em]">Theo dõi hệ thống.</p></div>
      {['CONTENT', 'SYSTEM', 'USER DATA', 'RELATIONS'].map(group => (
        <div key={group} className="mb-12">
          <div className="flex items-center gap-4 mb-6"><div className="h-px flex-1 bg-neutral-900"></div><h2 className="text-[10px] font-black text-neutral-600 tracking-[0.5em] uppercase">{group}</h2><div className="h-px flex-1 bg-neutral-900"></div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
            {ALL_TABLES.filter(t => t.group === group).map(table => {
              const count = stats[table.id] || 0;
              const hasData = count > 0;
              return (
                <button key={table.id} onClick={() => onSelect(table.id)} className={`p-5 lg:p-6 border text-left transition-all duration-300 group relative overflow-hidden rounded-sm hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(255,255,255,0.1)] ${hasData ? 'bg-neutral-800/50 border-neutral-700 hover:border-white hover:bg-neutral-800' : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-500'}`}>
                  <div className="flex justify-between items-start mb-4"><span className={`material-symbols-outlined text-2xl transition-colors ${hasData ? 'text-primary group-hover:text-white' : 'text-neutral-700 group-hover:text-white'}`} style={{ fontVariationSettings: hasData ? "'FILL' 1" : "" }}>{table.icon}</span><span className={`text-[9px] font-black px-2 py-1 rounded transition-colors ${hasData ? 'bg-green-500/20 text-green-400 group-hover:bg-white group-hover:text-black' : 'bg-neutral-900 text-neutral-700 group-hover:bg-white group-hover:text-black'}`}>{hasData ? 'ACTIVE' : 'EMPTY'}</span></div>
                  <div className={`text-[10px] font-black uppercase tracking-widest mb-1 transition-colors ${hasData ? 'text-neutral-500 group-hover:text-white' : 'text-neutral-700 group-hover:text-white'}`}>{table.label}</div><div className={`text-2xl lg:text-3xl font-black tabular-nums tracking-tighter transition-colors ${hasData ? 'text-white group-hover:text-white' : 'text-neutral-800 group-hover:text-white'}`}>{count}</div>
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
    const skip = ['passwordHash', 'securityStamp', 'concurrencyStamp', 'encryptionKey', 'isDeleted', 'IsDeleted'];
    return Object.keys(data[0]).filter(k => !skip.includes(k));
  }, [data]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase">{title}</h1>
          <div className="flex gap-4 lg:gap-6 mt-4 border-b border-neutral-800">
            <button onClick={() => onTabChange(false)} className={`pb-2 text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all ${!trashView ? 'text-white border-b-2 border-white' : 'text-neutral-600 hover:text-neutral-400'}`}>Active</button>
            <button onClick={() => onTabChange(true)} className={`pb-2 text-[9px] lg:text-[10px] font-black uppercase tracking-widest transition-all ${trashView ? 'text-red-500 border-b-2 border-red-500' : 'text-neutral-600 hover:text-neutral-400'}`}>Trash</button>
          </div>
        </div>
        {onAdd && <button onClick={onAdd} className="bg-white text-black text-[10px] font-black px-6 h-10 rounded-sm flex items-center justify-center gap-2 hover:bg-neutral-200 transition-all uppercase tracking-widest shadow-xl"><span className="material-symbols-outlined !text-[16px]">add</span> Add Record</button>}
      </div>

      <div className="bg-[#141414] border border-[#2A2A2A] rounded-sm overflow-hidden shadow-2xl">
        <div className="overflow-x-auto hide-scrollbar">
          <table className="w-full text-left border-collapse min-w-[800px] sm:min-w-full">
            <thead className="bg-[#1A1A1A] border-b border-[#2A2A2A]">
              <tr>{columns.map(col => <th key={col} className="px-4 lg:px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em]">{col}</th>)}<th className="px-4 lg:px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em] text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-[#2A2A2A]">
              {loading ? (<tr><td colSpan={columns.length + 1} className="text-center py-24 text-xs text-neutral-600 uppercase tracking-[0.4em] font-black">Connecting...</td></tr>) : data === null || data.length === 0 ? (<tr><td colSpan={columns.length + 1} className="text-center py-24 text-[10px] text-neutral-700 uppercase tracking-[0.5em] font-black italic">No records</td></tr>) : data.map((item, idx) => (
                <tr key={idx} className={`hover:bg-white/[0.02] transition-colors group ${trashView ? 'opacity-50' : ''}`}>
                  {columns.map(col => (<td key={col} className="px-4 lg:px-6 py-4"><span className="text-[12px] text-neutral-100 truncate block max-w-[150px] lg:max-w-[220px] font-medium" title={String(item[col] ?? '')}>{String(item[col] ?? '')}</span></td>))}
                  <td className="px-4 lg:px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 lg:opacity-0 lg:group-hover:opacity-100 transition-all transform lg:translate-x-2 lg:group-hover:translate-x-0">
                      {trashView ? (
                        <button onClick={() => onRestore && onRestore(item.id || item.Id)} className="p-1.5 hover:bg-green-500/10 rounded text-neutral-500 hover:text-green-500 transition-all"><span className="material-symbols-outlined !text-[18px]">settings_backup_restore</span></button>
                      ) : (onEdit && <button onClick={() => onEdit(item)} className="p-1.5 hover:bg-white/10 rounded text-neutral-500 hover:text-white transition-all"><span className="material-symbols-outlined !text-[18px]">edit</span></button>)}
                      <button onClick={() => onDelete(item.id || item.Id)} className="p-1.5 hover:bg-red-500/10 rounded text-neutral-500 hover:text-red-500 transition-all"><span className="material-symbols-outlined !text-[18px]">{trashView ? 'delete_forever' : 'delete'}</span></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MovieEditorView({ movie, onCancel, onSaved }: any) {
  const isEdit = !!movie;
  const [formData, setFormData] = useState(movie || { movieId: '', title: '', slug: '', description: '', releaseYear: 2024, movieType: 'movie' });
  const [isSlugManual, setIsSlugManual] = useState(false);
  const [isSlugLocked, setIsSlugLocked] = useState(isEdit);

  const toSlug = (text: string) => {
    let str = text.toLowerCase();
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/([^0-9a-z-\s])/g, '').replace(/(\s+)/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
    return str;
  };

  const handleSave = async () => {
    if (!formData.movieId || !formData.title || !formData.slug) return alert('Vui lòng nhập đủ thông tin!');
    const url = isEdit ? `${API_BASE}/admin/Movies/${movie.movieId}` : `${API_BASE}/admin/Movies`;
    const res = await fetch(url, { method: isEdit ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData) });
    if (res.ok) onSaved(); else alert('Lỗi khi lưu phim!');
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 max-w-7xl mx-auto px-2 lg:px-0">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12">
        <div className="space-y-1"><h2 className="text-3xl font-black text-white tracking-tighter uppercase">{isEdit ? 'Update Movie' : 'New Movie'}</h2></div>
        <div className="flex gap-4">
          <button onClick={onCancel} className="flex-1 lg:flex-none h-10 px-8 bg-neutral-900 text-neutral-400 border border-neutral-800 text-[10px] font-black uppercase tracking-widest hover:text-white transition-all">Cancel</button>
          <button onClick={handleSave} className="flex-1 lg:flex-none h-10 px-8 bg-white text-black text-[10px] font-black uppercase tracking-widest shadow-2xl">Publish</button>
        </div>
      </div>
      <div className="bg-neutral-900/50 border border-neutral-800 p-6 lg:p-10 space-y-8 rounded-sm shadow-2xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Movie ID</label>
            <input readOnly={isEdit} className="w-full bg-black border border-neutral-800 h-12 px-5 text-sm outline-none transition-all font-medium text-neutral-400" value={formData.movieId} onChange={e => setFormData({...formData, movieId: e.target.value})} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Movie Title</label>
            <input className="w-full bg-black border border-neutral-800 h-12 px-5 text-sm focus:border-white outline-none transition-all font-medium" value={formData.title} onChange={e => { const newTitle = e.target.value; const update: any = { title: newTitle }; if ((!isEdit || !isSlugLocked) && !isSlugManual) update.slug = toSlug(newTitle); setFormData({ ...formData, ...update }); }} />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest flex justify-between"><span>Slug</span></label>
          <input readOnly={isSlugLocked} className={`w-full bg-black border border-neutral-800 h-12 px-5 text-sm outline-none transition-all font-mono ${isSlugLocked ? 'text-neutral-600' : 'text-primary'}`} value={formData.slug} onChange={e => { setFormData({...formData, slug: toSlug(e.target.value)}); setIsSlugManual(true); }} />
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">Description</label>
          <textarea className="w-full bg-black border border-neutral-800 min-h-[200px] p-6 text-sm focus:border-white outline-none transition-all font-medium" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
        </div>
      </div>
    </div>
  );
}
