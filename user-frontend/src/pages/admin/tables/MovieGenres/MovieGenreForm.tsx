import React, { useState } from 'react';
import { API_BASE } from '../../config';
import { AddModal } from '../../components/SharedUI';
import { AutocompleteInput, ACOption } from '../../autocomplete';

export default function MovieGenreForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [selMovie, setSelMovie] = useState<ACOption[]>([]);
  const [selGenre, setSelGenre] = useState<ACOption[]>([]);

  const mapMovie = (m: any): ACOption => ({ id: m.id || m.movieId, label: m.title, avatar: m.posterUrl ?? '', sub: m.slug });
  const mapGenre = (g: any): ACOption => ({ id: g.genreId, label: g.name, sub: g.slug });

  const submit = async () => {
    if (!selMovie[0] || !selGenre[0]) return alert('Cần chọn cả Movie và Genre');
    const res = await fetch(`${API_BASE}/admin/system/tables/MovieGenres`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId: selMovie[0].id, genreId: Number(selGenre[0].id) })
    });
    if (res.ok) { onSaved(); onClose(); } else alert('Lỗi: ' + await res.text());
  };

  return (
    <AddModal title="Gán Genre cho Movie" onClose={onClose} onSubmit={submit}>
      <AutocompleteInput label="Movie *" placeholder="Gõ tên phim..."
        searchUrl={kw => `${API_BASE}/admin/Movies/search?keyword=${encodeURIComponent(kw)}`}
        mapResult={mapMovie} selected={selMovie} onChange={setSelMovie} multiple={false} />
      <AutocompleteInput label="Genre *" placeholder="Gõ tên thể loại..."
        searchUrl={kw => `${API_BASE}/admin/system/tables/Genres?isDeleted=false`}
        mapResult={mapGenre} selected={selGenre} onChange={setSelGenre} multiple={false} />
    </AddModal>
  );
}
