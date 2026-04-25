/**
 * TviEn Cloudflare Worker — Gatekeeper MVP
 *
 * Nhiệm vụ:
 * 1. Xác thực JWT từ query string ?token=...
 * 2. Tối ưu Cache bằng cách loại bỏ token khỏi Cache Key
 * 3. Bốc file từ R2 (Private Bucket) và trả về nguyên bản
 *
 * Deploy:
 *   1. Truy cập Cloudflare Dashboard > Workers & Pages > Create Worker
 *   2. Paste toàn bộ đoạn code này vào Editor
 *   3. Vào Settings > Bindings > thêm R2 Bucket Binding tên là "TVIEN_BUCKET"
 *   4. Vào Settings > Variables > thêm biến "JWT_SECRET" (khớp với Jwt:Key trong appsettings.json)
 *   5. Deploy và đặt Custom Domain: media.tvien.com (hoặc worker.tvien.com)
 */

// ========== CÀI ĐẶT ==========
const ALLOWED_ORIGINS = [
  'http://localhost:3001',
  'https://tvien.com',          // Thay bằng domain thật của bạn khi ra Production
];

// ========== PHẦN MỀM CHÍNH ==========
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- CORS Preflight ---
    if (request.method === 'OPTIONS') {
      return handleCors(request);
    }

    // --- XÁC THỰC JWT (Bỏ qua với file Public Asset) ---
    const isPublicAsset = url.pathname.endsWith('.jpg') || url.pathname.endsWith('.png') || url.pathname.endsWith('.mp4');

    if (!isPublicAsset) {
      const token = url.searchParams.get('token');
      if (!token) {
        return new Response('403 Forbidden: Token bắt buộc phải có.', { status: 403 });
      }

      const isValid = await verifyJwt(token, env.JWT_SECRET);
      if (!isValid) {
        return new Response('403 Forbidden: Token không hợp lệ hoặc đã hết hạn.', { status: 403 });
      }
    }

    // --- TỐI ƯU CACHE KEY (Xóa token ra khỏi URL để cache có thể dùng chung) ---
    const cacheUrl = new URL(url);
    cacheUrl.searchParams.delete('token');
    const cacheKey = new Request(cacheUrl.toString(), request);

    const cache = caches.default;
    let response = await cache.match(cacheKey);

    if (!response) {
      // CACHE MISS: Bốc file từ R2 Private Bucket
      // Đường dẫn file trên R2: lấy từ pathname, ví dụ /video/{id}/master.m3u8 -> stream/{id}/master.m3u8
      const r2Key = url.pathname.replace(/^\/video\//, 'stream/');

      const object = await env.TVIEN_BUCKET.get(r2Key);

      if (!object) {
        return new Response(`404 Not Found: Không tìm thấy file '${r2Key}' trên R2.`, { status: 404 });
      }

      // Xác định Content-Type
      let contentType = 'application/octet-stream';
      if (r2Key.endsWith('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
      else if (r2Key.endsWith('.ts'))   contentType = 'video/mp2t';
      else if (r2Key.endsWith('.key'))  contentType = 'application/octet-stream';

      const headers = new Headers({
        'Content-Type': contentType,
        'Cache-Control': r2Key.endsWith('.m3u8')
          ? 'public, max-age=30'           // Playlist thay đổi thường xuyên hơn
          : 'public, max-age=3600',        // File .ts và .key ổn định hơn
        'Access-Control-Allow-Origin': getAllowedOrigin(request),
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      });

      response = new Response(object.body, { headers });

      // Lưu vào Cloudflare Cache (chỉ lưu bản sạch không có token)
      await cache.put(cacheKey, response.clone());
    }

    return response;
  }
};

// ========== HÀM HỖ TRỢ ==========

/** Verify JWT bằng Web Crypto API (chạy gốc trong V8, siêu nhanh) */
async function verifyJwt(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);

    const cryptoKey = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signatureInput = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signatureBytes = base64UrlDecode(parts[2]);

    const isValid = await crypto.subtle.verify('HMAC', cryptoKey, signatureBytes, signatureInput);
    if (!isValid) return false;

    // Kiểm tra thời gian hết hạn
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && Date.now() / 1000 > payload.exp) return false;

    return true;
  } catch {
    return false;
  }
}

/** Giải mã base64url sang ArrayBuffer */
function base64UrlDecode(base64url) {
  const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

/** Trả về CORS header phù hợp */
function getAllowedOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  return ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
}

/** Xử lý CORS Preflight */
function handleCors(request) {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': getAllowedOrigin(request),
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    }
  });
}
