import React, { useState, useEffect } from 'react';
import { GenericListView } from '../../components/GenericListView';
import { API_BASE } from '../../config';

interface MoviesListProps {
  fetchStats: () => void;
  onAdd: () => void;
  onEdit: (item: any) => void;
}

export default function MoviesList({ fetchStats, onAdd, onEdit }: MoviesListProps) {
  const [trashView, setTrashView] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/system/tables/Movies?isDeleted=${trashView}`);
      if (res.ok) setData(await res.json());
      else setError("Không thể tải danh sách phim");
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [trashView]);

  const handleDelete = async (item: any) => {
    const id = item.id || item.movieId || item.Id;
    if (trashView) {
      if (!confirm(`⚠️ Xóa VĨNH VIỄN phim này?`)) return;
      await fetch(`${API_BASE}/admin/system/tables/Movies/${id}/force`, { method: 'DELETE' });
    } else {
      if (!confirm(`Ẩn phim này vào Thùng rác?`)) return;
      await fetch(`${API_BASE}/admin/system/tables/Movies/${id}`, { method: 'DELETE' });
    }
    fetchData(); fetchStats();
  };

  const handleRestore = async (item: any) => {
    const id = item.id || item.movieId || item.Id;
    await fetch(`${API_BASE}/admin/system/tables/Movies/${id}/restore`, { method: 'POST' });
    fetchData(); fetchStats();
  };

  return (
    <GenericListView 
      title="Movies"
      data={data}
      loading={loading}
      error={error}
      trashView={trashView}
      onTabChange={setTrashView}
      onAdd={onAdd}
      onEdit={onEdit}
      onDelete={handleDelete}
      onRestore={handleRestore}
    />
  );
}
