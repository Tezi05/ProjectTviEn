# 🎬 TỔNG QUAN CHI TIẾT DỰ ÁN TVIEN (HỆ SINH THÁI PHIM TRỰC TUYẾN)

> [!NOTE]
> **TviEn** là một hệ sinh thái ứng dụng Web xem phim trực tuyến toàn diện và chuyên nghiệp. Dự án không chỉ là một website hiển thị phim đơn thuần mà còn bao gồm một luồng xử lý video (Transcoding) tự động và nền tảng phát trực tuyến luồng (HLS Streaming) bảo mật cao qua CDN.

---

## 🚀 1. TẤT CẢ CHỨC NĂNG SỞ HỮU

### 👑 Dành cho Quản trị viên (Admin Dashboard & CMS)
- **Quản lý danh mục Phim (Lẻ & Bộ):** Thêm, sửa, xóa thông tin chi tiết phim bao gồm Tên, Mô tả, Thời lượng, Năm phát hành, Điểm IMDb, Rotten Tomatoes, Link Trailer.
- **Quản lý Cấu trúc Phim Bộ (Series Management):** Cấu trúc phân cấp chặt chẽ: `Phim -> Mùa (Seasons) -> Tập phim (Episodes)`. Hỗ trợ gán tập phim theo từng Mùa cụ thể cho các TV Series.
- **Hệ thống Tìm kiếm & Gán thông minh (Rich Autocomplete):** Gợi ý tìm kiếm trực tiếp có kèm hình ảnh (Avatar/Poster) thời gian thực. Giúp quản trị viên gán Diễn viên, Đạo diễn hay Thể loại cho Phim cực kỳ nhanh chóng, thay thế hoàn toàn thao tác chọn Dropdown thủ công truyền thống.
- **Kiểm soát Đường dẫn chuẩn SEO (Slug Control):** 
  - Tự động sinh đường dẫn (Slug) thân thiện khi gõ tên phim (VD: "Nhà Bà Nữ" -> `nha-ba-nu`).
  - Thuật toán chống trùng lặp Slug an toàn (nếu trùng tự sinh hậu tố `-1`, `-2`).
  - Khóa bảo vệ Slug ở chế độ chỉnh sửa để ngăn lỗi 404 (chỉ cấp quyền mở khóa kèm cảnh báo nguy hiểm).
- **Quản lý Tài nguyên Truyền thông (Media Upload):** Hỗ trợ upload trực tiếp hình ảnh (Poster, Backdrop, Avatar) lên bộ nhớ đám mây.
- **Kích hoạt Xử lý Video (Ingest Trigger):** Chỉ với 1 click, gửi yêu cầu chuyển mã (transcode) từ video gốc thô sang các luồng phát HLS nhiều độ phân giải.

### 🍿 Dành cho Người dùng cuối (User Frontend)
- **Trải nghiệm Giao diện Cao cấp (UI/UX):** Trang chủ được thiết kế tinh tế hiển thị theo các chuyên mục: phim nổi bật (Hero banner), phim đề cử, phim thịnh hành.
- **Định tuyến Thân thiện (SEO-Friendly Routing):** Sử dụng `Slug` trực tiếp trên thanh địa chỉ thay cho ID vô nghĩa (Ví dụ: `/watch/blade-runner-2049`), tối ưu tuyệt đối cho công cụ tìm kiếm.
- **Trình phát Video Chuyên dụng (Custom Video Player):** Tích hợp phát luồng phân mảnh HLS (`.m3u8`) cực mượt mà thông qua thư viện `hls.js`. Tự động nhận diện phim qua Slug và đồng bộ mã thông báo bảo mật (JWT) vào phiên phát.
- **Tương tác Đa chiều:** Hệ thống bình luận, đánh giá (Review/Rating), Lịch sử xem phim (Watch History) và Lưu phim yêu thích (Watchlist).

### 🛡️ Hạ tầng, Bảo mật & Tự động hóa
- **Bảo mật Luồng phát (Video Gatekeeper):** Chống "Dùng chùa" (Hotlinking). Luồng stream chỉ được cấp khi người dùng có Token hợp lệ (JWT). Nếu web lậu lấy link `.m3u8` sẽ bị từ chối truy cập (HTTP 403 Forbidden).
- **Tối ưu Cache CDN:** Thuật toán bóc tách Token ra khỏi Request URL trước khi đưa vào Cache, giúp hàng vạn người xem cùng 1 phim vẫn dùng chung 1 bản sao trong bộ nhớ đệm (Cache Hit cao).
- **Tự động dọn dẹp & Làm sạch Dữ liệu:** Hỗ trợ Data Seeder và các Endpoint sửa lỗi, chuẩn hóa dữ liệu cũ tự động.

---

## 💻 2. NGÔN NGỮ LẬP TRÌNH & CÔNG NGHỆ

| Công nghệ / Ngôn ngữ | Vai trò cụ thể trong Dự án |
| :--- | :--- |
| **C# 12 (.NET 8)** | Code lõi cho Backend Web API và Dịch vụ ngầm (`ProjectTviEn.Worker`). Chịu trách nhiệm toàn bộ logic nghiệp vụ. |
| **Entity Framework Core 8** | ORM chính để thao tác dữ liệu (Code-First) với PostgreSQL. |
| **TypeScript (TSX)** | Ngôn ngữ chủ đạo với kiểm soát kiểu tĩnh, dùng để xây dựng Frontend React/Next.js. |
| **JavaScript (ES6+)** | Chạy độc lập trên Cloudflare Workers đóng vai trò bảo mật CDN không máy chủ (Serverless). |
| **PostgreSQL** | Hệ quản trị CSDL quan hệ chính yếu, mạnh mẽ và nhất quán. |
| **Redis** | Quản lý bộ nhớ đệm tốc độ cao (Caching) và Hàng đợi tác vụ (Message Queue cho Ingest). |
| **Next.js 14 & React 18** | Framework Client/Server-side Rendering, cực kì tối ưu SEO và tốc độ tải trang. |
| **TailwindCSS & CoreUI** | Xây dựng giao diện hướng tiện ích, cho phép tạo UI phức tạp cực nhanh và chuẩn Responsive. |
| **FFmpeg** | Xử lý đa phương tiện bên dưới (Tách khung hình, chuyển mã độ phân giải, băm nhỏ tệp HLS). |

---

## 📂 3. CẤU TRÚC HỆ THỐNG (MICROSERVICES-LITE)

Dự án thiết kế theo hướng phân tán module tinh gọn:

```text
ProjectTviEn/
├── backend/                  # API Trung tâm: Cung cấp Endpoints, kết nối CSDL, cấp quyền JWT
├── ProjectTviEn.Worker/      # Dịch vụ ngầm (Background Worker): Nhận job từ Redis, xử lý tải/FFmpeg transcode/upload ngược
├── user-frontend/            # Next.js App: Bao gồm cả luồng User hiển thị phim lẫn nhánh Admin (/admin)
├── cloudflare-worker/        # Edge Computing: Chặn truy cập trái phép, phát luồng trực tiếp từ Cloudflare R2
├── docker-data/              # Dữ liệu bền vững ánh xạ từ Docker containers (Postgres, Redis, logs)
├── docs/                     # Tài liệu kỹ thuật: Cấu trúc thư mục, từ điển dữ liệu (Data Dictionary)
├── scripts/ & *.bat          # Kịch bản tự động hóa (Khởi chạy Start/Stop, dọn dẹp port, migration)
└── docker-compose.yml        # Orchestration cục bộ: Chỉ bằng 1 lệnh là có ngay Postgres, Redis, Prometheus
```

---

## 🔄 4. CÁCH THỨC HOẠT ĐỘNG CỦA LUỒNG XỬ LÝ (CORE WORKFLOW)

Đây là giá trị cốt lõi nhất làm nên dự án chuyên nghiệp: **Quy trình Ingest & Streaming**.

1. **Upload (Ingest Request):** 
   - Admin chỉ định tệp video thô (mp4, mkv). Backend API đẩy thông tin Job vào **hàng đợi Redis (`tvien:ingest_queue`)**.
2. **Xử lý ngầm (Transcoding):** 
   - `.NET Worker` liên tục lắng nghe Redis. Khi có Job, Worker tải video thô về.
   - Worker gọi lệnh **FFmpeg** để cắt nhỏ video thành hàng ngàn mảnh (`.ts`) và tạo các danh sách phát m3u8 (Master Playlist & Media Playlists) theo nhiều chuẩn (1080p, 720p).
3. **Phân phối (CDN Upload):** 
   - Worker tự động tải toàn bộ các tệp `.m3u8` và `.ts` đã băm nhỏ này lên một không gian kín (Private Bucket) trên **Cloudflare R2**. Đánh dấu Job hoàn thành trên Database.
4. **Trình chiếu (Secure Streaming):** 
   - Khi User bấm xem, Backend cấp cho Player một thẻ `JWT Token`.
   - Player gửi Request tải `.m3u8` đến **Cloudflare Worker (Gatekeeper)** kèm Token đó.
   - Gatekeeper tính toán chữ ký số siêu tốc. Đúng Token -> Lấy mảnh Video từ R2 trả về. Sai Token -> Chặn ngay lập tức tại biên mạng.

---

## 🌍 5. TÌNH TRẠNG HOẠT ĐỘNG (LOCAL VS. DEPLOYMENT)

Hiện tại, hệ thống đã được thiết kế sẵn sàng cho cả hai môi trường với sự tách bạch rạch ròi. Dưới đây là phân tích chi tiết:

### 🏠 Hoạt động tại Local (Môi trường Phát triển)
- **Tình trạng: HOẠT ĐỘNG HOÀN HẢO VÀ CỰC KỲ MƯỢT MÀ.**
- **Tiện ích tối đa:** 
  - Toàn bộ cơ sở dữ liệu (`PostgreSQL`), bộ nhớ đệm (`Redis`) và công cụ giám sát (`Prometheus`, `Grafana`) đã được thiết lập sẵn trong `docker-compose.yml`. Chỉ cần chạy Docker là có ngay hạ tầng.
  - Các script batch (`start-all.bat`, `stop-all.bat`) giúp khởi động toàn bộ cụm: Backend API, Background Worker, và Frontend Next.js chỉ trong nháy mắt. Đặc biệt script `stop-all.bat` có cơ chế dọn dẹp tiến trình rác rất sạch sẽ.
- **Chất lượng Build:** Toàn bộ Backend/Worker không có cảnh báo lỗi (Clean Build), đã fix hoàn toàn lỗi Async và Nullable.

### 🚀 Hoạt động trên môi trường Deploy (Production)
- **Hạ tầng Streaming (Đã thực tế hoạt động trên Cloud):** 
  - Riêng phần lõi lưu trữ và phân phát luồng HLS **hiện đang chạy thực tế trên hạ tầng Cloudflare R2 và Cloudflare Workers**. Code phần này không chạy giả lập ở Local mà thực sự nối thẳng lên CDN, chứng minh kiến trúc đám mây đang vận hành tốt.
- **Backend & Database (Sẵn sàng Deploy):**
  - Trong tệp cấu hình `Program.cs`, Backend đã được viết sẵn thuật toán "Resilient Connection" tự động đọc và phân tích biến môi trường `DATABASE_URL` (theo chuẩn của các nhà cung cấp như **Render.com** hoặc **Railway**), tự chuyển đổi thành Connection String của PostgreSQL. Nghĩa là đưa lên Cloud là chạy, không cần sửa code.
  - Kiến trúc "Fault-Tolerant": Kể cả nếu Redis hay Prometheus trên Cloud bị sập hoặc chưa thiết lập, Backend vẫn không bị treo máy mà chỉ tắt các tính năng phụ trợ.
- **Frontend Next.js (Sẵn sàng Deploy):**
  - Hoàn toàn tuân thủ tiêu chuẩn của **Vercel** hoặc **Cloudflare Pages**.

> **🌟 Tổng kết lại:** Ở môi trường **Local**, bạn có thể trải nghiệm toàn bộ quy trình mượt mà (từ quản trị đến xem phim) như một bản thu nhỏ. Khi mang đi thuyết trình (bảo vệ đồ án), kiến trúc lai (Hybrid) kết hợp lưu trữ Streaming thật trên **Cloudflare** + Các service chạy cục bộ (hoặc đẩy lên Render/Vercel) sẽ tạo ra một hệ thống chịu tải mạnh mẽ không kém các nền tảng thật.
