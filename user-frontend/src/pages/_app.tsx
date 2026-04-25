import type { AppProps } from 'next/app'
import Head from 'next/head'
import '../styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <title>Streaming movies vn</title>
        <meta name="description" content="Nền tảng xem phim trực tuyến TviEn" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <div className="min-h-full flex flex-col antialiased">
        <Component {...pageProps} />
      </div>
    </>
  )
}
