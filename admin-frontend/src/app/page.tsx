"use client"

import { useEffect, useState, useCallback, memo, useMemo } from 'react';
import {
  CButton, CCard, CCardBody, CCardHeader, CCol, CContainer, CNavbar, CNavbarBrand, CRow,
  CTable, CTableBody, CTableDataCell, CTableHead, CTableHeaderCell, CTableRow, CBadge,
  CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter, CFormInput, CProgress,
  CProgressBar, CListGroup, CListGroupItem, CSpinner
} from '@coreui/react'

const CListGroupItemAny = CListGroupItem as any;
const CProgressBarAny = CProgressBar as any;

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
  const [allGenres, setAllGenres] = useState<any[]>([]);
  const [allPersons, setAllPersons] = useState<any[]>([]);
  const [editTab, setEditTab] = useState('info'); // 'info' or 'video'
  const [slugDisabled, setSlugDisabled] = useState(true);
  
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/${entity?.api}`);
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
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/${entity?.api}/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) { alert('Lỗi mạng'); }
  }, [activeTab, fetchData]);

  const handleEditOpen = useCallback(async (item: any) => {
    const id = item.id || item.Id || item.movieId || item.MovieId || item.genreId || item.GenreId || item.personId || item.PersonId;
    setEditLoading(true); setEditModal(true); setEditingItem(item); setEditTab('info'); setSlugDisabled(true);
    
    try {
      const entity = ENTITIES.find(e => e.id === activeTab);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/${entity?.api}/${id}`);
      if (res.ok) {
        const fullItem = await res.json();
        // Chuẩn hóa dữ liệu GenreIds và CrewMembers cho DTO
        if (activeTab === 'movies') {
          fullItem.genreIds = fullItem.genres?.map((g: any) => g.genreId) || [];
          fullItem.crewMembers = fullItem.crew?.map((c: any) => ({ personId: c.personId, roleId: c.roleId })) || [];
        }
        setEditingItem(fullItem);
      }

      // Nếu là Movies, tải thêm danh sách Thể loại và Nhân sự để chọn
      if (activeTab === 'movies') {
        const [gRes, pRes] = await Promise.all([
          fetch('http://localhost:5113/api/admin/system/tables/Genres'),
          fetch('http://localhost:5113/api/admin/system/tables/Persons')
        ]);
        if (gRes.ok) setAllGenres(await gRes.ok ? await gRes.json() : []);
        if (pRes.ok) setAllPersons(await pRes.ok ? await pRes.json() : []);
      }
    } catch (err) { console.error(err); } finally { setEditLoading(false); }
  }, [activeTab]);

  const handleEditSubmit = async () => {
    const id = editingItem.id || editingItem.Id || editingItem.movieId || editingItem.MovieId || editingItem.genreId || editingItem.GenreId || editingItem.personId || editingItem.PersonId;
    try {
      const entity = ENTITIES.find(e => e.id === activeTab);
      const { jobStatus, JobStatus, createdAt, CreatedAt, ...payload } = editingItem;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/${entity?.api}/${id}`, {
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
        const presignedPoster = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/admin/Movies/${movieIdInput}/upload-url?fileName=poster.jpg`).then(r => r.text());
        await uploadFileToR2(moviePosterFile, presignedPoster, () => {});
      }
      const presignedVideo = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/admin/Movies/${movieIdInput}/upload-url?fileName=raw.mp4`).then(r => r.text());
      await uploadFileToR2(movieFile, presignedVideo, p => setUploadProgress(p));
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/admin/Movies/${movieIdInput}/ingest`, { method: 'POST' });
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
              <CListGroup flush>{ENTITIES.map(e => (<CListGroupItemAny key={e.id} component="button" active={activeTab === e.id} onClick={() => setActiveTab(e.id)} className="border-0 py-2 small text-start">{e.label}</CListGroupItemAny>))}</CListGroup>
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

      <CModal visible={editModal} onClose={() => setEditModal(false)} size="xl" scrollable>
        <CModalHeader className="bg-dark text-white py-2">
          <CModalTitle className="fs-6 fw-bold">🛠️ Chỉnh sửa {activeTab.toUpperCase()}</CModalTitle>
        </CModalHeader>
        <CModalBody className="p-0">
          {editLoading ? <div className="text-center py-5"><CSpinner /></div> : editingItem && (
            <div className="d-flex flex-column h-100">
              {activeTab === 'movies' && (
                <div className="bg-light border-bottom px-3 py-2 d-flex gap-3">
                  <CButton size="sm" variant={editTab === 'info' ? undefined : 'ghost'} color="primary" onClick={() => setEditTab('info')}>📝 Thông tin phim</CButton>
                  <CButton size="sm" variant={editTab === 'video' ? undefined : 'ghost'} color="primary" onClick={() => setEditTab('video')}>📹 Quản lý Video</CButton>
                </div>
              )}

              <div className="p-4 overflow-auto" style={{ maxHeight: '70vh' }}>
                {activeTab === 'movies' && editTab === 'info' ? (
                  <CRow className="g-4">
                    {/* PHÂN KHU 1: CORE INFO */}
                    <CCol md={8}>
                      <CCard className="border-0 shadow-sm mb-4">
                        <CCardHeader className="bg-white fw-bold small text-primary">1. THÔNG TIN CỐT LÕI</CCardHeader>
                        <CCardBody>
                          <CRow className="g-3">
                            <CCol md={8}><CFormInput label="TIÊU ĐỀ" value={editingItem.title || ''} onChange={e => setEditingItem({...editingItem, title: e.target.value})} /></CCol>
                            <CCol md={4}><CFormInput label="NĂM" type="number" value={editingItem.releaseYear || ''} onChange={e => setEditingItem({...editingItem, releaseYear: parseInt(e.target.value)})} /></CCol>
                            <CCol md={8}><CFormInput label="TÊN GỐC (ORIGINAL TITLE)" value={editingItem.originalTitle || ''} onChange={e => setEditingItem({...editingItem, originalTitle: e.target.value})} /></CCol>
                            <CCol md={4}>
                              <label className="form-label small fw-bold">ĐỘ TUỔI</label>
                              <select className="form-select" value={editingItem.ageRating || ''} onChange={e => setEditingItem({...editingItem, ageRating: e.target.value})}>
                                <option value="P">P - Mọi lứa tuổi</option>
                                <option value="13+">13+ - Trên 13 tuổi</option>
                                <option value="C16">C16 - Trên 16 tuổi</option>
                                <option value="C18">C18 - Trên 18 tuổi</option>
                              </select>
                            </CCol>
                            <CCol md={12}>
                              <label className="form-label small fw-bold">SLUG (URL)</label>
                              <div className="input-group">
                                <input type="text" className="form-control" disabled={slugDisabled} value={editingItem.slug || ''} onChange={e => setEditingItem({...editingItem, slug: e.target.value})} />
                                <CButton color="warning" variant="outline" onClick={() => { if(confirm('Sửa Slug có thể làm hỏng SEO! Bạn chắc chứ?')) setSlugDisabled(false) }}>🔓</CButton>
                              </div>
                            </CCol>
                          </CRow>
                        </CCardBody>
                      </CCard>

                      {/* PHÂN KHU 2: CONTENT */}
                      <CCard className="border-0 shadow-sm mb-4">
                        <CCardHeader className="bg-white fw-bold small text-primary">2. NỘI DUNG & MÔ TẢ</CCardHeader>
                        <CCardBody>
                          <div className="mb-3">
                            <label className="form-label small fw-bold">MÔ TẢ PHIM</label>
                            <textarea className="form-control" rows={6} value={editingItem.description || ''} onChange={e => setEditingItem({...editingItem, description: e.target.value})} placeholder="Nhập nội dung phim..."></textarea>
                          </div>
                          <CFormInput label="TRAILER URL (YOUTUBE/MP4)" value={editingItem.trailerUrl || ''} onChange={e => setEditingItem({...editingItem, trailerUrl: e.target.value})} />
                        </CCardBody>
                      </CCard>

                      {/* PHÂN KHU 3: RELATIONSHIPS */}
                      <CCard className="border-0 shadow-sm">
                        <CCardHeader className="bg-white fw-bold small text-primary">3. THỂ LOẠI & NHÂN SỰ</CCardHeader>
                        <CCardBody>
                          <div className="mb-4">
                            <label className="form-label small fw-bold d-block">THỂ LOẠI</label>
                            <div className="d-flex flex-wrap gap-2 mb-2">
                              {allGenres.map(g => (
                                <CBadge key={g.id} color={editingItem.genreIds?.includes(g.id) ? 'primary' : 'light'} 
                                  className="p-2 cursor-pointer border" style={{ cursor: 'pointer' }}
                                  onClick={() => {
                                    const ids = [...(editingItem.genreIds || [])];
                                    const idx = ids.indexOf(g.id);
                                    if(idx > -1) ids.splice(idx, 1); else ids.push(g.id);
                                    setEditingItem({...editingItem, genreIds: ids});
                                  }}>
                                  {g.name}
                                </CBadge>
                              ))}
                            </div>
                          </div>
                          <div>
                            <label className="form-label small fw-bold d-block">NHÂN SỰ (CREW)</label>
                            <div className="bg-light p-3 rounded mb-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                              {editingItem.crewMembers?.map((cm: any, idx: number) => {
                                const p = allPersons.find(per => per.id === cm.personId);
                                return (
                                  <div key={idx} className="d-flex align-items-center gap-2 mb-2 bg-white p-2 rounded shadow-sm">
                                    <span className="small flex-grow-1 fw-bold">{p?.fullName || 'Người ẩn danh'}</span>
                                    <select className="form-select form-select-sm w-auto" value={cm.roleId} onChange={e => {
                                      const members = [...editingItem.crewMembers];
                                      members[idx].roleId = parseInt(e.target.value);
                                      setEditingItem({...editingItem, crewMembers: members});
                                    }}>
                                      <option value={1}>Đạo diễn</option>
                                      <option value={2}>Diễn viên</option>
                                      <option value={3}>Biên kịch</option>
                                    </select>
                                    <CButton color="danger" size="sm" variant="ghost" onClick={() => {
                                      const members = [...editingItem.crewMembers];
                                      members.splice(idx, 1);
                                      setEditingItem({...editingItem, crewMembers: members});
                                    }}>✖</CButton>
                                  </div>
                                );
                              })}
                            </div>
                            <div className="input-group">
                              <select className="form-select form-select-sm" id="addPerson">
                                <option value="">+ Chọn nhân sự mới...</option>
                                {allPersons.filter(p => !editingItem.crewMembers?.some((cm: any) => cm.personId === p.id)).map(p => (
                                  <option key={p.id} value={p.id}>{p.fullName}</option>
                                ))}
                              </select>
                              <CButton color="primary" size="sm" onClick={() => {
                                const select = document.getElementById('addPerson') as HTMLSelectElement;
                                if(!select.value) return;
                                const members = [...(editingItem.crewMembers || [])];
                                members.push({ personId: select.value, roleId: 2 });
                                setEditingItem({...editingItem, crewMembers: members});
                                select.value = "";
                              }}>Thêm</CButton>
                            </div>
                          </div>
                        </CCardBody>
                      </CCard>
                    </CCol>

                    {/* PHÂN KHU 2: MEDIA PREVIEW (Cột phải) */}
                    <CCol md={4}>
                      <CCard className="border-0 shadow-sm mb-4">
                        <CCardHeader className="bg-white fw-bold small text-primary">POSTER (DỌC 2:3)</CCardHeader>
                        <CCardBody className="text-center">
                          <img src={editingItem.posterUrl ? `https://pub-843e9389e0234a5d89617300438edb37.r2.dev/${editingItem.posterUrl}` : 'https://placehold.co/200x300?text=No+Poster'} 
                               className="img-fluid rounded shadow mb-3" style={{ maxHeight: '300px' }} />
                          <CFormInput type="file" size="sm" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if(!file) return;
                            const formData = new FormData(); formData.append('file', file);
                            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/admin/Movies/${editingItem.id}/upload-poster`, { method: 'POST', body: formData });
                            if(res.ok) { const json = await res.json(); setEditingItem({...editingItem, posterUrl: json.url}); }
                          }} />
                        </CCardBody>
                      </CCard>
                      
                      <CCard className="border-0 shadow-sm mb-4">
                        <CCardHeader className="bg-white fw-bold small text-primary">BACKDROP (NGANG 16:9)</CCardHeader>
                        <CCardBody className="text-center">
                          <img src={editingItem.backdropUrl ? `https://pub-843e9389e0234a5d89617300438edb37.r2.dev/${editingItem.backdropUrl}` : 'https://placehold.co/320x180?text=No+Backdrop'} 
                               className="img-fluid rounded shadow mb-3" />
                          <CFormInput type="file" size="sm" onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if(!file) return;
                            const formData = new FormData(); formData.append('file', file);
                            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}/admin/Movies/${editingItem.id}/upload-backdrop`, { method: 'POST', body: formData });
                            if(res.ok) { const json = await res.json(); setEditingItem({...editingItem, backdropUrl: json.url}); }
                          }} />
                        </CCardBody>
                      </CCard>

                      {/* PHÂN KHU 4: PUBLISHING */}
                      <CCard className="border-0 shadow-sm bg-dark text-white">
                        <CCardHeader className="bg-transparent border-secondary fw-bold small">4. TRẠNG THÁI</CCardHeader>
                        <CCardBody>
                          <div className="d-flex justify-content-between align-items-center mb-3">
                            <span>XUẤT BẢN</span>
                            <div className="form-check form-switch">
                              <input className="form-check-input" type="checkbox" style={{ width: '40px', height: '20px' }} 
                                     checked={editingItem.status === 1} 
                                     onChange={e => setEditingItem({...editingItem, status: e.target.checked ? 1 : 0})} />
                            </div>
                          </div>
                          <div className="small text-secondary">
                            <div>📅 Tạo: {new Date(editingItem.createdAt).toLocaleDateString()}</div>
                            <div>🔄 Sửa: {editingItem.updatedAt ? new Date(editingItem.updatedAt).toLocaleDateString() : 'N/A'}</div>
                          </div>
                        </CCardBody>
                      </CCard>
                    </CCol>
                  </CRow>
                ) : activeTab === 'movies' && editTab === 'video' ? (
                  /* TAB QUẢN LÝ VIDEO */
                  <div>
                    <h6 className="fw-bold mb-4">Danh sách luồng phát (Streaming)</h6>
                    {editingItem.videos?.length > 0 ? (
                      <CTable align="middle">
                        <CTableHead color="light"><CTableRow><CTableHeaderCell>VIDEO ID</CTableHeaderCell><CTableHeaderCell>ĐỘ PHÂN GIẢI</CTableHeaderCell><CTableHeaderCell>DRM</CTableHeaderCell><CTableHeaderCell>NGÀY TẠO</CTableHeaderCell></CTableRow></CTableHead>
                        <CTableBody>
                          {editingItem.videos.map((v: any) => (
                            <CTableRow key={v.videoId}>
                              <CTableDataCell className="small">{v.videoId}</CTableDataCell>
                              <CTableDataCell><CBadge color="info">{v.resolution}</CBadge></CTableDataCell>
                              <CTableDataCell>{v.isEncrypted ? '🔐 AES-128' : '🔓 None'}</CTableDataCell>
                              <CTableDataCell className="small">{new Date(v.createdAt).toLocaleString()}</CTableDataCell>
                            </CTableRow>
                          ))}
                        </CTableBody>
                      </CTable>
                    ) : (
                      <div className="text-center p-5 bg-light rounded text-muted">Chưa có video. Vui lòng chạy Ingest Job.</div>
                    )}
                  </div>
                ) : (
                  /* GENERIC UI CHO CÁC BẢNG KHÁC */
                  <CRow className="g-3">
                    {Object.keys(editingItem).filter(k => !['id','movieid','genreid','personid','createdat','updatedat','finishedat','jobstatus','encryptionkey','videos','genres','crew'].includes(k.toLowerCase()) && typeof editingItem[k] !== 'object').map(k => (
                      <CCol md={k.toLowerCase().includes('description') || k.toLowerCase().includes('bio') || k.toLowerCase().includes('url') ? 12 : 6} key={k}>
                        <CFormInput label={k.toUpperCase()} value={editingItem[k] || ''} onChange={(e) => setEditingItem({ ...editingItem, [k]: e.target.value })} size="sm" />
                      </CCol>
                    ))}
                  </CRow>
                )}
              </div>
            </div>
          )}
        </CModalBody>
        <CModalFooter className="bg-light border-top-0 py-2">
          <CButton color="secondary" size="sm" variant="ghost" onClick={() => setEditModal(false)}>Đóng</CButton>
          <CButton color="primary" size="sm" className="px-4" onClick={handleEditSubmit}>LƯU THAY ĐỔI</CButton>
        </CModalFooter>
      </CModal>

      {/* UPLOAD MODAL */}
      <CModal visible={uploadModal} onClose={() => !isUploading && setUploadModal(false)} size="lg" backdrop="static">
        <CModalHeader><CModalTitle className="fs-6 fw-bold">🎬 Add Movie</CModalTitle></CModalHeader>
        <CModalBody>{isUploading ? (<div className="p-4 text-center"><h6 className="mb-3">{uploadStatus}</h6><CProgress height={25}><CProgressBarAny value={uploadProgress} animated striped color="success">{uploadProgress}%</CProgressBarAny></CProgress></div>) : (<div className="container-fluid">
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
