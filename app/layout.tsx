import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hệ thống Đánh giá Chuyên gia Nha khoa Thường thức",
  description: "Giao diện thẩm định và gán nhãn dữ liệu lâm sàng đa phiên",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}