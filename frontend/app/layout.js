export const metadata = { 
  title: 'L&O',
  icons: {
    icon: '/favicon.svg',
  }
};
import '../styles/cobros.css';
import '../styles/home.css';
import '../styles/sidebar.css';
import '../styles/fondos.css';
import '../styles/movimientos.css';
import '../components/ui/ui-components.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import { AppDataProvider } from '../components/AppDataProvider';
export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <AppDataProvider>
          {children}
        </AppDataProvider>
      </body>
    </html>
  );
}