# BirthPay (Netlify + Supabase)

Sistema simple para gestionar pedidos de almuerzos por cumpleaños/eventos:
- 1 evento activo a la vez
- Pedidos públicos (formulario)
- Lista pública con total final y estado pagado/pendiente
- Admin (usuario/clave) para: crear/activar evento, editar/anular pedidos, marcar pagados, configurar propina/torta/otros
- Reparto automático:
  - Cumpleañero paga 0
  - Practicante paga solo lo suyo (no cuota)
  - N.A paga lo suyo + cuota
  - Cuota = (propina+torta+otros + total consumo cumpleañeros) / #N.A

## Requisitos
- Node 18+
- Cuenta en Supabase
- Cuenta en Netlify

## Variables de entorno
Crea un `.env` local (para desarrollo) basado en `.env.example`.

En Netlify (Site settings > Environment variables) define:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- ADMIN_USER
- ADMIN_PASS
- ADMIN_JWT_SECRET

## Desarrollo local
```bash
npm install
npm run dev
```

## Deploy
Netlify detecta `netlify.toml`.
Build command: `npm run build`
Publish: `dist`
Functions: `netlify/functions`
