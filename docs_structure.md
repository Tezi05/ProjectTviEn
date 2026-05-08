# Cấu trúc thư mục dự án TviEn (ProjectTviEn)

Tài liệu này mô tả chi tiết vai trò và cấu trúc của từng thành phần trong toàn bộ hệ sinh thái dự án **TviEn** (Phim trực tuyến).

---

## 📂 Sơ đồ cấu trúc tổng quan

```text
ProjectTviEn/
├── backend/                  # ASP.NET Core Web API (Backend chính)
├── ProjectTviEn.Worker/      # Worker Service (.NET) xử lý ngầm (FFmpeg, transcode...)
├── user-frontend/            # Next.js App - Giao diện chính cho Người dùng & Admin panel tích hợp
├── admin-frontend/           # Next.js App - Bản giao diện Admin riêng biệt sử dụng CoreUI (đang phát triển)
├── cloudflare-worker/        # Cloudflare Worker xử lý bảo mật/phát luồng HLS trực tiếp từ R2
├── docker-data/              # Lưu trữ dữ liệu lâu dài của Docker (PostgreSQL, Redis, Prometheus...)
├── docs/                     # Tài liệu hướng dẫn, sơ đồ thiết kế hệ thống
├── scripts/                  # Các kịch bản tự động hóa (build, dọn dẹp, tool...)
├── start-*.bat & stop-*.bat  # Các file chạy nhanh (mở/tắt) các phân hệ ở môi trường Local
├── docker-compose.yml        # Cấu hình container hóa các dịch vụ bổ trợ
└── ProjectTviEn.sln          # Solution file của Visual Studio (.NET)
```

---

## 🛠️ Chi tiết các phân hệ chính

### 1. Backend (`/backend`)
Đây là trái tim của hệ thống, xử lý API, logic nghiệp vụ, cơ sở dữ liệu và xác thực người dùng.
*   **`Controllers/`**: Chứa các API endpoints.
    *   `Admin/`: Quản lý phim, tập phim, thể loại, upload tài nguyên (`MoviesController`, `MediaAssetsController`...).
    *   `Public/`: API cho người dùng xem phim, lịch sử xem, tìm kiếm.
*   **`Models/`**: Định nghĩa cấu trúc các bảng Database (Entity Framework Core) và các DTOs.
*   **`Services/`**: Các nghiệp vụ dùng chung (Cloudflare R2, JWT, Caching).
*   **`Program.cs`**: Điểm khởi đầu cấu hình Services, xử lý Resilient Connection (tự động parse DB URL khi deploy Render), và Fault-tolerant (vẫn chạy tốt dù thiếu Redis/Prometheus).

### 2. Worker Service (`/ProjectTviEn.Worker`)
Chương trình chạy ngầm chuyên trách xử lý các tác vụ nặng để tránh làm nghẽn API backend.
*   **Cơ chế hoạt động**: Nhận tín hiệu (JobId) từ hàng đợi Redis Queue (`tvien:ingest_queue`).
*   **Chức năng chính**:
    *   Tải video thô từ Cloudflare R2 xuống bộ nhớ đệm.
    *   Sử dụng **FFmpeg** để transcode/phân mảnh video thành định dạng **HLS (m3u8 & ts chunks)** với nhiều độ phân giải (1080p, 720p, 480p...).
    *   Đồng bộ ngược các mảnh video HLS lên Cloudflare R2.
    *   Cập nhật trạng thái Job vào PostgreSQL để thông báo cho người dùng.

### 3. User Frontend & Admin Tích hợp (`/user-frontend`)
Ứng dụng web hướng tới người dùng cuối và kiêm luôn bảng điều khiển admin tích hợp.
*   **Công nghệ**: Next.js (React), TailwindCSS, TypeScript.
*   **Giao diện Người dùng (`/src/pages/`)**:
    *   `index.tsx`: Trang chủ hiển thị danh sách phim, đề cử, phim thịnh hành.
    *   `watch/[id].tsx`: Trình phát video chuyên dụng hỗ trợ phát luồng m3u8 (HLS), bảo mật token.
*   **Giao diện Admin (`/src/pages/admin/`)**:
    *   Đường dẫn truy cập: `/admin`.
    *   Quản lý danh sách phim, thêm phim mới, upload Poster/Backdrop trực tiếp lên R2.
    *   Kích hoạt quá trình xử lý ngầm (Ingest Video) chỉ với 1 click.

### 4. Admin Frontend Riêng biệt (`/admin-frontend`)
*   Một nhánh giao diện quản trị riêng đang được phát triển song song bằng **Next.js** kết hợp bộ thư viện giao diện chuyên nghiệp **CoreUI** (React 19).

### 5. Cloudflare Worker (`/cloudflare-worker`)
*   Đoạn mã serverless chạy trực tiếp trên CDN của Cloudflare nhằm tối ưu hóa tốc độ tải video, sinh mã chữ ký bảo mật (Signed URLs) và phân phát các phân đoạn HLS ổn định nhất.

---

## ⚙️ Các file cấu hình tại thư mục gốc
*   **`docker-compose.yml`**: Khởi chạy nhanh môi trường local với đầy đủ Redis, Prometheus, Grafana, PostgreSQL.
*   **`start-all.bat` / `stop-all.bat`**: Nhấp đúp chuột để tự động mở/tắt toàn bộ dự án tại môi trường local (Backend + Worker + Next.js Frontend).
