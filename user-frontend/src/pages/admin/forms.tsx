import React, { useState } from 'react';
import { AutocompleteInput, ACOption } from './autocomplete';

const API_BASE = 'http://localhost:5113/api';

// ── Shared UI ──────────────────────────────────────────────────────────────
const inp = "w-full bg-black border border-neutral-800 h-11 px-4 text-sm text-white focus:border-white outline-none transition-all rounded-sm";
const sel = "w-full bg-black border border-neutral-800 h-11 px-4 text-sm text-white focus:border-white outline-none transition-all rounded-sm";
const tex = "w-full bg-black border border-neutral-800 p-4 text-sm text-white focus:border-white outline-none transition-all rounded-sm min-h-[100px]";
const lbl = "block text-[9px] font-black text-neutral-500 uppercase tracking-[0.25em] mb-1";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={lbl}>{label}</label>{children}</div>;
}

const toSlug = (text: string) => {
  let str = text.toLowerCase();
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  str = str.replace(/[đĐ]/g, 'd');
  str = str.replace(/([^0-9a-z-\s])/g, '');
  str = str.replace(/(\s+)/g, '-');
  str = str.replace(/-+/g, '-');
  str = str.replace(/^-+|-+$/g, '');
  return str;
};

// ── AddModal ───────────────────────────────────────────────────────────────
interface ModalProps { title: string; onClose: () => void; onSubmit: () => Promise<void>; children: React.ReactNode; }

export function AddModal({ title, onClose, onSubmit, children }: ModalProps) {
  const [saving, setSaving] = useState(false);
  const handle = async () => { setSaving(true); try { await onSubmit(); } finally { setSaving(false); } };
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-neutral-950 border border-neutral-800 rounded-sm w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto hide-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 sticky top-0 bg-neutral-950 z-10">
          <h2 className="text-sm font-black text-white uppercase tracking-widest">+ {title}</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white material-symbols-outlined text-[20px]">close</button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
        <div className="flex gap-3 p-6 border-t border-neutral-800">
          <button onClick={onClose} className="flex-1 h-10 border border-neutral-700 text-neutral-400 text-[10px] font-black uppercase tracking-widest hover:border-white hover:text-white transition-all rounded-sm">Cancel</button>
          <button onClick={handle} disabled={saving} className="flex-1 h-10 bg-white text-black text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all rounded-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Map helpers ────────────────────────────────────────────────────────────
const mapPerson = (p: any): ACOption => ({
  id: p.id,
  label: p.fullName,
  avatar: p.avatarUrl ?? '',
  sub: [p.nationality, p.dob ? new Date(p.dob).getFullYear() : null].filter(Boolean).join(' · '),
});

const mapMovie = (m: any): ACOption => ({
  id: m.id || m.movieId,
  label: m.title,
  avatar: m.posterUrl ?? '',
  sub: m.slug,
});

const mapUser = (u: any): ACOption => ({
  id: u.userId,
  label: u.displayName,
  avatar: u.avatarUrl ?? '',
  sub: u.email,
});

// ── GENRE ──────────────────────────────────────────────────────────────────
export function AddGenreForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
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
      <Field label="Name *"><input className={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value, slug: toSlug(e.target.value) })} placeholder="Hành động" /></Field>
      <Field label="Slug"><input className={inp} value={f.slug} onChange={e => setF({ ...f, slug: toSlug(e.target.value) })} placeholder="hanh-dong" /></Field>
    </AddModal>
  );
}

// ── PERSON ─────────────────────────────────────────────────────────────────
export function AddPersonForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [f, setF] = useState({ fullName: '', slug: '', dob: '', gender: '', nationality: '', biography: '', avatarUrl: '' });
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
      <Field label="Tên đầy đủ *"><input className={inp} value={f.fullName} onChange={e => setF({ ...f, fullName: e.target.value, slug: toSlug(e.target.value) })} placeholder="Christopher Nolan" /></Field>
      <Field label="Slug"><input className={inp} value={f.slug} onChange={e => setF({ ...f, slug: toSlug(e.target.value) })} placeholder="christopher-nolan" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Ngày sinh"><input type="date" className={inp} value={f.dob} onChange={e => setF({ ...f, dob: e.target.value })} /></Field>
        <Field label="Giới tính">
          <select className={sel} value={f.gender} onChange={e => setF({ ...f, gender: e.target.value })}>
            <option value="">-- Chọn --</option><option value="1">Nam</option><option value="2">Nữ</option>
          </select>
        </Field>
      </div>
      <Field label="Quốc tịch"><input className={inp} value={f.nationality} onChange={e => setF({ ...f, nationality: e.target.value })} placeholder="American" /></Field>
      <Field label="Avatar URL"><input className={inp} value={f.avatarUrl} onChange={e => setF({ ...f, avatarUrl: e.target.value })} placeholder="https://..." /></Field>
      <Field label="Tiểu sử"><textarea className={tex} value={f.biography} onChange={e => setF({ ...f, biography: e.target.value })} /></Field>
    </AddModal>
  );
}

// ── EPISODE — Autocomplete Movie ───────────────────────────────────────────
export function AddEpisodeForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [selectedMovie, setSelectedMovie] = useState<ACOption[]>([]);
  const [f, setF] = useState({ seasonNumber: 1, episodeNumber: 1, title: '', description: '', duration: '', airDate: '' });

  const submit = async () => {
    if (!selectedMovie[0]) return alert('Cần chọn Movie');
    const body = { movieId: selectedMovie[0].id, ...f, seasonNumber: Number(f.seasonNumber), episodeNumber: Number(f.episodeNumber), duration: f.duration ? Number(f.duration) : null, airDate: f.airDate || null };
    const res = await fetch(`${API_BASE}/admin/system/tables/Episodes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    });
    if (res.ok) { onSaved(); onClose(); } else alert('Lỗi: ' + await res.text());
  };

  return (
    <AddModal title="Thêm Episode" onClose={onClose} onSubmit={submit}>
      <AutocompleteInput
        label="Movie *"
        placeholder="Gõ tên phim để tìm..."
        searchUrl={kw => `${API_BASE}/admin/Movies/search?keyword=${encodeURIComponent(kw)}&limit=10`}
        mapResult={mapMovie}
        selected={selectedMovie}
        onChange={setSelectedMovie}
        multiple={false}
      />
      <div className="grid grid-cols-2 gap-4">
        <Field label="Season"><input type="number" className={inp} value={f.seasonNumber} onChange={e => setF({ ...f, seasonNumber: +e.target.value })} min={1} /></Field>
        <Field label="Episode"><input type="number" className={inp} value={f.episodeNumber} onChange={e => setF({ ...f, episodeNumber: +e.target.value })} min={1} /></Field>
      </div>
      <Field label="Tiêu đề tập"><input className={inp} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="Tập 1: Khởi đầu" /></Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Thời lượng (giây)"><input type="number" className={inp} value={f.duration} onChange={e => setF({ ...f, duration: e.target.value })} placeholder="2700" /></Field>
        <Field label="Ngày phát sóng"><input type="date" className={inp} value={f.airDate} onChange={e => setF({ ...f, airDate: e.target.value })} /></Field>
      </div>
      <Field label="Mô tả"><textarea className={tex} value={f.description} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
    </AddModal>
  );
}

// ── ROLE ───────────────────────────────────────────────────────────────────
export function AddRoleForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const submit = async () => {
    if (!name) return alert('Cần nhập tên Role');
    const res = await fetch(`${API_BASE}/admin/system/tables/Roles`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
    });
    if (res.ok) { onSaved(); onClose(); } else alert('Lỗi: ' + await res.text());
  };
  return (
    <AddModal title="Thêm Role" onClose={onClose} onSubmit={submit}>
      <Field label="Tên Role *"><input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Admin / VIP / Member" /></Field>
    </AddModal>
  );
}

// ── MOVIE-GENRE — Autocomplete Movie + Genre ───────────────────────────────
export function AddMovieGenreForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [selMovie, setSelMovie] = useState<ACOption[]>([]);
  const [selGenre, setSelGenre] = useState<ACOption[]>([]);

  const submit = async () => {
    if (!selMovie[0] || !selGenre[0]) return alert('Cần chọn cả Movie và Genre');
    const res = await fetch(`${API_BASE}/admin/system/tables/MovieGenres`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ movieId: selMovie[0].id, genreId: Number(selGenre[0].id) })
    });
    if (res.ok) { onSaved(); onClose(); } else alert('Lỗi: ' + await res.text());
  };

  const mapGenre = (g: any): ACOption => ({ id: g.genreId, label: g.name, sub: g.slug });

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

// ── MOVIE-CREW — Autocomplete Movie + Person ───────────────────────────────
export function AddMovieCrewForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [selMovie, setSelMovie] = useState<ACOption[]>([]);
  const [selPersons, setSelPersons] = useState<ACOption[]>([]);
  const [role, setRole] = useState('Actor');
  const [charName, setCharName] = useState('');

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

      {selPersons.length > 0 && (
        <div className="p-3 bg-neutral-900 rounded-sm border border-neutral-800 text-[11px] text-neutral-500">
          Sẽ thêm <strong className="text-white">{selPersons.length}</strong> người với vai trò <strong className="text-white">{role}</strong> vào phim <strong className="text-white">{selMovie[0]?.label ?? '...'}</strong>
        </div>
      )}
    </AddModal>
  );
}

// ── USER ───────────────────────────────────────────────────────────────────
export function AddUserForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [f, setF] = useState({ googleId: '', email: '', displayName: '', avatarUrl: '', roleId: '3' });
  const submit = async () => {
    if (!f.email || !f.displayName) return alert('Cần nhập Email và DisplayName');
    const res = await fetch(`${API_BASE}/admin/system/tables/Users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, roleId: Number(f.roleId) })
    });
    if (res.ok) { onSaved(); onClose(); } else alert('Lỗi: ' + await res.text());
  };
  return (
    <AddModal title="Thêm User" onClose={onClose} onSubmit={submit}>
      <Field label="Email *"><input type="email" className={inp} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="user@gmail.com" /></Field>
      <Field label="Display Name *"><input className={inp} value={f.displayName} onChange={e => setF({ ...f, displayName: e.target.value })} placeholder="Nguyễn Văn A" /></Field>
      <Field label="Google ID"><input className={inp} value={f.googleId} onChange={e => setF({ ...f, googleId: e.target.value })} placeholder="google-sub-id" /></Field>
      <Field label="Avatar URL"><input className={inp} value={f.avatarUrl} onChange={e => setF({ ...f, avatarUrl: e.target.value })} placeholder="https://..." /></Field>
      <Field label="Role">
        <select className={sel} value={f.roleId} onChange={e => setF({ ...f, roleId: e.target.value })}>
          <option value="1">Admin</option><option value="2">VIP</option><option value="3">Member</option>
        </select>
      </Field>
    </AddModal>
  );
}

// ── REVIEW — Autocomplete User + Movie ─────────────────────────────────────
export function AddReviewForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [selUser, setSelUser] = useState<ACOption[]>([]);
  const [selMovie, setSelMovie] = useState<ACOption[]>([]);
  const [rating, setRating] = useState(8);
  const [content, setContent] = useState('');

  const submit = async () => {
    if (!selUser[0] || !selMovie[0]) return alert('Cần chọn User và Movie');
    const res = await fetch(`${API_BASE}/admin/system/tables/Reviews`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: selUser[0].id, movieId: selMovie[0].id, rating, content })
    });
    if (res.ok) { onSaved(); onClose(); } else alert('Lỗi: ' + await res.text());
  };

  return (
    <AddModal title="Thêm Review" onClose={onClose} onSubmit={submit}>
      <AutocompleteInput label="User *" placeholder="Gõ tên hoặc email user..."
        searchUrl={kw => `${API_BASE}/admin/system/tables/Users?isDeleted=false`}
        mapResult={mapUser} selected={selUser} onChange={setSelUser} multiple={false} />
      <AutocompleteInput label="Movie *" placeholder="Gõ tên phim..."
        searchUrl={kw => `${API_BASE}/admin/Movies/search?keyword=${encodeURIComponent(kw)}`}
        mapResult={mapMovie} selected={selMovie} onChange={setSelMovie} multiple={false} />
      <div>
        <label className={lbl}>Điểm: <strong className="text-white text-base ml-1">{rating}/10</strong></label>
        <input type="range" min={1} max={10} value={rating} onChange={e => setRating(+e.target.value)} className="w-full accent-white mt-2" />
      </div>
      <Field label="Nội dung nhận xét">
        <textarea className={tex} value={content} onChange={e => setContent(e.target.value)} placeholder="Phim rất hay..." />
      </Field>
    </AddModal>
  );
}

// ── WATCHLIST — Autocomplete User + Movie ──────────────────────────────────
export function AddWatchlistForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [selUser, setSelUser] = useState<ACOption[]>([]);
  const [selMovie, setSelMovie] = useState<ACOption[]>([]);

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
