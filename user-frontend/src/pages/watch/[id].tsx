import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { ArrowLeft, Loader2, AlertCircle } from 'lucide-react';

// ---- TYPES ----
interface PlayInfo {
  movieId: string;
  title: string;
  playUrl: string;
  token: string;
  expiresInHours: number;
}

// ---- HLS VIDEO PLAYER ----
const VideoPlayer = ({ playUrl, token }: { playUrl: string; token: string }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playUrl) return;

    let hls: any = null;

    const initPlayer = async () => {
      // Lazy-import hls.js để tránh lỗi SSR
      const Hls = (await import('hls.js')).default;

      if (Hls.isSupported()) {
        hls = new Hls({
          // ==============================================================
          // ĐÂY LÀ CỐT LÕI CỦA KẾ HOẠCH MVP:
          // xhrSetup tự động đính kèm ?token=JWT vào mọi request con:
          // - File playlist con (.m3u8)
          // - File video phân mảnh (.ts)
          // - File chìa khóa giải mã (.key)
          // Worker Cloudflare sẽ nhận và verify token này.
          // ==============================================================
          xhrSetup: (xhr: XMLHttpRequest, url: string) => {
            const separator = url.includes('?') ? '&' : '?';
            xhr.open('GET', `${url}${separator}token=${token}`, true);
          },
          debug: false,
        });

        hls.loadSource(playUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {
            // Autoplay bị chặn bởi trình duyệt là chuyện bình thường
          });
        });

        hls.on(Hls.Events.ERROR, (_event: any, data: any) => {
          if (data.fatal) {
            // Nếu lỗi 403: Token hết hạn
            if (data.response?.code === 403) {
              alert('⏳ Phiên xem phim đã hết hạn.\nTrang sẽ tự tải lại để lấy vé mới...');
              window.location.reload();
            }
          }
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Safari hỗ trợ HLS gốc (không dùng được xhrSetup)
        video.src = `${playUrl}&token=${token}`;
      }
    };

    initPlayer();

    return () => {
      if (hls) hls.destroy();
    };
  }, [playUrl, token]);

  return (
    <video
      ref={videoRef}
      controls
      className="w-full h-full"
      style={{ maxHeight: '75vh', background: '#000' }}
    />
  );
};

// ---- MAIN WATCH PAGE ----
export default function WatchPage() {
  const router = useRouter();
  const { id } = router.query;

  const [playInfo, setPlayInfo] = useState<PlayInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setError(null);

    fetch(`http://localhost:5113/api/admin/Movies/${id}/play`)
      .then(res => {
        if (!res.ok) throw new Error(`Lỗi ${res.status}: Không tìm thấy phim hoặc server gặp sự cố.`);
        return res.json();
      })
      .then((data: PlayInfo) => {
        setPlayInfo(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  return (
    <>
      <Head>
        <title>{playInfo?.title ?? 'Đang tải...'} — Streaming Movies VN</title>
      </Head>

      <div className="min-h-screen bg-[#0a0a0a] text-white">
        {/* Header */}
        <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-4 px-6 py-4 bg-gradient-to-b from-black/80 to-transparent backdrop-blur-sm">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Quay lại</span>
          </button>
          {playInfo && (
            <h1 className="text-white font-bold text-lg truncate">{playInfo.title}</h1>
          )}
        </div>

        {/* Player Area */}
        <div className="pt-0 flex flex-col items-center justify-center min-h-screen">
          {loading && (
            <div className="flex flex-col items-center gap-4 text-gray-400">
              <Loader2 className="w-12 h-12 animate-spin text-white" />
              <p className="text-sm">Đang chuẩn bị phim...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-4 text-red-400 max-w-md text-center px-4">
              <AlertCircle className="w-12 h-12" />
              <p className="font-semibold">Không thể phát phim</p>
              <p className="text-sm text-gray-500">{error}</p>
              <button
                onClick={() => router.push('/')}
                className="mt-4 px-6 py-2 bg-white text-black rounded-full text-sm font-semibold hover:bg-gray-200 transition"
              >
                Quay về trang chủ
              </button>
            </div>
          )}

          {!loading && !error && playInfo && (
            <div className="w-full">
              {/* Video Player */}
              <div className="w-full bg-black flex items-center justify-center">
                <VideoPlayer playUrl={playInfo.playUrl} token={playInfo.token} />
              </div>

              {/* Movie Info */}
              <div className="max-w-5xl mx-auto px-6 py-8">
                <h2 className="text-3xl font-black mb-2">{playInfo.title}</h2>
                <div className="flex items-center gap-3 text-sm text-gray-400">
                  <span className="px-2 py-0.5 border border-gray-600 rounded text-xs uppercase tracking-widest">
                    HD
                  </span>
                  <span>Phiên xem hợp lệ trong {playInfo.expiresInHours} tiếng</span>
                </div>

                {/* Dev Info — xóa khi đã ra Production */}
                <details className="mt-6 text-xs text-gray-700">
                  <summary className="cursor-pointer hover:text-gray-500">🔧 Debug Info (Development)</summary>
                  <div className="mt-2 p-3 bg-gray-900 rounded-lg font-mono break-all">
                    <p><span className="text-gray-500">Movie ID:</span> {playInfo.movieId}</p>
                    <p className="mt-1"><span className="text-gray-500">Play URL:</span> {playInfo.playUrl}</p>
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
