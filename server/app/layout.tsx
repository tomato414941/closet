export const metadata = {
  title: 'Closet API Server',
  description: 'Backend API for Closet app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
