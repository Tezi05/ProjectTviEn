import React, { useState, useEffect } from 'react';
import { GenericListView } from '../../components/GenericListView';
import { API_BASE } from '../../config';
import EpisodeForm from './EpisodeForm';

export default function EpisodesTable({ fetchStats }: any) {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [trashView, setTrashView] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/system/tables/Episodes?isDeleted=${trashView}`);
      if (res.ok) setData(await res.json());
      else setError("Không thể tải danh sách tập phim");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [trashView]);

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

  return (
    <GenericListView 
      title="Episodes"
      data={data}
      loading={loading}
      error={error}
      trashView={trashView}
      onTabChange={setTrashView}
      onAdd={() => { setEditingItem(null); setView('editor'); }}
      onEdit={(item: any) => { setEditingItem(item); setView('editor'); }}
      onDelete={handleDelete}
      onRestore={handleRestore}
    />
  );
}
