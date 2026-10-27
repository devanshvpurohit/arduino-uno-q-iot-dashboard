import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arduino UNO Q — Real-Time IoT Telemetry Dashboard",
  description:
    "Real-time telemetry dashboard for Arduino UNO Q connected to NEO-6M GPS, MPU6050 IMU, and SSD1306 OLED with zero persistent database storage.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full bg-slate-950">
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
