import type { Metadata } from "next";
import { Courier_Prime } from "next/font/google";
import { CampaignBackground } from "@/components/layout/campaign-background";
import "./globals.css";

const courier = Courier_Prime({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-retro",
});

export const metadata: Metadata = {
  title: "Campaign Table",
  description: "Live D&D party sheet",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${courier.variable} h-full`}>
      <body className="retro-body">
        <CampaignBackground />
        <div className="retro-page">{children}</div>
      </body>
    </html>
  );
}
