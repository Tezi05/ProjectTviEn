import type { AppProps } from 'next/app'
import Head from 'next/head'
import { Inter, Noto_Serif } from 'next/font/google'
import '../styles/globals.css'
import '../styles/admin.scss'
import { AuthProvider } from '@/context/AuthContext'
import { GoogleOAuthProvider } from '@react-oauth/google'

// Khởi tạo Font chuẩn theo cơ chế tối ưu của Next.js
const inter = Inter({ 
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const notoSerif = Noto_Serif({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-noto-serif',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>TviEn — The Void is Calling</title>
        <meta name="description" content="Nền tảng xem phim trực tuyến điện ảnh TviEn" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet" />
      </Head>
      {/* 
        Gán font vào class root duy nhất. 
        Sử dụng CSS Variable để Tailwind có thể nhận diện.
      */}
      <div className={`${inter.variable} ${notoSerif.variable} font-sans min-h-full flex flex-col antialiased`}>
        <GoogleOAuthProvider clientId={process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "MOCK_CLIENT_ID_WAITING_FOR_USER"}>
          <AuthProvider>
            <Component {...pageProps} />
          </AuthProvider>
        </GoogleOAuthProvider>
      </div>
    </>
  )
}
