export const metadata: Metadata = {
  title: "NextSkill • Autonomous Industrial & Logistics Command Center",
  description: "Enterprise Multi-Agent Autonomous Command Center with LangGraph, ChromaDB, and Google Gemini AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}