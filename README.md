# Talent IA — Frontend SPA (`talent_ia_frontend`)

**Repositorio Oficial:** `https://github.com/eaguilarh01/talent_ia_frontend.git`  
**Organización:** EAS Consulting Group  
**Autor de Entrega:** Enrique Aguilar (`e.aguilarhernandez2@dxc.com`)  
**Versión:** 2.0.0 (Arquitectura Desacoplada)  

Aplicación cliente Single Page Application (SPA) para la plataforma inteligente de reclutamiento, evaluación curricular y agendamiento **Talent IA**.

---

## 1. Documentación Técnica y Paquete de Entrega (`docs/`)

- **Especificación de Arquitectura Frontend (PDF):** [`docs/ARQUITECTURA_FRONTEND.pdf`](docs/ARQUITECTURA_FRONTEND.pdf) ([Fuente Markdown](docs/ARQUITECTURA_FRONTEND.md))
- **Memoria Técnica del Proyecto (PDF):** [`docs/MEMORIA_TECNICA_PROYECTO_TESIS.pdf`](docs/MEMORIA_TECNICA_PROYECTO_TESIS.pdf)
- **Temario de Entrega Técnica Frontend & Backend (PDF):** [`docs/TEMARIO_DE_ENTREGA_TECNICA_FRONTEND_BACKEND.pdf`](docs/TEMARIO_DE_ENTREGA_TECNICA_FRONTEND_BACKEND.pdf)
- **Manuales Operativos por Rol (PDF):**
  - [`docs/MANUAL_OPERATIVO_ADMINISTRADOR.pdf`](docs/MANUAL_OPERATIVO_ADMINISTRADOR.pdf) (Rol `ADMIN`)
  - [`docs/MANUAL_OPERATIVO_RECLUTADOR.pdf`](docs/MANUAL_OPERATIVO_RECLUTADOR.pdf) (Rol `RECRUITER`)
  - [`docs/MANUAL_OPERATIVO_MANAGER.pdf`](docs/MANUAL_OPERATIVO_MANAGER.pdf) (Rol `MANAGER`)
- **Diagrama de Arquitectura Editable (Draw.io):** [`docs/diagrama_arquitectura.drawio`](docs/diagrama_arquitectura.drawio)

---

## 2. Stack Tecnológico

- **Librería UI:** React 19 (`19.0.1`)
- **Lenguaje:** TypeScript `~5.8.2`
- **Bundler / Dev Server:** Vite `^6.2.3`
- **Framework CSS:** Tailwind CSS v4 (`@tailwindcss/vite`)
- **Gráficos e Iconografía:** Recharts `^3.8.1`, Lucide React `^0.546.0`, Motion `^12.23.24`
- **Servidor Producción:** Nginx Alpine con compresión Gzip, hardening HTTP y reverse proxy (`/api/*` y `/auth/*` hacia `eas-backend:3000`)

---

## 3. Arranque Local y Pruebas

```bash
# 1. Instalar dependencias
npm install

# 2. (Opcional) Configurar variables si no se usa proxy local
cp .env.example .env

# 3. Iniciar servidor de desarrollo (puerto 5173 con proxy hacia :3000)
npm run dev

# 4. Verificación de tipos TypeScript y pruebas unitarias
npm run lint
npm test

# 5. Compilar paquete estático productivo en dist/
npm run build
```

---

## 4. Despliegue con Docker

```bash
docker build -t talent-ia-frontend:2.0 .
docker run -d -p 8080:80 --name eas-recruiting-frontend talent-ia-frontend:2.0
```
