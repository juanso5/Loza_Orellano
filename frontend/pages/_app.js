import '../styles/cobros.css';
import '../styles/home.css';
import '../styles/sidebar.css';
import '../styles/fondos.css';
import '../styles/movimientos.css';
import '../styles/clientes.module.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

import Head from 'next/head';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
