"use client"

import { useEffect, useState } from 'react';
import {
  CButton,
  CCard,
  CCardBody,
  CCardHeader,
  CCol,
  CContainer,
  CNavbar,
  CNavbarBrand,
  CRow,
  CTable,
  CTableBody,
  CTableDataCell,
  CTableHead,
  CTableHeaderCell,
  CTableRow,
  CBadge,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CFormInput,
  CProgress,
  CProgressBar
} from '@coreui/react'

type JobStatus = { status: string; logs: string; finishedAt: string | null };
type Movie = { id: string; title: string; slug: string; jobStatus: JobStatus | null };

export default function Dashboard() {
  const [movies, setMovies] = useState<Movie[]>([]);

  // States for Upload Movie Modal
  const [uploadModal, setUploadModal] = useState(false);
  const [movieIdInput, setMovieIdInput] = useState('');
  const [movieTitle, setMovieTitle] = useState('');
  const [movieDesc, setMovieDesc] = useState('');
  const [movieYear, setMovieYear] = useState('');
  const [moviePosterFile, setMoviePosterFile] = useState<File | null>(null);
  const [movieFile, setMovieFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // States for Asset Modal
  const [assetModal, setAssetModal] = useState(false);
  const [selectedMovieId, setSelectedMovieId] = useState('');
  const [assetFile, setAssetFile] = useState<File | null>(null);
  const [assetStatus, setAssetStatus] = useState('');

  useEffect(() => {
    fetchMovies();
  }, []);

  const fetchMovies = async () => {
    try {
      const res = await fetch('http://localhost:5113/api/admin/Movies');
      const data = await res.json();
      setMovies(data);
    } catch (err) {
      console.error('Lỗi khi lấy danh sách phim:', err);
    }
  };

  const uploadFileToR2 = (file: File, url: string, onProgress: (p: number) => void) => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
        else reject(new Error('Upload R2 thất bại'));
      };
      xhr.onerror = () => reject(new Error('Lỗi mạng khi upload'));
      xhr.send(file);
    });
  };

  const startPollingWorker = (movieId: string) => {
    setUploadProgress(0); 
    let noChangeCounter = 0;
    let lastPercent = -1;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:5113/api/admin/Movies/${movieId}/progress`);
        const pData = await res.json();
        const statData = typeof pData === 'string' ? JSON.parse(pData) : pData;

        if (statData.Status === 'error' || statData.Status === 'Error') {
          setUploadStatus(`❌ Lỗi Worker: ${statData.Detail}`);
          clearInterval(interval);
          setIsUploading(false);
          fetchMovies();
          return;
        }

        if (statData.Status === 'done' || statData.Percent === 100) {
           clearInterval(interval);
           setIsUploading(false);
           fetchMovies();
           
           // Hiển thị thông báo và đóng Modal
           setTimeout(() => {
             alert('🎉 Upload phim thành công! Hệ thống đã xử lý xong.');
             setUploadModal(false);
             
             // Xóa trắng form để sẵn sàng cho phim tiếp theo
             setMovieIdInput('');
             setMovieTitle('');
             setMovieDesc('');
             setMovieYear('');
             setMoviePosterFile(null);
             setMovieFile(null);
             setUploadStatus('');
             setUploadProgress(0);
           }, 500); // Đợi nửa giây cho mượt

           return;
        }

        setUploadStatus(`⚙️ Worker: ${statData.Detail || statData.Status}`);
        setUploadProgress(statData.Percent || 0);

        if (statData.Percent === lastPercent) {
           noChangeCounter++;
           if (noChangeCounter >= 60) {
               setUploadStatus('❌ Worker mất kết nối (quá 2 phút không đổi). Vui lòng kiểm tra lại terminal Worker.');
               clearInterval(interval);
               setIsUploading(false);
               fetchMovies();
           }
        } else {
           lastPercent = statData.Percent;
           noChangeCounter = 0; 
        }
      } catch (err) {
        console.error("Polling error", err);
      }
    }, 2000);
  };

  const handleUploadSubmit = async () => {
    if (!movieIdInput || !movieTitle || !movieFile) return alert('Vui lòng nhập ID, Tên phim và chọn file video!');
    setIsUploading(true);
    setUploadStatus('Đang khởi tạo phim...');
    setUploadProgress(0);

    const slug = movieTitle.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    try {
      const payload = {
        movieId: movieIdInput,
        title: movieTitle,
        slug,
        description: movieDesc,
        releaseYear: movieYear ? parseInt(movieYear) : null
        // posterUrl không gửi qua đây nữa, nếu có file sẽ gọi API riêng
      };

      const res = await fetch('http://localhost:5113/api/admin/Movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
         const errText = await res.text();
         throw new Error(`Backend lỗi: ${errText}`);
      }
      const data = await res.json();
      
      // Nếu có chọn file Poster từ máy, đẩy lên qua API riêng biệt trước khi xử lý Video
      if (moviePosterFile) {
        setUploadStatus('Đang tải ảnh Poster lên máy chủ...');
        const formData = new FormData();
        formData.append('file', moviePosterFile);
        const resPoster = await fetch(`http://localhost:5113/api/admin/Movies/${data.movieId}/custom-poster`, {
          method: 'POST',
          body: formData
        });
        if (!resPoster.ok) {
           const errText = await resPoster.text();
           throw new Error(`Lỗi up Poster: ${errText}`);
        }
      }

      setUploadStatus('Đang tải file video lên Cloudflare R2...');
      await uploadFileToR2(movieFile, data.uploadUrl, (p) => setUploadProgress(p));
      
      setUploadStatus('Đang kích hoạt Worker...');
      await fetch(`http://localhost:5113/api/admin/Movies/${data.movieId}/start-processing/${data.jobId}`, { method: 'POST' });
      
      startPollingWorker(data.movieId);
      
    } catch (err: any) {
      console.error(err);
      setUploadStatus('❌ Lỗi: ' + err.message);
      setIsUploading(false);
    }
  };

  const handleAssetUpload = async () => {
    if (!assetFile || !selectedMovieId) return alert('Vui lòng chọn file (.jpg hoặc .mp4)!');
    setAssetStatus('Đang upload asset trực tiếp lên R2...');
    
    const formData = new FormData();
    formData.append('file', assetFile);

    try {
      const res = await fetch(`http://localhost:5113/api/admin/Movies/${selectedMovieId}/assets`, {
        method: 'POST',
        body: formData
      });
      if (!res.ok) throw new Error('Upload asset thất bại');
      setAssetStatus(`✅ Thành công! Phim đã được vá Asset (Thumbnail/Preview).`);
      setAssetFile(null);
    } catch (err: any) {
      setAssetStatus('❌ Lỗi: ' + err.message);
    }
  };

  return (
    <>
      <CNavbar colorScheme="dark" className="bg-dark mb-4">
        <CContainer fluid>
          <CNavbarBrand className="text-white">Movie Streaming Admin</CNavbarBrand>
        </CContainer>
      </CNavbar>
      
      <CContainer>
        <CRow>
          <CCol>
            <CCard className="mb-4 shadow-sm border-0">
              <CCardHeader className="bg-white d-flex justify-content-between align-items-center py-3">
                <strong className="fs-5">Quản lý Phim</strong>
                <CButton color="primary" onClick={() => { setUploadModal(true); setUploadStatus(''); setUploadProgress(0); }}>
                  + 1-Click Upload Phim Mới
                </CButton>
              </CCardHeader>
              <CCardBody>
                <CTable hover responsive align="middle">
                  <CTableHead color="light">
                    <CTableRow>
                      <CTableHeaderCell scope="col">ID</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Tên Phim</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Trạng Thái Job</CTableHeaderCell>
                      <CTableHeaderCell scope="col">Hành Động</CTableHeaderCell>
                    </CTableRow>
                  </CTableHead>
                  <CTableBody>
                    {movies.length === 0 && (
                      <CTableRow>
                        <CTableDataCell colSpan={4} className="text-center text-muted">Chưa có dữ liệu phim</CTableDataCell>
                      </CTableRow>
                    )}
                    {movies.map((m: any) => {
                      const idVal = m.id || m.Id || '';
                      return (
                      <CTableRow key={idVal}>
                        <CTableDataCell>{idVal.substring(0, 8)}...</CTableDataCell>
                        <CTableDataCell>{m.title}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge 
                            color={(() => {
                              const js = m.jobStatus || m.JobStatus;
                              const stat = js?.status || js?.Status || 'none';
                              return stat === 'done' ? 'success' : stat === 'failed' ? 'danger' : 'warning';
                            })()} 
                            shape="rounded-pill"
                          >
                            {(m.jobStatus?.status || m.JobStatus?.Status || 'none')}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CButton color="warning" size="sm" className="me-2" onClick={() => { setSelectedMovieId(idVal); setAssetModal(true); setAssetStatus(''); setAssetFile(null); }}>
                            Vá Asset (Ảnh/Video)
                          </CButton>
                        </CTableDataCell>
                      </CTableRow>
                      );
                    })}
                  </CTableBody>
                </CTable>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>

      {/* Upload Movie Modal */}
      <CModal visible={uploadModal} onClose={() => !isUploading && setUploadModal(false)} backdrop="static">
        <CModalHeader>
          <CModalTitle>1-Click Upload Phim Mới</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="row mb-3">
             <div className="col-md-4">
                <label className="form-label text-primary fw-bold">ID Phim (*)</label>
                <CFormInput type="text" placeholder="VD: dune-2024" value={movieIdInput} onChange={e => setMovieIdInput(e.target.value)} disabled={isUploading} />
             </div>
             <div className="col-md-8">
                <label className="form-label">Tên Phim (*)</label>
                <CFormInput type="text" placeholder="Nhập tên phim..." value={movieTitle} onChange={e => setMovieTitle(e.target.value)} disabled={isUploading} />
             </div>
          </div>
          <div className="mb-3">
            <label className="form-label">Mô tả phim</label>
            <CFormInput type="text" placeholder="Nhập mô tả tóm tắt..." value={movieDesc} onChange={e => setMovieDesc(e.target.value)} disabled={isUploading} />
          </div>
          <div className="row mb-3">
             <div className="col-md-6">
                <label className="form-label">Năm phát hành</label>
                <CFormInput type="number" placeholder="VD: 2024" value={movieYear} onChange={e => setMovieYear(e.target.value)} disabled={isUploading} />
             </div>
             <div className="col-md-6">
                <label className="form-label">Ảnh Poster (Từ máy bạn)</label>
                <CFormInput type="file" accept="image/jpeg,image/png" onChange={e => setMoviePosterFile(e.target.files ? e.target.files[0] : null)} disabled={isUploading} />
             </div>
          </div>
          <div className="mb-3">
            <label className="form-label text-primary fw-bold">File Video MP4 (*)</label>
            <CFormInput type="file" accept="video/mp4" onChange={e => setMovieFile(e.target.files ? e.target.files[0] : null)} disabled={isUploading} />
          </div>
          
          {uploadStatus && (
            <div className="mt-4">
              <div className="d-flex justify-content-between mb-1">
                <small>{uploadStatus}</small>
                <small>{uploadProgress}%</small>
              </div>
              <CProgress height={15}>
                <CProgressBar color={uploadStatus.includes('Lỗi') ? 'danger' : uploadStatus.includes('Hoàn tất') ? 'success' : 'primary'} value={uploadProgress} />
              </CProgress>
            </div>
          )}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setUploadModal(false)} disabled={isUploading}>Hủy</CButton>
          <CButton color="primary" onClick={handleUploadSubmit} disabled={isUploading || !movieTitle || !movieFile}>
            {isUploading ? 'Đang xử lý...' : 'Bắt đầu Upload'}
          </CButton>
        </CModalFooter>
      </CModal>

      {/* Upload Asset Modal */}
      <CModal visible={assetModal} onClose={() => setAssetModal(false)}>
        <CModalHeader>
          <CModalTitle>Vá Asset cho Phim Cũ</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="text-muted small">Tải lên file <strong>thumbnail.jpg</strong> hoặc <strong>preview.mp4</strong>. Tên file sẽ tự động được nhận diện dựa trên phần mở rộng.</p>
          <div className="mb-3">
            <CFormInput type="file" accept="image/jpeg,image/png,video/mp4" onChange={e => setAssetFile(e.target.files ? e.target.files[0] : null)} />
          </div>
          {assetStatus && <div className={`alert ${assetStatus.includes('Lỗi') ? 'alert-danger' : 'alert-success'} mt-2`}>{assetStatus}</div>}
        </CModalBody>
        <CModalFooter>
          <CButton color="secondary" onClick={() => setAssetModal(false)}>Đóng</CButton>
          <CButton color="warning" onClick={handleAssetUpload} disabled={!assetFile || assetStatus.includes('Đang')}>Upload Asset</CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

