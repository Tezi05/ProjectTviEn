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
  CBadge
} from '@coreui/react'

type JobStatus = { status: string; logs: string; finishedAt: string | null };
type Movie = { id: string; title: string; slug: string; jobStatus: JobStatus | null };

export default function Dashboard() {
  const [movies, setMovies] = useState<Movie[]>([]);

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

  const handleReIngest = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn re-ingest phim này?')) return;
    try {
      const res = await fetch(`http://localhost:5113/api/admin/Movies/${id}/re-ingest`, { method: 'POST' });
      const data = await res.json();
      alert(`Đã khởi tạo Re-ingest!\nVui lòng upload file qua URL sau:\n${data.uploadUrl}`);
      fetchMovies();
    } catch (err) {
      console.error(err);
      alert('Tạo yêu cầu Re-ingest thất bại.');
    }
  };

  const handleCreateMovie = async () => {
    const title = prompt('Nhập tên bộ phim mới:');
    if (!title) return;
    
    // Tạo slug đơn giản từ tên phim
    const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    try {
      const res = await fetch('http://localhost:5113/api/admin/Movies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug })
      });
      
      if (!res.ok) throw new Error('API failed');

      const data = await res.json();
      console.log('Created Data:', data);
      
      // Báo cáo thành công và đưa link upload
      alert(`✅ Tạo phim [{title}] thành công!\n\nID: ${data.id}\n\n👉 Vui lòng copy URL upload bên dưới trong màn hình Console (F12) để đẩy file MP4 lên R2.`);
      
      fetchMovies(); // Tải lại bảng ngay lập tức
    } catch (err) {
      console.error(err);
      alert('❌ Lỗi: Không thể kết nối tới Backend để tạo phim.');
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
                <CButton color="primary" onClick={handleCreateMovie}>+ Thêm phim mới</CButton>
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
                    {movies.map(m => (
                      <CTableRow key={m.id}>
                        <CTableDataCell>{m.id.substring(0, 8)}...</CTableDataCell>
                        <CTableDataCell>{m.title}</CTableDataCell>
                        <CTableDataCell>
                          <CBadge 
                            color={m.jobStatus?.status === 'done' ? 'success' : m.jobStatus?.status === 'failed' ? 'danger' : 'warning'} 
                            shape="rounded-pill"
                          >
                            {m.jobStatus?.status || 'none'}
                          </CBadge>
                        </CTableDataCell>
                        <CTableDataCell>
                          <CButton color="info" size="sm" variant="outline" className="me-2" onClick={() => handleReIngest(m.id)}>
                            Re-ingest
                          </CButton>
                          <CButton color="danger" size="sm" variant="outline">Xóa</CButton>
                        </CTableDataCell>
                      </CTableRow>
                    ))}
                  </CTableBody>
                </CTable>
              </CCardBody>
            </CCard>
          </CCol>
        </CRow>
      </CContainer>
    </>
  )
}
