import React, { useState, useEffect } from 'react';
import { GenericListView } from '../components/GenericListView';
import { API_BASE } from '../config';

interface BaseTableProps {
  tableName: string;
  title: string;
  fetchStats: () => void;
  FormComponent?: React.FC<{ onSaved: () => void; onClose: () => void }>;
}

export default function BaseTable({ tableName, title, fetchStats, FormComponent }: BaseTableProps) {
  const [trashView, setTrashView] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/system/tables/${tableName}?isDeleted=${trashView}`);
      if (res.ok) setData(await res.json());
      else setError(`Không thể tải dữ liệu bảng ${title}`);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [trashView, tableName]);

  const handleDelete = async (item: any) => {
    const id = item.id || item.Id || item.genreId || item.userId || item.roleId;
    if (trashView) {
      if (!confirm(`⚠️ Xóa VĨNH VIỄN mục này?`)) return;
      await fetch(`${API_BASE}/admin/system/tables/${tableName}/${id}/force`, { method: 'DELETE' });
    } else {
      if (!confirm(`Ẩn mục này vào Thùng rác?`)) return;
      await fetch(`${API_BASE}/admin/system/tables/${tableName}/${id}`, { method: 'DELETE' });
    }
    fetchData(); fetchStats();
  };

  const handleRestore = async (item: any) => {
    const id = item.id || item.Id || item.genreId || item.userId || item.roleId;
    await fetch(`${API_BASE}/admin/system/tables/${tableName}/${id}/restore`, { method: 'POST' });
    fetchData(); fetchStats();
  };

  return (
    <>
      <GenericListView 
        title={title}
        data={data}
        loading={loading}
        error={error}
        trashView={trashView}
        onTabChange={setTrashView}
        onAdd={FormComponent ? () => setIsAdding(true) : undefined}
        onEdit={undefined} // Hầu hết các bảng phụ chỉ cần Thêm/Xóa
        onDelete={handleDelete}
        onRestore={handleRestore}
      />
      {isAdding && FormComponent && (
        <FormComponent 
          onSaved={() => { setIsAdding(false); fetchData(); fetchStats(); }} 
          onClose={() => setIsAdding(false)} 
        />
      )}
    </>
  );
}
