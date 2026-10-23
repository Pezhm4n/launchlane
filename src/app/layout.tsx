import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./studio.css";
import "./assistant-studio.css";
import "./source-picker.css";
import "./motion.css";
import "./mobile.css";

export const metadata: Metadata = {
  title: "Launchlane",
  description: "دستیار استقرار و بررسی سلامت سرویس با تأیید شما",
  applicationName: "Launchlane",
};

export const viewport: Viewport = {
  themeColor: "#101827",
  colorScheme: "dark",
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
