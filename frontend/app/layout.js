export const metadata = { title: 'Loza Orellano' };

import '../styles/cobros.css';
import '../styles/home.css';
import '../styles/sidebar.css';
import '../styles/fondos.css';
import '../styles/movimientos.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

export default function RootLayout({ children }) {
  return (
    <html lang="es">
  <body>{children}</body>
    </html>
  );
}