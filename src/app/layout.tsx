import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TASKFORCE IQ — Brownie Heaven",
  description: "Staff accountability system",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "TASKFORCE IQ" },
  icons: { apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Applies the saved theme/accent before first paint, so there's no flash of the wrong colors. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("tf_theme")||"dark";var a=localStorage.getItem("tf_accent")||"yellow";document.documentElement.setAttribute("data-theme",t);document.documentElement.setAttribute("data-accent",a);}catch(e){}})();`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
