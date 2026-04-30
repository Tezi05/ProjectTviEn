"use client"

import { useEffect, useState, useCallback, memo, useMemo } from 'react';
import {
  CButton, CCard, CCardBody, CCardHeader, CCol, CContainer, CNavbar, CNavbarBrand, CRow,
  CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow, CBadge,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter, CFormInput, CProgress,
  CProgressBar, CListGroup, CListGroupItem, CSpinner
} from '@coreui/react'

// ---- CONSTANTS ----
const ENTITIES = [
  { id: 'movies',   label: '🎬 Movies',   api: 'admin/Movies' },
  { id: 'genres',   label: '🏷️ Genres',   api: 'admin/Genres' },
  { id: 'users',    label: '👥 Users',    api: 'admin/Users' },
  { id: 'episodes', label: '📺 Episodes', api: 'admin/Episodes' },
  { id: 'persons',  label: '⭐ Persons',  api: 'admin/Persons' },
  { id: 'videos',   label: '📹 Videos',   api: 'admin/Videos' }
];

const SKIP_KEYS = ['passwordHash', 'securityStamp', 'concurrencyStamp', 'normalizedUserName', 'normalizedEmail', 'accessFailedCount', 'lockoutEnabled', 'emailConfirmed', 'phoneNumberConfirmed', 'twoFactorEnabled', 'lockoutEnd', 'description', 'posterUrl', 'videoUrl', 'slug', 'profilePhotoUrl', 'avatarUrl', 'roleId', 'createdAt', 'updatedAt', 'lastLoginAt', 'finishedAt', 'encryptionKey'];

// ---- SUB-COMPONENTS (MEMOIZED FOR PERFORMANCE) ----
const DataRow = memo(({ item, keys, onEdit, onDelete }: any) => {
  const id = item.id || item.Id || item.movieId || item.MovieId || item.genreId || item.GenreId || item.personId || item.PersonId;
  
  return (
    <CTableRow>
      {keys.map((k: string) => {
        const val = item[k];
        const kl = k.toLowerCase();
        if (kl.includes('jobstatus')) {
          const st = (val?.status || val?.Status || 'none').toLowerCase();
          return <CTableDataCell key={k}><CBadge color={st==='done'?'success':st==='none'?'secondary':'warning'}>{st.toUpperCase()}</CBadge></CTableDataCell>;
        }
        const sVal = String(val ?? '');
        const limit = kl.includes('id') ? 10 : 20;
        return <CTableDataCell key={k} title={sVal.length>limit?sVal:''}><span className="small text-secondary">{sVal.length>limit?sVal.substring(0,limit-3)+'...':sVal}</span></CTableDataCell>;
      })}
      <CTableDataCell><div className="d-flex gap-1">
        <CButton color="info" size="sm" variant="ghost" onClick={() => onEdit(item)}>✏️</CButton>
        <CButton color="danger" size="sm" variant="ghost" onClick={() => onDelete(id)}>🗑️</CButton>
      </div></CTableDataCell>
    </CTableRow>
  );
});
DataRow.displayName = 'DataRow';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('movies');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Modal States
  const [uploadModal, setUploadModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editLoading, setEditLoading] = useState(false);
  
  // Upload States
  const [movieIdInput, setMovieIdInput] = useState('');
  const [movieTitle, setMovieTitle] = useState('');
  const [movieDesc, setMovieDesc] = useState('');
  const [movieYear, setMovieYear] = useState('');
  const [movieCountry, setMovieCountry] = useState('Vietnam');
  const [movieLang, setMovieLang] = useState('vi');
  const [movieType, setMovieType] = useState('movie');
  const [movieDuration, setMovieDuration] = useState('');
  const [movieTrailer, setMovieTrailer] = useState('');
  const [movieImdb, setMovieImdb] = useState('');
  const [movieRotten, setMovieRotten] = useState('');
  const [moviePosterFile, setMoviePosterFile] = useState<File | null>(null);
  const [movieFile, setMovieFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const entity = ENTITIES.find(e => e.id === activeTab);
      const res = await fetch(`http://localhost:5113/api/${entity?.api}`);
      if (!res.ok) { setData([]); return; }
      const json = await res.json();
      let list = Array.isArray(json) ? json : (Object.values(json).find(v => Array.isArray(v)) as any[]) || [];
      setData(list);
    } catch (err) { setData([]); } finally { setLoading(false); }
  }, [activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = useCallback(async (id: any) => {
    if (!confirm('Xóa bản ghi này?')) return;
    try {
      const entity = ENTITIES.find(e => e.id === activeTab);
      const res = await fetch(`http://localhost:5113/api/${entity?.api}/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) { alert('Lỗi mạng'); }
  }, [activeTab, fetchData]);

  const handleEditOpen = useCallback(async (item: any) => {
    const id = item.id || item.Id || item.movieId || item.MovieId || item.genreId || item.GenreId || item.personId || item.PersonId;
    setEditLoading(true); setEditModal(true); setEditingItem(item);
    try {
      const entity = ENTITIES.find(e => e.id === activeTab);
      const res = await fetch(`http://localhost:5113/api/${entity?.api}/${id}`);
      if (res.ok) setEditingItem(await res.json());
    } catch (err) { console.error(err); } finally { setEditLoading(false); }
  }, [activeTab]);

  const handleEditSubmit = async () => {
    const id = editingItem.id || editingItem.Id || editingItem.movieId || editingItem.MovieId || editingItem.genreId || editingItem.GenreId || editingItem.personId || editingItem.PersonId;
    try {
      const entity = ENTITIES.find(e => e.id === activeTab);
      const { jobStatus, JobStatus, createdAt, CreatedAt, ...payload } = editingItem;
      const res = await fetch(`http://localhost:5113/api/${entity?.api}/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) { setEditModal(false); fetchData(); }
    } catch (err) { alert('Lỗi mạng'); }
  };

  const uploadFileToR2 = (file: File, url: string, onProgress: (p: number) => void) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded * 100) / e.total)); };
      xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve(xhr.response) : reject(new Error('Upload thất bại'));
      xhr.onerror = () => reject(new Error('Lỗi mạng'));
      xhr.send(file);
    });
  };

  const handleUploadSubmit = async () => {
    if (!movieIdInput || !movieTitle || !movieFile) return alert('Vui lòng nhập ID, Tên phim và chọn file video!');
    setIsUploading(true); setUploadStatus('Đang khởi tạo...'); setUploadProgress(0);
    const slug = movieTitle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    try {
      const res = await fetch('http://localhost:5113/api/admin/Movies', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: movieIdInput, title: movieTitle, slug, description: movieDesc, releaseYear: parseInt(movieYear)||2024, country: movieCountry, language: movieLang, movieType, duration: parseInt(movieDuration)||0, trailerUrl: movieTrailer, imdbScore: parseFloat(movieImdb)||0, rottenTomatoesScore: parseInt(movieRotten)||0 })
      });
      if (!res.ok) throw new Error('ID đã tồn tại.');
      if (moviePosterFile) {
        const presignedPoster = await fetch(`http://localhost:5113/api/admin/Movies/${movieIdInput}/upload-url?fileName=poster.jpg`).then(r => r.text());
        await uploadFileToR2(moviePosterFile, presignedPoster, () => {});
      }
      const presignedVideo = await fetch(`http://localhost:5113/api/admin/Movies/${movieIdInput}/upload-url?fileName=raw.mp4`).then(r => r.text());
      await uploadFileToR2(movieFile, presignedVideo, p => setUploadProgress(p));
      await fetch(`http://localhost:5113/api/admin/Movies/${movieIdInput}/ingest`, { method: 'POST' });
      setUploadStatus('🚀 Đã gửi yêu cầu xử lý!'); setIsUploading(false); setUploadModal(false); fetchData();
    } catch (err: any) { alert(err.message); setIsUploading(false); }
  };

  const visibleKeys = useMemo(() => {
    if (data.length === 0) return [];
    return Array.from(new Set(data.flatMap(item => Object.keys(item))))
      .filter(k => {
        const kl = k.toLowerCase();
        return !SKIP_KEYS.includes(k) && !SKIP_KEYS.includes(kl) && !kl.includes('url') && (typeof data[0][k] !== 'object' || kl.includes('jobstatus'));
      });
  }, [data]);

  return (
    <div className="bg-light min-vh-100 antialiased">
      <CNavbar colorScheme="dark" className="bg-dark shadow-sm py-1"><CContainer fluid><CNavbarBrand href="#" className="fw-bold">📺 TviEn Admin</CNavbarBrand></CContainer></CNavbar>
      <CContainer fluid className="mt-4 px-4">
        <CRow>
          <CCol md={2}>
            <CCard className="shadow-sm border-0 mb-4 rounded-3 overflow-hidden"><CCardHeader className="bg-white font-weight-bold py-2 small">📁 MANAGEMENT</CCardHeader>
              <CListGroup flush>{ENTITIES.map(e => (<CListGroupItem key={e.id} component="button" active={activeTab === e.id} onClick={() => setActiveTab(e.id)} className="border-0 py-2 small text-start">{e.label}</CListGroupItem>))}</CListGroup>
            </CCard>
          </CCol>
          <CCol md={10}>
            <CCard className="shadow-sm border-0 mb-4 rounded-3">
              <CCardHeader className="bg-white d-flex justify-content-between align-items-center py-2 border-bottom-0"><h6 className="mb-0 fw-bold uppercase">{activeTab} List</h6>
                <div className="d-flex gap-2"><CButton color="secondary" variant="outline" size="sm" onClick={async () => { if(confirm('Seed data?')) { await fetch('http://localhost:5113/api/admin/seed', {method:'POST'}); fetchData(); } }}>🌱 Seed</CButton>
                  {activeTab === 'movies' && <CButton color="primary" size="sm" onClick={() => setUploadModal(true)}>+ Add Movie</CButton>}
                </div>
              </CCardHeader>
              <CCardBody className="p-0">
                {loading ? <div className="text-center py-5"><CSpinner size="sm" /></div> : data.length === 0 ? <div className="text-center py-5 text-muted small border-top">No data found.</div> : (
                  <div className="table-responsive"><CTable hover align="middle" className="mb-0 border-top"><CTableHead color="light"><CTableRow>{visibleKeys.map(k => <CTableHeaderCell key={k} className="text-nowrap small">{k.toUpperCase()}</CTableHeaderCell>)}<CTableHeaderCell className="small">ACTIONS</CTableHeaderCell></CTableRow></CTableHead>
                    <CTableBody>{data.map((item, idx) => <DataRow key={item.id || idx} item={item} keys={visibleKeys} onEdit={handleEditOpen} onDelete={handleDelete} />)}</CTableBody>
                  </CTable></div>
                )}
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>

      {/* EDIT MODAL */}
      <CModal visible={editModal} onClose={() => setEditModal(false)} size="lg">
        <CModalHeader><CModalTitle className="fs-6">Edit Record</CModalTitle></CModalHeader>
        <CModalBody>{editLoading ? <div className="text-center py-4"><CSpinner size="sm"/></div> : editingItem && (<CRow className="g-3">{Object.keys(editingItem).filter(k => !['id','movieid','genreid','personid','createdat','updatedat','finishedat','jobstatus','encryptionkey'].includes(k.toLowerCase()) && typeof editingItem[k] !== 'object').map(k => (<CCol md={k.toLowerCase().includes('description') || k.toLowerCase().includes('bio') || k.toLowerCase().includes('url') ? 12 : 6} key={k}><CFormInput label={k.toUpperCase()} value={editingItem[k] || ''} onChange={(e) => setEditingItem({ ...editingItem, [k]: e.target.value })} size="sm" /></CCol>))}</CRow>)}</CModalBody>
        <CModalFooter><CButton color="secondary" size="sm" onClick={() => setEditModal(false)}>Hủy</CButton><CButton color="primary" size="sm" onClick={handleEditSubmit}>Lưu</CButton></CModalFooter>
      </CModal>

      {/* UPLOAD MODAL */}
      <CModal visible={uploadModal} onClose={() => !isUploading && setUploadModal(false)} size="lg" backdrop="static">
        <CModalHeader><CModalTitle className="fs-6 fw-bold">🎬 Add Movie</CModalTitle></CModalHeader>
        <CModalBody>{isUploading ? (<div className="p-4 text-center"><h6 className="mb-3">{uploadStatus}</h6><CProgress height={25}><CProgressBar value={uploadProgress} animated striped color="success">{uploadProgress}%</CProgressBar></CProgress></div>) : (<div className="container-fluid">
          <CRow className="g-3 mb-3">
            <CCol md={3}><CFormInput label="ID (*)" size="sm" value={movieIdInput} onChange={e => setMovieIdInput(e.target.value)} /></CCol>
            <CCol md={6}><CFormInput label="Title (*)" size="sm" value={movieTitle} onChange={e => setMovieTitle(e.target.value)} /></CCol>
            <CCol md={3}><label className="form-label small">Type</label><select className="form-select form-select-sm" value={movieType} onChange={e => setMovieType(e.target.value)}><option value="movie">Movie</option><option value="series">Series</option></select></CCol>
            <CCol md={12}><CFormInput label="Description" size="sm" value={movieDesc} onChange={e => setMovieDesc(e.target.value)} /></CCol>
            <CCol md={3}><CFormInput label="Year" size="sm" type="number" value={movieYear} onChange={e => setMovieYear(e.target.value)} /></CCol>
            <CCol md={3}><CFormInput label="IMDb" size="sm" type="number" step="0.1" value={movieImdb} onChange={e => setMovieImdb(e.target.value)} /></CCol>
            <CCol md={6}><CFormInput label="Trailer" size="sm" value={movieTrailer} onChange={e => setMovieTrailer(e.target.value)} /></CCol>
            <CCol md={6}><CFormInput label="Poster (JPG)" size="sm" type="file" onChange={e => setMoviePosterFile(e.target.files?.[0] || null)} /></CCol>
            <CCol md={6}><CFormInput label="Video (MP4) (*)" size="sm" type="file" onChange={e => setMovieFile(e.target.files?.[0] || null)} /></CCol>
          </CRow></div>)}
        </CModalBody>
        <CModalFooter>{!isUploading && (<><CButton color="secondary" size="sm" onClick={() => setUploadModal(false)}>Hủy</CButton><CButton color="primary" size="sm" onClick={handleUploadSubmit}>🚀 Bắt đầu</CButton></>)}</CModalFooter>
      </CModal>
    </div>
  );
}
