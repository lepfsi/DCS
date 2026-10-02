import './globals.css';
import Shell from './shell';

export const metadata = { title: 'DCS - Document Control System', description: 'DailyOps Document Control System' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
