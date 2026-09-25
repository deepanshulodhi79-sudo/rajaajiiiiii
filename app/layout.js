import "./globals.css";

export const metadata = {
  title: "Mail Sender",
  description: "Simple SMTP email sender"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
