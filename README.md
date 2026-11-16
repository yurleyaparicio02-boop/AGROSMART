# AgroSmart

Plataforma integral multi-finca para la administración, control operativo y trazabilidad de explotaciones agrícolas, con enfoque especializado en la gestión de cultivos, control de riego, inventarios, cosecha y comercialización.

---

## Descripción: ¿Qué problema resuelve el software?

En las explotaciones agrícolas tradicionales, la información operativa (riegos, fertilizaciones, siembras, análisis de suelo, consumo de insumos, producción y ventas) suele llevarse en cuadernos físicos, hojas de cálculo aisladas o registros informales. Esto provoca:

* **Pérdida de trazabilidad agronómica:** Dificultad para conocer el historial real de labores aplicadas sobre cada parcela y cultivo.
* **Descontrol de inventarios:** Sobreutilización o desabastecimiento de insumos y semillas al no vincular las aplicaciones de campo y las recepciones de compra con el stock real.
* **Vulnerabilidad y desorden multi-finca:** Falta de aislamiento entre distintas unidades productivas cuando un administrador o agrónomo gestiona varias fincas con diferentes niveles de responsabilidad.
* **Interrupciones por baja conectividad:** Dependencia total de internet permanente en zonas rurales donde la señal es intermitente.
* **Cálculos financieros propensos a error:** Liquidaciones manuales de ventas, facturas de compra, devoluciones y nómina de trabajadores de campo.

**AgroSmart** centraliza y automatiza estos procesos bajo una arquitectura cliente-servidor segura, garantizando el aislamiento de datos por finca, el descuento atómico de existencias y la continuidad operativa en entornos rurales.

---

## Objetivo General

Desarrollar una solución web modular y multi-finca que permita administrar, controlar y auditar de manera organizada los procesos operativos, agronómicos, de inventario y comerciales de una explotación agrícola, asegurando la integridad de los datos y la trazabilidad completa desde la preparación del terreno hasta la comercialización de la cosecha.

---

## Tecnologías Utilizadas

### Backend (API REST)
* **Entorno de ejecución:** Node.js (v20 LTS)
* **Framework web:** Express.js
* **Base de datos y ODM:** MongoDB 7 (con soporte de *Replica Set* para transacciones ACID) + Mongoose
* **Validación de esquemas:** Zod (prevención de inyección NoSQL y validación estricta de datos)
* **Autenticación y Seguridad:** JSON Web Tokens (`jsonwebtoken`), `bcrypt`, `cookie-parser`, `helmet`, `express-rate-limit`, `cors`
* **Reportes y Notificaciones:** `pdfkit` (exportación a PDF al vuelo), `exceljs` (exportación a Excel), `nodemailer` (recuperación de contraseñas)
* **Documentación y Pruebas:** Swagger / OpenAPI (`swagger-ui-express`), Jest + Supertest, ESLint

### Frontend (Interfaz de Usuario)
* **Framework:** Vue 3 (Composition API) + Vite
* **Gestión de estado y enrutamiento:** Pinia + Vue Router
* **Cliente HTTP:** Axios (con interceptores para renovación automática de tokens y manejo de errores)

### Infraestructura y Despliegue
* **Entorno local:** Docker + Docker Compose (base de datos MongoDB local)
* **Despliegue de pruebas:** Render (Web Service unificado) + MongoDB Atlas (Cluster M0)

---

## Estructura de Carpetas del Proyecto

```text
cultivos-app/
├── README.md                        # Guía general de instalación y arquitectura
├── docker-compose.yml               # Base de datos MongoDB local con replica set (rs0)
├── .gitignore                       # Exclusión de node_modules, .env y backend/public
├── docs/                            # Documentación técnica y funcional del proyecto
│   ├── SRS/                         # Especificaciones de requerimientos (RF y RNF)
│   ├── decisiones.md                # Registro de decisiones de arquitectura (ADRs)
│   ├── requisitos.md                # Requerimientos funcionales agrupados por módulo
│   ├── reglas-de-negocio.md         # Catálogo centralizado de reglas de negocio
│   ├── roles-y-permisos.md          # Matriz de control de acceso (RBAC)
│   └── modelo-datos/                # Diagrama y diccionario de colecciones Mongoose
├── backend/
│   ├── package.json
│   ├── .env.example                 # Plantilla de variables de entorno
│   ├── public/                      # Compilado de Vue 3 en producción (ignorado en Git)
│   ├── scripts/
│   │   └── seed.js                  # Creación inicial de roles base y usuario SuperAdmin
│   ├── src/
│   │   ├── app.js                   # Configuración de Express, middlewares y rutas
│   │   ├── server.js                # Conexión a MongoDB e inicio del servidor HTTP
│   │   ├── config/                  # Variables de entorno, conexión DB y Swagger
│   │   ├── middlewares/             # Auth JWT, contexto multi-finca, RBAC, Zod, auditoría y errores
│   │   ├── services/                # Servicios compartidos (exportación PDF/Excel, correo)
│   │   ├── utils/                   # Utilidades de respuesta, paginación y errores HTTP
│   │   └── modules/                 # Módulos del dominio (routes, controller, service, schema, model)
│   │       ├── auth/
│   │       ├── fincas/
│   │       ├── roles/
│   │       ├── usuarios/
│   │       ├── empleados/
│   │       ├── parcelas/
│   │       ├── proveedores/
│   │       ├── insumos/
│   │       ├── semillas/
│   │       ├── maquinaria/
│   │       ├── preparaciones/
│   │       ├── analisis-suelo/
│   │       ├── cultivos/
│   │       ├── siembras/
│   │       ├── riegos/
│   │       ├── fertilizaciones/
│   │       ├── plagas/
│   │       ├── sustratos/
│   │       ├── procesos/
│   │       ├── produccion/
│   │       ├── ventas/
│   │       ├── facturas/
│   │       ├── nomina/
│   │       ├── tareas/
│   │       ├── estadisticas/
│   │       └── auditoria/
│   └── tests/                       # Pruebas automatizadas de integración y reglas de negocio
└── frontend/                        # Aplicación cliente Vue 3 + Vite
```

---

## Requisitos para Ejecutar el Proyecto

Antes de instalar el proyecto en tu entorno local, asegúrate de contar con:

1. **Node.js:** Versión `18.x` o `20.x` LTS instalada.
2. **Gestor de paquetes:** `npm` (incluido con Node.js).
3. **Docker y Docker Compose:** Necesarios para levantar MongoDB configurado como *Replica Set* (`rs0`), indispensable para ejecutar las transacciones atómicas de inventarios y ventas. *(Opcionalmente, puedes usar una URI de MongoDB Atlas).*
4. **Git:** Para clonar el repositorio y gestionar ramas de trabajo.
5. **Cliente HTTP:** Postman, Thunder Client o navegador web para probar los endpoints y la documentación en Swagger.

---

## Instrucciones de Instalación y Ejecución

### 1. Clonar el repositorio
```bash
git clone <URL_DEL_REPOSITORIO>
cd cultivos-app
```

### 2. Levantar la base de datos local con Docker
Inicia el contenedor de MongoDB con soporte de transacciones:
```bash
docker-compose up -d
```

### 3. Configurar variables de entorno del backend
Crea el archivo `.env` a partir de la plantilla `.env.example` dentro de la carpeta `backend/`:
```bash
cd backend
cp .env.example .env
```
Edita `backend/.env` con tus valores locales:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/agrosmart?replicaSet=rs0&directConnection=true
JWT_SECRET=clave_secreta_acceso_desarrollo
JWT_REFRESH_SECRET=clave_secreta_refresh_desarrollo
NODE_ENV=development
```

### 4. Instalar dependencias y cargar datos iniciales (Seed)
```bash
npm install
node scripts/seed.js
```

### 5. Ejecutar el servidor en modo desarrollo
```bash
npm run dev
```
El servidor quedará escuchando en `http://localhost:3000`.
* **Verificación de salud:** `GET http://localhost:3000/api/health`
* **Documentación interactiva (Swagger):** `http://localhost:3000/api-docs`

*(Nota: Cuando se habilite el módulo frontend, se ejecutará desde la carpeta `frontend/` con `npm install` y `npm run dev` utilizando el proxy configurado hacia `/api`).*

---

## Integrantes del Equipo

Programa: **Tecnólogo en Análisis y Desarrollo de Software — SENA**

| Nombre Completo | Rol Inicial Asignado | Usuario GitHub |
| :--- | :--- | :--- |
| *[Nombre Integrante 1]* | Base de datos, modelos Mongoose y migraciones | `@usuario1` |
| *[Nombre Integrante 2]* | Seguridad, autenticación JWT y middlewares RBAC | `@usuario2` |
| *[Nombre Integrante 3]* | Servicios, reglas de negocio y transacciones | `@usuario3` |
| *[Nombre Integrante 4]* | Rutas, controladores, validaciones Zod y Swagger | `@usuario4` |
| *[Nombre Integrante 5]* | Pruebas automatizadas (Jest/Supertest) y despliegue | `@usuario5` |

*(Los roles técnicos rotan al finalizar cada etapa de desarrollo según la metodología de trabajo del equipo).*

---

## Estado Actual del Proyecto

**Fase actual:** **Etapa 0 (Preparación y Arquitectura) completada / Iniciando Etapa 1 (Base Multi-Finca y Seguridad).**

* [x] **Análisis y depuración del SRS:** Requerimientos funcionales (107 originales + 14 nuevos) y no funcionales rectificados y priorizados.
* [x] **Documentación de arquitectura:** Decisiones técnicas (`docs/decisiones.md`), reglas de negocio (`docs/reglas-de-negocio.md`) y matriz de roles (`docs/roles-y-permisos.md`) aprobadas.
* [x] **Modelo de datos NoSQL:** Diseño de colecciones, referencias e índices compuestos para MongoDB definido.
* [ ] **Etapa 1 en curso:** Implementación del núcleo multi-finca (`Fincas`, `UsuariosFincas`), autenticación unificada, manejo de sesiones y despliegue inicial en Render.
* [ ] **Etapas 2 a 8:** Pendientes de construcción modular progresiva según cronograma.