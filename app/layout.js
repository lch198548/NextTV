import "./globals.css";
import { Navbar } from "../components/Navbar";
import { Footer } from "../components/Footer";
import { Noto_Serif_SC, Inter } from "next/font/google";

// 英文字体：Inter（风格类似 Google Sans）
const inter = Inter({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

// 中文字体：Noto Serif SC
const notoSerifSC = Noto_Serif_SC({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "chinese-simplified"],
  display: "swap",
  variable: "--font-noto-serif-sc",
});

export const metadata = {
  title: "NextTV - 影视无限",
  description: "NextTV 影视播放平台",
  other: {
    "preconnect-googleapis": "https://fonts.googleapis.com",
    "preconnect-gstatic": "https://fonts.gstatic.com",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN" className={`${inter.variable} ${notoSerifSC.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background-light text-gray-900 min-h-screen flex flex-col selection:bg-primary selection:text-white">
        <Navbar />
        <main className="flex-1 flex flex-col items-center w-full px-4 md:px-8 pb-12">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
