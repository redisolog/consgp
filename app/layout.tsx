import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "Поля — A5 конспекты", description: "Редактор рукописных конспектов с точной подготовкой к печати A5." };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="ru"><body>{children}</body></html>; }
