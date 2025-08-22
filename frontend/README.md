# Autenticación con Supabase

Este proyecto fue actualizado para requerir login con Supabase antes de acceder a las pantallas de la app.

## Variables de entorno

Crear un archivo `.env.local` en la raíz del proyecto `frontend` con:

NEXT_PUBLIC_SUPABASE_URL=tu_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key

Puedes obtener estos valores desde tu proyecto de Supabase (Settings -> API).

## Flujo

- Al ingresar a `/` serás redirigido a `/login`.
- El middleware protege todas las rutas excepto `/login` y algunos recursos estáticos.
- Después de loguearte, se redirige a la ruta original o a `/home`.
- Puedes cerrar sesión desde el botón "Salir" en el header.

## Scripts

- dev: inicia el servidor de desarrollo
- build: construye la app
- start: inicia en modo producción

## Notas

- Se usa `@supabase/ssr` para manejar sesión en middleware y en el cliente.
- Las páginas principales están bajo el route group `app/(app)` para aplicar un layout con Sidebar y botón de salir.