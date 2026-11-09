# Registro de Decisiones de Arquitectura y Negocio (ADR) - AgroSmart

Este documento formaliza las resoluciones acordadas por el equipo de desarrollo para solventar las inconsistencias, ambigüedades y vacíos identificados en el SRS (107 RF y 25 RNF), en cumplimiento de la Sección 1.2 y Sección 2 de la *Guía de Arranque*.

---

### Decisión 01: Modelo Multi-Finca y Extracción Segura de Tenant

* **Problema:** Los requerimientos RF 39, 40, 41, 53, 54, 77, 91 y 93 solicitan explícitamente el campo `id_finca` como parámetro de entrada en formularios o filtros de búsqueda. Esto contradice de forma directa el RNF 16 (Aislamiento Multi-Finca), permitiendo que un usuario malintencionado manipule el identificador para ver o modificar datos de otra finca. Además, ningún RF define cómo se crean las fincas en el sistema.
* **Requerimientos afectados:** RF 39, RF 40, RF 41, RF 53, RF 54, RF 77, RF 91, RF 93, RNF 16, RNF 20.
* **Decisión:** El `id_finca` queda estrictamente prohibido como parámetro manual de entrada (`req.body` o `req.query`). La entidad finca se asocia y extrae exclusivamente de la sesión autenticada del usuario. La creación de fincas será responsabilidad exclusiva del rol `superAdmin`.
* **Justificación:** Garantizar un aislamiento de datos hermético entre organizaciones agrícolas sin depender de la honestidad del cliente ni exponer llaves de partición en la API.
* **Solución técnica:**
  1. Se implementa la colección `Fincas` gestionada únicamente mediante rutas administrativas protegidas para `superAdmin`.
  2. En el inicio de sesión, el backend incluye el `fincaId` en el payload firmado del JWT.
  3. Se crea un middleware base en Express que inyecta automáticamente `{ fincaId: req.user.fincaId }` en todas las consultas y escrituras de Mongoose de la capa de servicios.
* **Estado:** Aprobado.

---

### Decisión 02: Esquema Unificado de Autenticación y Manejo de Sesiones

* **Problema:** Existen contradicciones críticas en la gestión de sesiones: el RF 2 establece inicio de sesión con correo y contraseña usando cookies; el RF 102 exige `nombreUsuario`; el RF 103 plantea guardar tokens de forma ambigua en la base de datos cliente; mientras que el RNF 1 exige tokens JWT en el encabezado `Authorization: Bearer` y el RNF 3 solicita persistencia segura entre sesiones del navegador sin exposición.
* **Requerimientos afectados:** RF 02, RF 102, RF 103, RNF 01, RNF 03.
* **Decisión:** Se homologa el inicio de sesión a un único identificador: correo electrónico (`email`) y contraseña cifrada con `bcrypt`. Se adopta una arquitectura de doble token (*Access Token* + *Refresh Token*) con respaldo de revocación en base de datos.
* **Justificación:** Los tokens JWT puros no permiten cierre de sesión real en el servidor. Almacenar tokens de acceso en cookies o localStorage sin control expone el sistema a ataques XSS o CSRF. El identificador por email evita colisiones y facilita la recuperación de contraseñas.
* **Solución técnica:**
  1. *Access Token:* JWT de corta vigencia (15 minutos) transportado en el encabezado `Authorization: Bearer <token>`.
  2. *Refresh Token:* Criptográficamente seguro, almacenado en una colección `Sesiones` en MongoDB (con índice TTL para auto-expiración) y despachado al cliente mediante cookie con atributos `httpOnly: true`, `secure: true`, `sameSite: 'Strict'`.
  3. El endpoint de *logout* elimina el registro en la colección `Sesiones`, revocando la renovación de credenciales.
* **Estado:** Aprobado.

---

### Decisión 03: Modelo de Roles, Permisos y Entidad Empleado

* **Problema:** El RNF 2 define tres roles cerrados (`superAdmin`, `admin`, `usuario`), pero el RNF 17 exige añadir roles sin modificar el código. Además, los RF 8, 19, 29, 33, 58 y 97 asignan labores a "Empleados" (responsables o encargados), pero el SRS no aclara si un empleado es un usuario con cuenta de acceso o simplemente una referencia operativa de campo.
* **Requerimientos afectados:** RF 01, RF 03, RF 08, RF 19, RF 29, RF 33, RF 58, RF 97, RNF 02, RNF 17.
* **Decisión:** Se desacopla la entidad `Empleados` de la entidad `Usuarios`. Los empleados son registros de personas operativas de la finca; si un empleado requiere usar el sistema, se le crea un usuario vinculado. Los roles y su matriz de permisos se almacenan como datos dinámicos en base de datos gestionados por el `superAdmin`.
* **Justificación:** La mayoría de trabajadores del campo realizan labores manuales (riegos, aplicaciones) y no requieren credenciales de acceso al software. Guardar los roles en base de datos cumple RNF 17 al permitir crear perfiles (ej. "Agrónomo", "Capataz") sin modificar middlewares.
* **Solución técnica:**
  1. Se crea la colección `Empleados` (`fincaId`, `nombres`, `apellidos`, `documento`, `telefono`, `activo`).
  2. Se crea la colección `Roles` con una matriz de permisos (`modulo`, `acciones: ['crear', 'leer', 'actualizar', 'eliminar']`).
  3. Un middleware `checkPermission(modulo, accion)` consulta en memoria/caché los permisos del `rolId` asociado al usuario en cada petición, retornando `403 Forbidden` si carece de autorización.
* **Estado:** Aprobado.

---

### Decisión 04: Separación de Maestro de Compradores y Registro de Ventas

* **Problema:** El RF 15 ("Creación de Compradores") mezcla datos de identificación de un tercero (cliente) con datos transaccionales comerciales propios de una venta (especie, cantidad, guía de transporte, valor monetario).
* **Requerimientos afectados:** RF 15, RF 16, RF 17, RF 18, RF 69, RNF 23.
* **Decisión:** Desacoplar el RF 15 en dos entidades y módulos separados: `Compradores` (maestro de clientes) y `Ventas` (transacción comercial vinculada a un lote de producción).
* **Justificación:** Normalizar el modelo de datos para evitar redundancias. Un comprador realiza múltiples compras a lo largo del tiempo; vincular la venta a la producción permite validar y descontar inventarios reales.
* **Solución técnica:**
  1. Colección `Compradores`: `{ fincaId, nombre, documento, telefono, email, direccion, activo }`.
  2. Colección `Ventas`: `{ fincaId, compradorId, produccionId, fecha, cantidad, precioUnitario, total, guiaTransporte }`.
  3. El total es calculado en el servidor usando `Decimal128` y se ejecuta una transacción de MongoDB (`session.withTransaction()`) para descontar la cantidad disponible en el lote de `Produccion`.
* **Estado:** Aprobado.

---

### Decisión 05: Integridad Referencial y Baja Lógica en Parcelas y Recursos

* **Problema:** El RF 55 propone eliminar físicamente parcelas (`DELETE`), a pesar de que los módulos de `Cultivos`, `AnalisisSuelo` y `PreparacionTerreno` dependen directamente de una parcela. Eliminar el registro provocaría inconsistencias de integridad referencial y pérdida de datos históricos.
* **Requerimientos afectados:** RF 04, RF 23, RF 53, RF 55, RNF 22.
* **Decisión:** Implementar baja lógica generalizada (`activo: false`) en parcelas, usuarios, empleados e insumos. Se prohíbe la desactivación de una parcela si tiene cultivos asociados en curso.
* **Justificación:** En MongoDB no existen llaves foráneas automáticas. El borrado físico rompe trazabilidad exigida por RNF 22 y genera errores en reportes de cosechas anteriores.
* **Solución técnica:**
  1. En el servicio `parcelas.service.js`, al solicitar eliminación, se consulta la colección `Cultivos`: si existen registros con `estado: { $in: ['activo', 'en rotación'] }`, la API aborta con código HTTP `409 Conflict`.
  2. Si no existen dependencias activas, se actualiza el campo `{ activo: false }`.
  3. Los listados regulares filtran por defecto `{ activo: true }`, a menos que se solicite auditoría histórica con rol administrativo.
* **Estado:** Aprobado.

---

### Decisión 06: Control de Movimientos de Inventario en Insumos y Semillas

* **Problema:** El SRS registra cantidades al crear insumos (RF 39) y semillas (RF 91), y los consume en fertilizaciones (RF 33) y siembras (RF 97), pero ningún RF especifica si las aplicaciones deben descontar stock ni si las facturas de compra (RF 105) deben incrementarlo. El RNF 23, por su parte, exige transacciones en estas labores.
* **Requerimientos afectados:** RF 33, RF 39, RF 91, RF 97, RF 105, RNF 23.
* **Decisión:** Las cantidades en insumos y semillas representarán inventario real. Las operaciones de siembra y fertilización descontarán existencias de forma obligatoria y las facturas pagadas incrementarán el inventario disponible.
* **Justificación:** Un software de gestión agronómica pierde valor técnico si no previene la sobreutilización de insumos sin disponibilidad física en bodega. Cumple además el mandato del RNF 23 sobre transacciones atómicas.
* **Solución técnica:**
  1. Toda aplicación de fertilizante o siembra ejecuta una transacción ACID (`session.startTransaction()`).
  2. Se valida que `stockActual >= cantidadRequerida`; de lo contrario, se arroja un error `422 Unprocessable Entity` ("Stock insuficiente de insumo/semilla").
  3. Se descuenta el valor con `$inc: { stock: -cantidad }`. Si la labor falla por cualquier motivo, se realiza `abortTransaction()`.
* **Estado:** Aprobado.

---

### Decisión 07: Redefinición de Reglas de Validación Inviables en Fertilizaciones

* **Problema:** El RF 38 exige textualmente una longitud de "entre 3 y 10 caracteres" para **todos** los campos del módulo de fertilizaciones, incluyendo la fecha, la dosis numérica y nombres descriptivos del producto, lo cual hace inviable la persistencia de datos reales.
* **Requerimientos afectados:** RF 33, RF 34, RF 35, RF 38.
* **Decisión:** Descartar la regla de 3 a 10 caracteres genérica y sustituirla por un esquema tipificado mediante validaciones de Zod adaptadas a cada tipo de dato agronómico.
* **Justificación:** Una fecha ISO 8601 requiere entre 10 y 24 caracteres, los ObjectIds de Mongo miden 24 caracteres hexadecimales y las dosis son valores numéricos decimales positivos mayores a cero.
* **Solución técnica:**
  1. Se implementa `fertilizacion.schema.js` con Zod:
     * `cultivoId`: string hexadecimal válido (24 caracteres).
     * `insumoId`: string hexadecimal válido (24 caracteres).
     * `encargadoId`: string hexadecimal válido (24 caracteres).
     * `fecha`: string con formato de fecha ISO 8601 no futura.
     * `dosis`: número positivo flotante mayor a cero ($> 0$).
     * `unidad`: enum estrictamente definido (`['kg', 'L', 'g', 'ml']`).
* **Estado:** Aprobado.

---

### Decisión 08: Tratamiento del Requerimiento no Especificado de Tareas (RNF 10)

* **Problema:** El RNF 10 exige "arrastrar y soltar tareas en menos de 100 ms", pero ningún requerimiento funcional (del 1 al 107) define un tablero Kanban ni la entidad "Tareas".
* **Requerimientos afectados:** RNF 10.
* **Decisión:** Reenfocar el RNF 10 hacia la transición de estados de los lotes de producción y cultivos en el frontend, postergando la creación de un tablero de tareas general hasta acordar su alcance con el instructor.
* **Justificación:** Crear un módulo completo de gestión de tareas desde cero incrementaría el alcance fuera del cronograma pactado en la guía de arranque.
* **Solución técnica:**
  1. El backend no generará colección de `Tareas` en la etapa inicial.
  2. Si el instructor solicita el módulo en revisiones posteriores, se modelará en la Etapa 8 vinculado a la agenda de labores de la finca.
* **Estado:** Pendiente de confirmación con instructor.

---

### Decisión 09: Desglose de Módulos Comprimidos (Facturas, Nómina y Estadísticas)

* **Problema:** Los requerimientos RF 105 (Facturas), RF 106 (Nómina) y RF 107 (Estadísticas) empaquetan múltiples subsistemas en una sola fila sin detalle de operaciones CRUD, listados, fórmulas matemáticas ni especificación de métricas.
* **Requerimientos afectados:** RF 105, RF 106, RF 107.
* **Decisión:** Descomponer cada requerimiento en funcionalidades atómicas y definir las fórmulas operativas en el backend.
* **Justificación:** No es posible implementar endpoints robustos ni pruebas unitarias sobre requerimientos agregados sin interfaces ni reglas matemáticas claras.
* **Solución técnica:**
  1. *Facturación (RF 105):* Endpoints CRUD con cálculo obligatorio en backend: $\text{Total} = \text{Subtotal} + \text{Impuestos}$. Almacenamiento con `Decimal128`.
  2. *Nómina (RF 106):* Submódulo con liquidación calculada por el servidor: $\text{Total a Pagar} = \text{Monto Base} + \text{Bonificaciones} - \text{Descuentos}$. Comprobantes generados al vuelo en PDF (`pdfkit`) sin almacenar en disco efímero de Render.
  3. *Estadísticas (RF 107):* Endpoints de solo lectura respaldados por agregaciones de MongoDB:
     * Rendimiento por cultivo ($\text{kg} / \text{ha}$).
     * Balance financiero de la finca ($\sum \text{Ventas} - \sum \text{Facturas Compras} - \sum \text{Nómina}$).
     * Consumo acumulado de insumos por ciclo fenológico.
* **Estado:** Aprobado.

---

### Decisión 10: Estrategia de Verificación de Metas de Rendimiento en Entorno Gratuito

* **Problema:** El RNF 6 exige que el 95% de las transacciones respondan en menos de 2 segundos, y el RNF 15 plantea soporte para 1.000.000 de registros por colección. Sin embargo, el entorno de pruebas gratuito (Render + MongoDB Atlas M0) entra en suspensión tras 15 minutos de