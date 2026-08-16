# Guti.mx — arquitectura inicial


## Versiones actualizadas

Esta entrega ya fue actualizada para evitar el bloqueo de Vercel por versiones vulnerables de Next.js:

- Next.js: `16.3.0`
- React: `19.2.0`
- React DOM: `19.2.0`
- Node.js: `>=20.9.0`

Si Vercel conserva un build anterior, haz **Redeploy** sin usar la caché anterior.

### Importante al subir a Vercel

Como el repositorio es un monorepo, crea un proyecto de Vercel por aplicación y usa estos **Root Directory**:

- Cliente: `apps/cliente`
- Negocio: `apps/negocio`
- Repartidor: `apps/repartidor`
- Admin: `apps/admin`

Dominios sugeridos:

- `guti.mx`
- `negocios.guti.mx`
- `repartidor.guti.mx`
- `admin.guti.mx`


Monorepo con cuatro aplicaciones:

- `apps/cliente` — aplicación para clientes.
- `apps/negocio` — panel de restaurantes/tiendas.
- `apps/repartidor` — aplicación para repartidores Guti.
- `apps/admin` — panel administrativo.
- `supabase/schema.sql` — esquema inicial de base de datos.
- `supabase/seed.sql` — negocios y productos básicos de prueba.

## Reglas actuales del negocio

- Ciudad: Gutiérrez Zamora, Veracruz.
- Tarifa de envío: $45 fija.
- Comisión a negocios: 10%.
- Negocios iniciales: La Galera, Exprimidos, OXXO y Bodega Aurrera.
- La Galera puede usar reparto propio.
- Los repartidores Guti eligen pedidos disponibles.
- El negocio acepta cada pedido manualmente.
- Pagos: efectivo, tarjeta, transferencia y Guti Balance.
- Referidos y puntos.
- Soporte: 5623449135.

## 1. Crear Supabase

Crea un proyecto nuevo y abre **SQL Editor**.

1. Ejecuta `supabase/schema.sql`.
2. Después ejecuta `supabase/seed.sql`.
3. En Project Settings copia:
   - Project URL
   - anon/public key
   - service role key (solo servidor; jamás exponer al navegador)

## 2. Auth

Activa:
- Email / password
- Phone OTP
- Google
- Apple

Para producción, configura SMTP propio para correos y un proveedor SMS compatible con Supabase para OTP.

## 3. Google Maps

En Google Cloud habilita:
- Maps JavaScript API
- Places API
- Geocoding API

Crea una API key restringida a los dominios de Guti.mx. La app deberá guardar tanto la dirección escrita como `lat/lng` y las instrucciones de entrega.

## 4. Variables

Copia `.env.example` a `.env.local` en cada app durante desarrollo.

## 5. Desarrollo local

Desde la raíz:

```bash
npm install
npm run dev:cliente
```

En otras terminales:

```bash
npm run dev:negocio
npm run dev:repartidor
npm run dev:admin
```

## 6. Vercel

Importa el mismo repositorio cuatro veces como proyectos distintos y asigna el Root Directory correspondiente:

- `apps/cliente`
- `apps/negocio`
- `apps/repartidor`
- `apps/admin`

Dominios recomendados:

- `guti.mx` → cliente
- `negocios.guti.mx` → negocio
- `repartidor.guti.mx` → repartidor
- `admin.guti.mx` → admin

Agrega las variables de entorno en cada proyecto. La `SUPABASE_SERVICE_ROLE_KEY` debe existir solo en proyectos/funciones que realmente la necesiten y nunca debe usarse en componentes de cliente.

## Próxima fase

Falta conectar estas pantallas al backend real:

1. Auth y perfiles.
2. Alta/edición de productos e imágenes con Supabase Storage.
3. Carrito y creación de pedidos.
4. Aceptación manual por negocio.
5. Pool de pedidos disponibles para repartidores.
6. Tracking en tiempo real.
7. Mapa/pin de dirección.
8. Pagos.
9. Puntos y referidos.
10. Notificaciones push.
