# Live Events Web

Frontend para la plataforma de eventos en vivo. Construido con React, Vite y Mantine UI.

## Características principales
- Visualización y registro en eventos en vivo
- Administración de organizaciones y branding
- Autenticación con Firebase
- Paneles de administración y métricas en tiempo real
- UI moderna y responsiva

## Estructura
- `src/pages/`: Vistas principales (eventos, organizaciones, home)
- `src/components/`: Componentes reutilizables (eventos, branding, formularios)
- `src/api/`: Conexión con el backend (eventos, organizaciones)
- `src/auth/`: Proveedor y hooks de autenticación
- `src/hooks/`: Hooks para datos en tiempo real y métricas
- `src/core/`: Configuración de API, Firebase y entorno

## Instalación
```bash
pnpm install
```

## Configuración
Crea un archivo `.env.local` con las variables necesarias (ver ejemplo en el backend).

## Ejecución
```bash
pnpm dev
```

## Scripts útiles
- `pnpm build` - Compila la app para producción
- `pnpm preview` - Previsualiza el build

## Principales vistas
- Home: Página principal
- Eventos: Listado y detalle de eventos
- Organizaciones: Landing y panel admin
- Registro: Formularios avanzados de inscripción
- Admin: Paneles de control y métricas