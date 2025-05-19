/* eslint-disable @typescript-eslint/no-unused-vars */
// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Inter as a base, or your preferred font
import { GeistSans } from "geist/font/sans"; // Using Geist Sans
import { GeistMono } from "geist/font/mono"; // Using Geist Mono
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider"; // Adjust path if necessary
import { Toaster } from "@/components/ui/sonner" // For toast notifications

// If you want to use Inter as the primary font, uncomment and adjust:
// const inter = Inter({
//   subsets: ["latin"],
//   variable: "--font-sans", // You can use --font-sans or a custom variable
// });

export const metadata: Metadata = {
  title: "Finance Planner",
  description: "Personal finance planning and projection tool",
  // Add icons and other metadata as needed
  icons: {
    icon: "/favicon.ico", // Example path, replace with your actual favicon
    // apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Add suppressHydrationWarning to <html> as recommended by next-themes
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
        // If you were using Inter as the primary font for body:
        // className={`${inter.variable} ${GeistSans.variable} ${GeistMono.variable} font-sans antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster richColors position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}