# Especificación de Arquitectura Técnica: Talent IA Frontend

**Proyecto:** Talent IA (EAS AI Recruiting & Scheduling Platform)  
**Organización:** EAS Consulting Group  
**Repositorio Oficial:** `https://github.com/eaguilarh01/talent_ia_frontend.git`  
**Autor de Entrega:** Enrique Aguilar (`e.aguilarhernandez2@dxc.com`)  
**Versión del Sistema:** 2.0.0 (Arquitectura Desacoplada)  
**Fecha:** Noviembre 2026  

---

## 1. Visión General de la Capa Frontend

El repositorio `talent_ia_frontend` implementa la aplicación cliente **Single Page Application (SPA)** de Talent IA, construida sobre **React 19**, **TypeScript 5.8**, **Vite 6** y **Tailwind CSS v4** (`@tailwindcss/vite`). Su función es ofrecer una interfaz analítica y operativa de alta respuesta para los tres perfiles autorizados (`ADMIN`, `RECRUITER`, `MANAGER`) y el portal público de postulación (`CareersPortal`).

En producción se distribuye mediante una imagen Docker multi-etapa (`node:20-slim` para compilación estática + `nginx:alpine` para entrega), con compresión Gzip, cabeceras de endurecimiento HTTP (hardening) y proxy reverso interno hacia la API REST del servicio `eas-backend`.

---

## 2. Stack Tecnológico

| Capa / Componente | Tecnología | Versión | Propósito Operativo |
|---|---|---|---|
| **Librería UI** | React | 19.0.1 | Renderizado reactivo, hooks y manejo modular de vistas |
| **Lenguaje** | TypeScript | ~5.8.2 | Tipado estático e interfaces compartidas con el dominio |
| **Empacador / Dev Server** | Vite | ^6.2.3 | Hot Module Replacement (HMR) y bundling optimizado |
| **Estilos** | Tailwind CSS v4 | ^4.1.14 | Plugin `@tailwindcss/vite`, tokens corporativos y CSS de impresión |
| **Visualización de Datos** | Recharts | ^3.8.1 | Gráficos ejecutivos, embudos y métricas de sourcing |
| **Iconografía y Animación** | Lucide React / Motion | ^0.546.0 / ^12.23.24 | Íconos vectoriales SVG y transiciones de interfaz |
| **Servidor Producción** | Nginx Alpine | nginx:alpine | Reverse proxy `/api/*` y `/auth/*`, compresión gzip y fallback SPA |

---

## 3. Topología de Red y Reverse Proxy Nginx (`nginx.conf`)

La SPA no establece conexiones directas con PostgreSQL ni almacena secretos de proveedores IA en código fuente. Toda comunicación transaccional fluye a través de Nginx en el puerto `80` (mapeado externamente a `8080:80`) hacia el contenedor `eas-backend:3000`:

1. **Rutas Estáticas SPA (`/`):** Sirve `/usr/share/nginx/html` con `try_files $uri $uri/ /index.html;` para resolver rutas de cliente sin errores 404.
2. **Proxy API (`/api/` y `/auth/`):** Reenvía tráfico hacia `http://eas-backend:3000/api/` y `http://eas-backend:3000/auth/` preservando `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto` y `client_max_body_size 50M` para carga masiva de CVs.
3. **Hardening y Compresión:** Habilita `gzip on` para texto, CSS, JS, JSON y SVG; inyecta `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy`.

---

## 4. Estructura Jerárquica del Repositorio

```
talent_ia_frontend/
|-- public/
|   |-- eas_logo.png                    # Logotipo corporativo EAS Consulting
|   |-- favicon.ico                     # Ícono de pestaña
|   \-- favicon.png                     # Isotipo en alta resolución
|-- src/
|   |-- App.tsx                         # Orquestador principal, router de vistas y login
|   |-- api.ts                          # Cliente HTTP centralizado (authFetch, manejo 401)
|   |-- index.css                       # Directivas Tailwind v4 y variables de diseño
|   |-- main.tsx                        # Punto de entrada ReactDOM
|   |-- types.ts                        # Contratos TypeScript de Candidate, Vacancy y RBAC
|   |-- components/
|   |   |-- AdminPanel.tsx              # Gobernanza ISO, auditoría LFPDPPP y seguridad JWT
|   |   |-- AuditLogPanel.tsx           # Visor en tiempo real de log_auditoria
|   |   |-- CalendarPanel.tsx           # Agenda y programación de entrevistas
|   |   |-- CandidatePanel.tsx          # Expedientes, FitScore, Double-Check y Speech
|   |   |-- CareersPortal.tsx           # Portal público externo de vacantes
|   |   |-- DashboardPanel.tsx          # Tablero ejecutivo KPIs y gráficos Recharts
|   |   |-- EasLogo.tsx                 # Identidad visual corporativa
|   |   |-- ErrorBoundary.tsx           # Contención de errores en tiempo de renderizado
|   |   |-- FitGauge.tsx                # Tacómetro visual de compatibilidad
|   |   |-- ForcePasswordChangeModal.tsx# Cambio obligatorio en primer acceso
|   |   |-- ForgotPasswordModal.tsx     # Flujo de recuperación por PIN vía n8n
|   |   |-- InactivityModal.tsx         # Alerta de cierre de sesión por inactividad
|   |   |-- InviteModal.tsx             # Invitación y convocatoria a entrevista
|   |   |-- MfaModal.tsx                # Verificación en dos pasos
|   |   |-- PasswordChangeModal.tsx     # Actualización voluntaria de credenciales
|   |   |-- Sidebar.tsx                 # Menú lateral colapsable condicionado por rol
|   |   |-- UserManagementPanel.tsx     # Gestión de cuentas y roles RBAC
|   |   |-- VacanciesPanel.tsx          # Administración de vacantes y niveles guía
|   |   \-- candidate/
|   |       \-- CandidateFitMatrix.tsx  # Matriz analítica de competencias
|   |-- context/
|   |   |-- CandidateContext.tsx        # Estado global de candidatos y filtros
|   |   \-- VacancyContext.tsx          # Estado global de vacantes activas
|   |-- data/
|   |   \-- samples.ts                  # Estructuras base y catálogos iniciales
|   \-- utils/
|       |-- areas.ts                    # Normalización de áreas operativas
|       |-- auditLogger.ts              # Registro estructurado de eventos cliente
|       |-- canonicalCvNormalizer.ts    # Limpieza canónica en vista previa
|       |-- clipboardUtils.ts           # Copiado de speeches y reactivos
|       |-- doubleCheckEvaluator.ts     # Evaluación local y validación de respuestas
|       |-- questionEngine.ts           # Motor de reactivos técnicos situacionales
|       |-- securityUtils.ts            # Utilidades de sesión e inactividad
|       |-- textRepair.ts               # Corrección de mojibake UTF-8
|       |-- vacancyUtils.ts             # Cálculo de FitScore 4D y niveles guía
|       \-- *.test.ts                   # Suites de pruebas unitarias (tsx)
|-- docs/                               # Documentación oficial PDF y Draw.io
|-- .env.example                        # Plantilla segura de variables Vite
|-- .gitignore                          # Exclusiones Git permitiendo !docs/**
|-- Dockerfile                          # Build multi-etapa Node 20 + Nginx Alpine
|-- index.html                          # Documento raíz HTML5
|-- nginx.conf                          # Configuración productiva de proxy y hardening
|-- package.json                        # Dependencias y scripts dev/build/lint/test
|-- tsconfig.json                       # Configuración TypeScript JSX
\-- vite.config.ts                      # Configuración de bundler y proxy de desarrollo
```

---

## 5. Gestión de Estado, Cliente HTTP y Seguridad

### 5.1 Contextos React (`CandidateContext` y `VacancyContext`)
Centralizan los catálogos activos en memoria del navegador, evitan prop-drilling entre paneles y sincronizan altas, ediciones, filtros por área/CECO y cambios de etapa contra `/api/candidates` y `/api/vacancies`.

### 5.2 Interceptor `authFetch` y Manejo de Sesión JWT
- Todas las llamadas protegidas usan `authFetch()` definido en `src/api.ts`.
- Adjunta automáticamente `Authorization: Bearer <token>` leído desde `localStorage` (`auth_token` / `eas_auth_token`).
- Ante un código `401 Unauthorized` (sesión caducada o revocada), emite el evento global `eas:auth_expired` para redirigir limpiamente al login sin estados bloqueados.
- Se eliminó por completo la dependencia de Microsoft M365 / Azure AD en favor de autenticación JWT nativa.

### 5.3 Visibilidad por Rol RBAC en Interfaz
- **`ADMIN`:** Acceso integral incluyendo gestión de usuarios, auditoría inmutable y controles ISO/LFPDPPP.
- **`RECRUITER`:** Gestión operativa completa de vacantes, carga de CVs, FitScore, Double-Check, speeches y agenda.
- **`MANAGER`:** Consulta de vacantes asignadas, revisión de ternas, evaluación Double-Check y aprobación para entrevista.

---

## 6. Compilación, Pruebas y Despliegue

```bash
# Instalación de dependencias
npm install

# Desarrollo local (Vite proxy hacia localhost:3000)
npm run dev

# Validación de tipos TypeScript y pruebas unitarias
npm run lint
npm test

# Compilación productiva y contenedor Docker
npm run build
docker build -t talent-ia-frontend:2.0 .
docker run -d -p 8080:80 --name eas-recruiting-frontend talent-ia-frontend:2.0
```

