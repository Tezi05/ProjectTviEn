import React, { useState } from 'react';
import { AddModal, inp, sel, tex, lbl, toSlug } from '../../components/SharedUI';

const API_BASE = 'http://localhost:5113/api';

export default function PersonForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [f, setF] = useState({ fullName: '', slug: '', dob: '', gender: '', nationality: '', biography: '', avatarUrl: '' });
  const toSlug = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').replace(/([^0-9a-z-\s])/g, '').replace(/(\s+)/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  const submit = async () => {
    if (!f.fullName) return alert('Cần nhập FullName');
    const body = { ...f, gender: f.gender ? Number(f.gender) : null, dob: f.dob || null };
    const res = await fetch(`${API_BASE}/admin/persons`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (res.ok) { onSaved(); onClose(); } else alert('Lỗi: ' + await res.text());
  };

  return (
    <AddModal title="Thêm Person" onClose={onClose} onSubmit={submit}>
      <div><label className={lbl}>Tên đầy đủ *</label><input className={inp} value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value, slug: toSlug(e.target.value) })} /></div>
      <div className="mt-4"><label className={lbl}>Slug</label><input className={inp} value={f.slug} onChange={e => setF({ ...f, slug: toSlug(e.target.value) })} /></div>
      <div className="grid grid-cols-2 gap-4 mt-4">
        <div><label className={lbl}>Ngày sinh</label><input type="date" className={inp} value={f.dob} onChange={e => setF({ ...f, dob: e.target.value })} /></div>
        <div>
          <label className={lbl}>Giới tính</label>
          <select className={sel} value={f.gender} onChange={e => setF({ ...f, gender: e.target.value })}>
            <option value="">-- Chọn --</option><option value="1">Nam</option><option value="2">Nữ</option>
          </select>
        </div>
      </div>
      <div className="mt-4"><label className={lbl}>Quốc tịch</label><input className={inp} value={f.nationality} onChange={e => setF({ ...f, nationality: e.target.value })} /></div>
      <div className="mt-4"><label className={lbl}>Tiểu sử</label><textarea className={tex} value={f.biography} onChange={e => setF({ ...f, biography: e.target.value })} /></div>
    </AddModal>
  );
}
