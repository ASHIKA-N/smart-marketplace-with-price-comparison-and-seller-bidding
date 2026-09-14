import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "Aroundly — Good finds, closer to home",
    template: "%s | Aroundly",
  },
  description:
    "Discover neighbourhood shops, compare local prices, and find something you love. Your local marketplace in Bengaluru.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
