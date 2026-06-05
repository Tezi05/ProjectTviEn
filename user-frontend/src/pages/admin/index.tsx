import React, { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { API_BASE, CDN_BASE } from './config';

// --- IMPORT TABLES (MODULAR) ---
import MoviesTable from './tables/Movies';
import GenresTable from './tables/Genres';
import PersonsTable from './tables/Persons';
import EpisodesTable from './tables/Episodes';
import UsersTable from './tables/Users';
import RolesTable from './tables/Roles';
import ReviewsTable from './tables/Reviews';
import WatchlistsTable from './tables/Watchlists';
import MovieGenresTable from './tables/MovieGenres';
import MovieCrewsTable from './tables/MovieCrews';
import VideosTable from './tables/Videos';
import IngestJobsTable from './tables/IngestJobs';
import MediaAssetsTable from './tables/MediaAssets';
import StreamsTable from './tables/Streams';
import WatchHistoriesTable from './tables/WatchHistories';
import BaseTable from './tables/BaseTable';
import SeasonsTable from './tables/Seasons';

const ALL_TABLES = [
  { id: 'Movies', label: '🎬 Titles', icon: 'movie', group: 'CONTENT' },
  { id: 'Seasons', label: '📁 Seasons', icon: 'folder_special', group: 'CONTENT' },
  { id: 'Genres', label: '🏷️ Genres', icon: 'category', group: 'CONTENT' },
  { id: 'Persons', label: '⭐ People', icon: 'group', group: 'CONTENT' },
  { id: 'Episodes', label: '📺 Episodes', icon: 'subscriptions', group: 'CONTENT' },
  { id: 'Videos', label: '📹 Videos (HLS)', icon: 'account_tree', group: 'SYSTEM' },
  { id: 'IngestJobs', label: '⚙️ Ingest Jobs', icon: 'terminal', group: 'SYSTEM' },
  { id: 'MediaAssets', label: '📦 Media Assets', icon: 'inventory_2', group: 'SYSTEM' },
  { id: 'Streams', label: '📡 Delivery Nodes', icon: 'settings_input_antenna', group: 'SYSTEM' },
  { id: 'Users', label: '👥 Users', icon: 'person', group: 'USER DATA' },
  { id: 'Reviews', label: '💬 Reviews', icon: 'rate_review', group: 'USER DATA' },
  { id: 'WatchHistories', label: '🕒 History', icon: 'history', group: 'USER DATA' },
  { id: 'Watchlists', label: '🔖 Watchlists', icon: 'bookmarks', group: 'USER DATA' },
  { id: 'Roles', label: '🛡️ Roles', icon: 'verified_user', group: 'USER DATA' },
  { id: 'MovieGenres', label: '🔗 Title-Genre', icon: 'link', group: 'RELATIONS' },
  { id: 'MovieCrews', label: '🔗 Title-Crew', icon: 'link', group: 'RELATIONS' },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [activeTable, setActiveTable] = useState('Overview');
  const [stats, setStats] = useState<Record<string, number>>({});
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/system/stats`);
      if (res.ok) setStats(await res.json());
    } catch (err) {}
  }, []);

  useEffect(() => {
    setMounted(true);
    if (!router.isReady) return;
    const { table } = router.query;
    if (table) setActiveTable(table as string);
    fetchStats();
  }, [router.isReady, router.query, fetchStats]);

  if (!mounted) return null; // Tránh hydration mismatch ở cấp độ cao nhất

  const navigateTo = (table: string) => {
    setActiveTable(table);
    router.push(`/admin?table=${table}`, undefined, { shallow: true });
    setIsSidebarOpen(false);
  };

  const renderActiveTable = () => {
    if (activeTable === 'Overview') return <Overview stats={stats} onSelect={(t: string) => navigateTo(t)} />;
    
    const props = { fetchStats };

    switch (activeTable) {
      case 'Movies': return <MoviesTable {...props} />;
      case 'Seasons': return <SeasonsTable />;
      case 'Genres': return <GenresTable {...props} />;
      case 'Persons': return <PersonsTable {...props} />;
      case 'Episodes': return <EpisodesTable {...props} />;
      case 'Users': return <UsersTable {...props} />;
      case 'Roles': return <RolesTable {...props} />;
      case 'Reviews': return <ReviewsTable {...props} />;
      case 'Watchlists': return <WatchlistsTable {...props} />;
      case 'MovieGenres': return <MovieGenresTable {...props} />;
      case 'MovieCrews': return <MovieCrewsTable {...props} />;
      case 'Videos': return <VideosTable {...props} />;
      case 'IngestJobs': return <IngestJobsTable {...props} />;
      case 'MediaAssets': return <MediaAssetsTable {...props} />;
      case 'Streams': return <StreamsTable {...props} />;
      case 'WatchHistories': return <WatchHistoriesTable {...props} />;
      default: return <BaseTable tableName={activeTable} title={activeTable} {...props} />;
    }
  };

  return (
    <div className="flex h-screen bg-black text-neutral-200 font-sans selection:bg-white selection:text-black overflow-hidden">
      <Head><title>TviEn | Admin Alpha</title></Head>
      
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#050505] border-r border-neutral-900 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 transition-transform duration-500 ease-in-out`}>
        <div className="flex flex-col h-full">
          <div className="p-8">
            <div className="text-2xl font-black text-white tracking-tighter uppercase mb-1">TviEn <span className="text-primary text-[10px] tracking-widest align-top ml-1">ALPHA</span></div>
            <p className="text-[9px] text-neutral-600 font-bold uppercase tracking-[0.3em]">Management Console</p>
          </div>
          <nav className="flex-1 overflow-y-auto px-4 space-y-10 py-4 custom-scrollbar hide-scrollbar">
            <button onClick={() => navigateTo('Overview')} className={`w-full flex items-center gap-4 px-4 py-3 rounded-sm transition-all ${activeTable === 'Overview' ? 'bg-white text-black font-black shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'text-neutral-500 hover:text-white'}`}>
              <span className="material-symbols-outlined text-xl">dashboard</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Dashboard</span>
            </button>
            {['CONTENT', 'SYSTEM', 'USER DATA', 'RELATIONS'].map(group => (
              <div key={group}>
                <div className="px-4 mb-4 text-[9px] font-black text-neutral-700 uppercase tracking-[0.4em]">{group}</div>
                <div className="space-y-1">
                  {ALL_TABLES.filter(t => t.group === group).map(table => (
                    <button key={table.id} onClick={() => navigateTo(table.id)} className={`w-full flex items-center justify-between px-4 py-2.5 rounded-sm transition-all group ${activeTable === table.id ? 'bg-neutral-800 text-white font-bold' : 'text-neutral-600 hover:text-neutral-300'}`}>
                      <div className="flex items-center gap-4"><span className={`material-symbols-outlined text-lg ${activeTable === table.id ? 'text-primary' : 'text-neutral-800 group-hover:text-neutral-600'}`}>{table.icon}</span><span className="text-[10px] uppercase tracking-wider">{table.label}</span></div>
                      {stats[table.id] > 0 && <span className="text-[9px] font-black opacity-40">{stats[table.id]}</span>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
          <div className="p-6 border-t border-neutral-900 bg-black/40">
             <button onClick={() => router.push('/')} className="w-full py-3 bg-neutral-900 border border-neutral-800 text-[9px] font-black text-neutral-500 uppercase tracking-widest hover:text-white hover:bg-neutral-800 transition-all rounded-sm">Exit System</button>
          </div>
        </div>
      </aside>

      {/* MOBILE HEADER */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-black border-b border-neutral-900 flex items-center justify-between px-6 z-40">
        <div className="text-xl font-black text-white tracking-tighter uppercase">TviEn</div>
        <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-white material-symbols-outlined">menu</button>
      </div>

      {/* MAIN CONTENT */}
      <main className="flex-1 lg:ml-72 overflow-y-auto bg-black min-h-screen pt-20 lg:pt-0">
        <div className="max-w-[1600px] mx-auto p-6 lg:p-12 animate-in fade-in duration-700">
          {renderActiveTable()}
        </div>
      </main>

      <style jsx global>{`
        html, body, #__next { overflow: hidden; height: 100%; -ms-overflow-style: none; scrollbar-width: none; }
        html::-webkit-scrollbar, body::-webkit-scrollbar, #__next::-webkit-scrollbar { display: none; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; overflow-y: auto; overflow-x: auto; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 10px; }
      `}</style>
    </div>
  );
}

function Overview({ stats, onSelect }: any) {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="mb-12"><h1 className="text-4xl font-black text-white tracking-tighter uppercase mb-2">System Overview</h1><p className="text-[10px] text-neutral-500 uppercase tracking-[0.3em]">Theo dõi hệ thống.</p></div>
      {['CONTENT', 'SYSTEM', 'USER DATA', 'RELATIONS'].map(group => (
        <div key={group} className="mb-12">
          <div className="flex items-center gap-4 mb-6"><div className="h-px flex-1 bg-neutral-900"></div><h2 className="text-[10px] font-black text-neutral-600 tracking-[0.5em] uppercase">{group}</h2><div className="h-px flex-1 bg-neutral-900"></div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {ALL_TABLES.filter(t => t.group === group).map(table => {
              const count = stats[table.id] || 0;
              const hasData = count > 0;
              return (
                <button key={table.id} onClick={() => onSelect(table.id)} className={`p-6 border text-left transition-all duration-300 group relative overflow-hidden rounded-sm hover:-translate-y-1 hover:shadow-[0_10px_30px_-10px_rgba(255,255,255,0.1)] ${hasData ? 'bg-neutral-800/50 border-neutral-700 hover:border-white hover:bg-neutral-800' : 'bg-neutral-900/50 border-neutral-800 hover:border-neutral-500'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <span 
                      className={`material-symbols-outlined text-2xl transition-colors ${hasData ? 'text-primary group-hover:text-white' : 'text-neutral-700 group-hover:text-white'}`} 
                      style={hasData ? { fontVariationSettings: "'FILL' 1" } : {}}
                    >
                      {table.icon}
                    </span>
                    <span className={`text-[9px] font-black px-2 py-1 rounded transition-colors ${hasData ? 'bg-green-500/20 text-green-400 group-hover:bg-white group-hover:text-black' : 'bg-neutral-900 text-neutral-700 group-hover:bg-white group-hover:text-black'}`}>{hasData ? 'ACTIVE' : 'EMPTY'}</span>
                  </div>
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
