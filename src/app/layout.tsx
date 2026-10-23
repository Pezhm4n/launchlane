import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./studio.css";
import "./assistant-studio.css";

export const metadata: Metadata = {
  title: "Launchlane",
  description: "دستیار استقرار و بررسی سلامت سرویس با تأیید شما",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" className="rtl-enabled">
      <body>
        <a className="skip-link" href="#main-content">
          رفتن به محتوای اصلی
        </a>
        {children}
      </body>
    </html>
  );
}
