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
  title: "dnd-web-ui",
  description: "Live D&D party sheet",
};

const campaignBackgroundInitScript = `(function(){try{var s=localStorage.getItem("campaign-background-enabled");var e=s!=="false";document.documentElement.classList.toggle("campaign-bg-active",e);document.documentElement.dataset.campaignBg=e?"on":"off";}catch(x){document.documentElement.dataset.campaignBg="on";}})();`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${courier.variable} h-full campaign-bg-active`}
      data-campaign-bg="on"
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: campaignBackgroundInitScript }}
        />
      </head>
      <body className="retro-body">
        <CampaignBackground />
        <div className="retro-page">{children}</div>
      </body>
    </html>
  );
}
