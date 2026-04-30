# TviEn Data Structures (Backend Models)

Dưới đây là cấu trúc các trường dữ liệu (Schema) của hệ thống TviEn để bạn dễ dàng tham khảo và copy khi xây dựng trang Admin.

---

## 🎬 1. Movie (Phim)
Lưu trữ thông tin chính của phim lẻ hoặc phim bộ.

| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `movieId` | string | ID duy nhất (VD: "avatar-2") |
| `title` | string | Tên phim |
| `slug` | string | Đường dẫn URL (VD: "avatar-2") |
| `description` | string | Mô tả nội dung |
| `duration` | int | Thời lượng (giây) |
| `releaseYear` | int | Năm sản xuất |
| `country` | string | Quốc gia (VN, USA...) |
| `language` | string | Ngôn ngữ (vi, en...) |
| `movieType` | string | "movie" (lẻ) hoặc "series" (bộ) |
| `imdbScore` | float | Điểm IMDb (0.0 - 10.0) |
| `rottenTomatoesScore` | int | Điểm Rotten (0 - 100) |
| `trailerUrl` | string | Link trailer Youtube |
| `posterUrl` | string | Link ảnh bìa (JPG) |

---

## 🏷️ 2. Genre (Thể loại)
Phân loại phim.

| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `genreId` | int | ID tự tăng |
| `name` | string | Tên thể loại (Hành động...) |
| `slug` | string | Đường dẫn URL |

---

## ⭐ 3. Person (Nhân sự)
Diễn viên, đạo diễn.

| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `personId` | int | ID tự tăng |
| `fullName` | string | Tên đầy đủ |
| `biography` | string | Tiểu sử |
| `nationality` | string | Quốc tịch |
| `profilePhotoUrl` | string | Link ảnh chân dung |

---

## 📺 4. Episode (Tập phim)
Chỉ dùng cho phim bộ (`series`).

| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `episodeId` | int | ID tự tăng |
| `movieId` | string | Liên kết với Movie nào |
| `title` | string | Tên tập (Tập 1...) |
| `episodeNumber` | int | Số tập |
| `seasonNumber` | int | Mùa số mấy |

---

## 📹 5. Video (Dữ liệu Video)
Lưu trữ thông tin luồng phát (HLS).

| Trường (Field) | Kiểu dữ liệu | Mô tả |
| :--- | :--- | :--- |
| `videoId` | int | ID tự tăng |
| `movieId` | string | Thuộc về phim nào |
| `hlsUrl` | string | Link file .m3u8 |
| `quality` | string | Độ phân giải (1080p, 720p...) |
| `status` | string | "processing", "done", "error" |
