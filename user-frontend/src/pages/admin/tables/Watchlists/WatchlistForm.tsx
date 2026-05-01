import React, { useState } from 'react';
import { API_BASE } from '../../config';
import { AddModal } from '../../components/SharedUI';
import { AutocompleteInput, ACOption } from '../../autocomplete';

export default function WatchlistForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [selUser, setSelUser] = useState<ACOption[]>([]);
  const [selMovie, setSelMovie] = useState<ACOption[]>([]);

  const mapUser = (u: any): ACOption => ({ id: u.userId || u.id, label: u.displayName || u.userName, avatar: u.avatarUrl ?? '', sub: u.email });
  const mapMovie = (m: any): ACOption => ({ id: m.id || m.movieId, label: m.title, avatar: m.posterUrl ?? '', sub: m.slug });

  const submit = async () => {
    if (!selUser[0] || !selMovie[0]) return alert('Cần chọn User và Movie');
    const res = await fetch(`${API_BASE}/admin/system/tables/Watchlists`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selUser[0].id, movieId: selMovie[0].id })
    });
    if (res.ok) { onSaved(); onClose(); } else alert('Lỗi: ' + await res.text());
  };

  return (
    <AddModal title="Thêm vào Watchlist" onClose={onClose} onSubmit={submit}>
      <AutocompleteInput label="User *" placeholder="Gõ tên user..."
        searchUrl={kw => `${API_BASE}/admin/system/tables/Users?isDeleted=false`}
        mapResult={mapUser} selected={selUser} onChange={setSelUser} multiple={false} />
      <AutocompleteInput label="Movie *" placeholder="Gõ tên phim..."
        searchUrl={kw => `${API_BASE}/admin/Movies/search?keyword=${encodeURIComponent(kw)}`}
        mapResult={mapMovie} selected={selMovie} onChange={setSelMovie} multiple={false} />
    </AddModal>
  );
}
