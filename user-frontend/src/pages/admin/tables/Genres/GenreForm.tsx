import React, { useState } from 'react';
import { AddModal, inp, lbl, toSlug } from '../../components/SharedUI';

const API_BASE = 'http://localhost:5113/api';

export default function GenreForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [f, setF] = useState({ name: '', slug: '' });

  const submit = async () => {
    if (!f.name || !f.slug) return alert('Cần nhập Name và Slug');
    const res = await fetch(`${API_BASE}/admin/system/tables/Genres`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f)
    });
    if (res.ok) { onSaved(); onClose(); } else alert('Lỗi: ' + await res.text());
  };

  return (
    <AddModal title="Thêm Genre" onClose={onClose} onSubmit={submit}>
      <div><label className={lbl}>Name *</label><input className={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value, slug: toSlug(e.target.value) })} /></div>
      <div className="mt-4"><label className={lbl}>Slug</label><input className={inp} value={f.slug} onChange={e => setF({ ...f, slug: toSlug(e.target.value) })} /></div>
    </AddModal>
  );
}
