Loza Orellano - Next.js migration (auto-generated)

Contenido:
- Next.js app scaffold with pages for Login, Home, Clientes, Fondos, Movimientos.
- Original frontend files copied under /public/original (keeps original HTML/CSS/JS).
- API routes:
  - /api/session
  - /api/upload-csv
  - /api/create-profile
- Supabase client in /lib. Copy your .env.local from .env.example.

How to use:
1. Copy .env.example to .env.local and fill Supabase keys.
2. npm install
3. npm run dev
4. Open http://localhost:3000

Note: The original HTML is accessible at /original/*.html (served statically).
