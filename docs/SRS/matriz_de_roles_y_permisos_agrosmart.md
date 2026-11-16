# Matriz de Roles y Permisos (RBAC) - AgroSmart

**Archivo:** `docs/roles-y-permisos.md`  
**Versión:** 2.0 (Actualizada con ADR-01 y Decisión 03)  
**Propósito:** Definir la jerarquía de acceso, la separación entre personal operativo y cuentas de sistema, y la matriz granular de permisos (`módulo × acción`) almacenada en la colección `Roles` de MongoDB para validar autorizaciones mediante el middleware `checkPermission(modulo, accion)`.

---

## 1. Definición de Roles y Actores del Sistema

De acuerdo con la **Decisión 03** y el **ADR-01**, un mismo usuario puede tener acceso a una o varias fincas mediante la colección intermedia `UsuariosFincas`, desempeñando un rol distinto en cada una.

### 1.1 Roles Base del Sistema (Colección `Roles`)
1. **`superAdmin` (Administrador Global - SENA / Plataforma):**
   * **Alcance:** Global (sin atadura a una finca específica).
   * **Responsabilidad:** Crear y administrar fincas, asignar administradores globales, gestionar el catálogo maestro de roles y permisos dinámicos (RNF-17) y supervisar el estado general de la plataforma.
   * **Restricción:** No interviene en la operación agrícola diaria de las fincas productivas.
2. **`admin` (Administrador de Finca):**
   * **Alcance:** Limitado estrictamente a la finca seleccionada en su sesión (`fincaId` validado en `UsuariosFincas`).
   * **Responsabilidad:** Gestión integral de su finca: empleados, usuarios locales, roles operativos locales, configuración parametrizable de la finca, parcelas, inventarios, labores, ventas, compras, nómina y auditoría.
3. **`operario` / `agronomo` (Usuario Operativo - Perfil Extendido Configurable):**
   * **Alcance:** Limitado a la finca seleccionada en sesión.
   * **Responsabilidad:** Ejecución y registro de labores diarias de campo (siembras, riegos, fertilizaciones, control de plagas, análisis de suelo, cosechas y movimiento de tareas en Kanban), sin acceso a configuraciones críticas ni administración financiera/nómina.
4. **`usuario` (Consulta / Auditoría Básica):**
   * **Alcance:** Limitado a la finca seleccionada en sesión.
   * **Responsabilidad:** Acceso de solo lectura y exportación de reportes operativos permitidos, sin capacidad de crear, modificar o desactivar registros.

### 1.2 Actores Sin Rol de Acceso Directo
* **Empleados de Campo (`Empleados`):** Son registros operativos vinculados a una finca para asignar responsabilidades físicas en labores y liquidar nómina. **No poseen credenciales de inicio de sesión** a menos que el `admin` les cree una cuenta en `Usuarios` y los vincule en `UsuariosFincas`.

---

## 2. Convención de Acciones (RBAC)

Cada módulo evalúa 5 acciones estandarizadas en el middleware de autorización:
* **`C` (Crear):** `POST` — Registrar nuevos documentos.
* **`R` (Leer):** `GET` — Listar, buscar y consultar detalles.
* **`U` (Actualizar):** `PUT` / `PATCH` — Modificar datos existentes o cambiar estados.
* **`D` (Desactivar / Baja Lógica):** `DELETE` — Aplicar baja lógica (`activo: false`) o anulación controlada.
* **`E` (Exportar):** `GET /export` — Generar reportes en PDF y Excel al vuelo.

---

## 3. Matriz Granular de Permisos (`Módulo × Rol`)

| Etapa | Módulo (`modulo`) | `superAdmin` | `admin` (Por Finca) | `operario` / `agronomo` | `usuario` (Consulta) |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **1** | **Fincas (Global)** (`fincas`) | `C, R, U, D` | `R` *(solo asignadas)* | `R` *(solo asignadas)* | `R` *(solo asignadas)* |
| **1** | **Asignación Usuarios-Finca** (`usuarios-fincas`) | `C, R, U, D` | `C, R, U, D` *(su finca)* | — | — |
| **1** | **Roles y Permisos** (`roles`) | `C, R, U, D` | `R` | — | — |
| **1** | **Usuarios** (`usuarios`) | `C, R, U, D` | `C, R, U, D` *(su finca)* | `R, U` *(solo su perfil)* | `R, U` *(solo su perfil)* |
| **1** | **Auditoría** (`auditoria`) | `R` *(global)* | `R` *(su finca)* | — | — |
| **2** | **Empleados** (`empleados`) | — | `C, R, U, D` | `R` | `R` |
| **2** | **Parcelas** (`parcelas`) | — | `C, R, U, D` | `R` | `R` |
| **2** | **Proveedores** (`proveedores`) | — | `C, R, U, D, E` | `R` | `R` |
| **3** | **Insumos** (`insumos`) | — | `C, R, U, D, E` | `R` | `R` |
| **3** | **Semillas** (`semillas`) | — | `C, R, U, D, E` | `R` | `R` |
| **3** | **Maquinaria y Herramientas** (`maquinaria`) | — | `C, R, U, D, E` | `C, R, U` *(mant./desinf.)* | `R` |
| **3** | **Movimientos de Inventario** (`inventario`) | — | `R, E` | `R` | `R` |
| **4** | **Cultivos** (`cultivos`) | — | `C, R, U, D, E` | `C, R, U` | `R, E` |
| **4** | **Preparaciones de Terreno** (`preparaciones`) | — | `C, R, U, D` | `C, R, U` | `R` |
| **4** | **Siembras** (`siembras`) | — | `C, R, U` | `C, R, U` | `R` |
| **5** | **Riegos** (`riegos`) | — | `C, R, U, E` | `C, R, U, E` | `R, E` |
| **5** | **Fertilizaciones** (`fertilizaciones`) | — | `C, R, U, E` | `C, R, U, E` | `R, E` |
| **5** | **Control de Plagas** (`plagas`) | — | `C, R, U, E` | `C, R, U, E` | `R, E` |
| **5** | **Sustratos** (`sustratos`) | — | `C, R, U, E` | `C, R, U, E` | `R, E` |
| **5** | **Procesos de Cultivo** (`procesos`) | — | `C, R, U` | `C, R, U` | `R` |
| **5** | **Análisis de Suelo** (`analisis-suelo`) | — | `C, R, U, E` | `C, R, U, E` | `R, E` |
| **6** | **Producción (Lotes)** (`produccion`) | — | `C, R, U, E` | `C, R, U` | `R, E` |
| **6** | **Compradores** (`compradores`) | — | `C, R, U, D` | `R` | `R` |
| **6** | **Ventas y Devoluciones** (`ventas`) | — | `C, R, U, E` | `C, R` *(solo registrar)* | `R, E` |
| **7** | **Facturas de Compra y Recepción** (`facturas`) | — | `C, R, U, D` | `C, R` *(recepción física)* | `R` |
| **7** | **Nómina** (`nomina`) | — | `C, R, U, E` | — | — |
| **8** | **Estadísticas** (`estadisticas`) | `R` *(métricas globales)* | `R, E` *(su finca)* | `R` *(operativas)* | `R` |
| **8** | **Tablero Kanban de Tareas** (`tareas`) | — | `C, R, U, D` | `R, U` *(mover tareas)* | `R` |
| **8** | **Configuración por Finca** (`configuracion`) | — | `R, U` | `R` | `R` |

---

## 4. Reglas de Evaluación del Middleware (`rbac.middleware.js`)

1. **Verificación de Autenticación (HTTP `401`):** Si la petición no incluye un Access Token JWT válido en `Authorization: Bearer`, se rechaza antes de evaluar permisos.
2. **Validación de Contexto de Finca (HTTP `403`):** Para cualquier ruta operativa (diferente a la gestión global del `superAdmin`), el middleware verifica que el `fincaId` incluido en el token corresponda a una relación con `activo: true` en `UsuariosFincas`.
3. **Evaluación de Permiso (HTTP `403`):** Se busca el `rolId` vinculado a esa finca y se comprueba si el arreglo `permisos` contiene el `modulo` y la `accion` solicitada. Si no existe coincidencia, responde con:
   ```json
   {
     "ok": false,
     "error": {
       "code": "FORBIDDEN_ACTION",
       "message": "No tiene permisos suficientes para realizar esta acción en este módulo."
     }
   }
   ```
4. **Extensibilidad Dinámica (RNF-17):** Como los roles y sus arreglos de permisos viven en la colección `Roles` de MongoDB, el `superAdmin` puede crear nuevos perfiles (por ejemplo, `supervisor-bodega` o `contador`) asignando combinaciones de la tabla anterior sin modificar una sola línea de código en el backend.