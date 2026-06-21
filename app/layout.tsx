import type { Metadata } from "next";

import "./globals.css";

import { fontGTPlanar, fontGTStandardMono, fontPlain } from "./fonts";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "PLG Dashboard",
  description:
    "Signups, activation, conversion & churn — overlaid with your shipping changelog and social buzz.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={cn(
          fontPlain.variable,
          fontGTPlanar.variable,
          fontGTStandardMono.variable,
        )}
      >
        {children}
      </body>
    </html>
  );
}
