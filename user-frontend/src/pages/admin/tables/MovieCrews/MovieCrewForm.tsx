import React, { useState } from 'react';
import { API_BASE } from '../../config';
import { AddModal, Field, sel, inp } from '../../components/SharedUI';
import { AutocompleteInput, ACOption } from '../../autocomplete';

export default function MovieCrewForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [selMovie, setSelMovie] = useState<ACOption[]>([]);
  const [selPersons, setSelPersons] = useState<ACOption[]>([]);
  const [role, setRole] = useState('Actor');
  const [charName, setCharName] = useState('');

  const mapMovie = (m: any): ACOption => ({ id: m.id || m.movieId, label: m.title, avatar: m.posterUrl ?? '', sub: m.slug });
  const mapPerson = (p: any): ACOption => ({ id: p.id, label: p.fullName, avatar: p.avatarUrl ?? '', sub: [p.nationality, p.dob ? new Date(p.dob).getFullYear() : null].filter(Boolean).join(' · ') });

  const submit = async () => {
    if (!selMovie[0] || selPersons.length === 0) return alert('Cần chọn Movie và ít nhất 1 người');
    const saves = selPersons.map(p =>
      fetch(`${API_BASE}/admin/crew`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ movieId: selMovie[0].id, personId: p.id, role, characterName: charName || null })
      })
    );
    const results = await Promise.all(saves);
    if (results.every(r => r.ok)) { onSaved(); onClose(); }
    else alert('Một số bản ghi lưu thất bại');
  };

  return (
    <AddModal title="Thêm thành viên đoàn làm phim" onClose={onClose} onSubmit={submit}>
      <AutocompleteInput label="Movie *" placeholder="Gõ tên phim để tìm..."
        searchUrl={kw => `${API_BASE}/admin/Movies/search?keyword=${encodeURIComponent(kw)}`}
        mapResult={mapMovie} selected={selMovie} onChange={setSelMovie} multiple={false} />

      <AutocompleteInput label="Người (chọn nhiều) *" placeholder="Gõ tên diễn viên / đạo diễn..."
        searchUrl={kw => `${API_BASE}/admin/persons/search?keyword=${encodeURIComponent(kw)}&limit=10`}
        mapResult={mapPerson} selected={selPersons} onChange={setSelPersons} multiple={true} />

      <Field label="Vai trò *">
        <select className={sel} value={role} onChange={e => setRole(e.target.value)}>
          <option value="Director">Director — Đạo diễn</option>
          <option value="Actor">Actor — Diễn viên</option>
          <option value="Writer">Writer — Biên kịch</option>
          <option value="Producer">Producer — Nhà sản xuất</option>
        </select>
      </Field>

      {role === 'Actor' && (
        <Field label="Tên nhân vật trong phim">
          <input className={inp} value={charName} onChange={e => setCharName(e.target.value)} placeholder="Tony Stark, Mai..." />
        </Field>
      )}
    </AddModal>
  );
}
