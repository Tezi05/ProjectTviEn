# 📂 TviEn Data Dictionary (Models Documentation)

Tài liệu này tổng hợp chi tiết cấu trúc các thực thể (Entities) trong hệ thống TviEn, bao gồm tên cột, kiểu dữ liệu C# (tương ứng SQL) và mục đích sử dụng.

---

## 🎬 1. Bảng: Movie (Phim)
Quản lý thông tin cốt lõi của phim lẻ và phim bộ.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mục đích nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **Id** | string | Key, Max(50) | Khóa chính (MovieId). |
| **Title** | string | Required, Max(255) | Tiêu đề phim. |
| **Slug** | string | Required, Max(255) | Đường dẫn thân thiện (SEO). |
| **Description** | string? | Nullable | Mô tả tóm tắt nội dung phim. |
| **PosterUrl** | string? | Max(1000) | URL ảnh poster phim. |
| **Duration** | int? | Nullable | Thời lượng phim (tính bằng giây). |
| **ReleaseYear** | int? | Nullable | Năm phát hành. |
| **MovieType** | string | Max(20) | "movie" (phim lẻ) hoặc "series" (phim bộ). |
| **ImdbScore** | float? | Nullable | Điểm số IMDb (0.0 - 10.0). |
| **CreatedAt** | DateTime | Default: Now | Thời điểm tạo bản ghi. |

---

## 👤 2. Bảng: Person (Nghệ sĩ)
Quản lý thông tin Diễn viên, Đạo diễn.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mục đích nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **Id** | string | Key, Max(50) | Khóa chính định danh. |
| **FullName** | string | Required, Max(255) | Tên đầy đủ (hỗ trợ Unicode). |
| **Slug** | string? | Max(255) | Đường dẫn profile nghệ sĩ. |
| **Dob** | DateOnly? | Nullable | Ngày tháng năm sinh. |
| **Gender** | byte? | Nullable | 1: Nam, 2: Nữ. |
| **Biography** | string? | Max(MAX) | Tiểu sử/Thông tin chi tiết. |
| **AvatarUrl** | string? | Max(1000) | URL ảnh đại diện. |
| **Nationality** | string? | Max(50) | Quốc tịch nghệ sĩ. |

---

## 👥 3. Bảng: User (Người dùng)
Quản lý tài khoản và thông tin cá nhân.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mục đích nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **UserId** | string | Key, Max(50) | Khóa chính. |
| **GoogleId** | string | Required, Max(255) | ID định danh từ Google OAuth. |
| **Email** | string | Required, Max(255) | Email tài khoản. |
| **DisplayName** | string | Required, Max(255) | Tên hiển thị trên hệ thống. |
| **AvatarUrl** | string? | Max(1000) | URL ảnh đại diện Google. |
| **RoleId** | int | Default: 3 | 1: Admin, 2: VIP, 3: Member. |

---

## 📺 4. Bảng: Episode (Tập phim)
Dành cho phim bộ (Series).

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mục đích nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **EpisodeId** | string | Key, Max(50) | Khóa chính tập phim. |
| **MovieId** | string | Foreign Key | Thuộc về series phim nào. |
| **SeasonNumber** | int | Default: 1 | Mùa phim. |
| **EpisodeNumber**| int | Required | Số thứ tự tập trong mùa. |

---

## 📹 5. Bảng: Video (Luồng phát)
Quản lý các tệp video đã xử lý HLS.

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mục đích nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **VideoId** | string | Key, Max(50) | Khóa chính. |
| **Resolution** | string | Required, Max(50) | Độ phân giải (1080p, 720p...). |
| **MasterPlaylistUrl**| string? | Max(1000) | Đường dẫn file .m3u8 trên R2. |

---

## ⚙️ 6. Bảng: IngestJob (Tiến trình xử lý)
Quản lý việc upload và chuyển mã (Transcoding).

| Tên cột | Kiểu dữ liệu | Ràng buộc | Mục đích nghiệp vụ |
| :--- | :--- | :--- | :--- |
| **JobId** | string | Key, Max(50) | ID tiến trình. |
| **Status** | string | Default: "pending" | pending, processing, done, failed. |
| **RawPath** | string? | Max(1000) | Đường dẫn file gốc chưa xử lý. |

---

## 📂 Danh sách các Model khác
- **Genre:** Thể loại.
- **Role:** Quyền hạn.
- **Review:** Bình luận/Đánh giá.
- **WatchHistory:** Lịch sử xem.
- **Watchlist:** Danh sách yêu thích.
- **MovieGenre / MovieCrew:** Quan hệ phim - thể loại - nhân sự.
