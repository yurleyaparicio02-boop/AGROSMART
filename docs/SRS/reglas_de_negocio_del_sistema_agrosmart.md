# Catálogo Centralizado de Reglas de Negocio - AgroSmart

**Archivo:** `docs/reglas-de-negocio.md`  
**Versión:** 2.0 (Actualizada con ADRs aprobados)  
**Propósito:** Centralizar todas las reglas de negocio, validaciones de integridad, restricciones operativas y comportamientos ante fallos extraídos del SRS y de las decisiones de arquitectura, sirviendo como base directa para los servicios del backend y las pruebas automatizadas (Jest + Supertest).

---

## 1. Seguridad, Multi-Finca y Control de Acceso

### RN-001: Aislamiento Estricto Multi-Finca (Multi-Tenancy)
* **Módulo:** Seguridad y Multi-Finca
* **Origen:** RNF-16, ADR-01
* **Clasificación:** Seguridad / Integridad de Datos
* **Descripción:** Toda consulta, creación, actualización o desactivación de información operativa debe ejecutarse exclusivamente sobre la finca autorizada en el contexto de sesión del usuario autenticado (`fincaId` validado contra `UsuariosFincas`). Una finca jamás puede ver ni alterar datos de otra.
* **Acción si no se cumple:** Se bloquea la operación de inmediato y se registra el intento en bitácora.
* **Respuesta al cliente:** HTTP `403 Forbidden` — *"No tiene autorización para acceder o modificar información de la finca seleccionada."*

### RN-002: Prohibición de Manipulación Manual de `id_finca`
* **Módulo:** Todos los módulos operativos
* **Origen:** RF-039 a RF-041, RF-053, RF-054, RF-077, RF-091, RF-093, ADR-01
* **Clasificación:** Seguridad
* **Descripción:** El cliente tiene estrictamente prohibido enviar el identificador de finca (`id_finca` o `fincaId`) como campo libre en formularios (`req.body`) o parámetros de búsqueda (`req.query`). El servidor extrae la finca únicamente del token JWT validado en sesión.
* **Acción si no se cumple:** El esquema de validación rechaza el campo no permitido o el servidor ignora el parámetro externo prevaleciendo el contexto de sesión.
* **Respuesta al cliente:** HTTP `400 Bad Request` — *"Parámetro de finca no permitido en la solicitud."*

### RN-003: Unicidad de Asignación Usuario-Finca
* **Módulo:** Gestión Multi-Finca
* **Origen:** RF-109, ADR-01
* **Clasificación:** Integridad Referencial
* **Descripción:** Un mismo usuario puede pertenecer a múltiples fincas y tener roles distintos en cada una, pero no puede existir más de una asignación activa o duplicada para la misma combinación de `usuarioId` y `fincaId`.
* **Acción si no se cumple:** Se rechaza la creación del vínculo duplicado.
* **Respuesta al cliente:** HTTP `409 Conflict` — *"El usuario ya se encuentra asignado a esta finca."*

### RN-004: Autenticación Unificada y Vigencia de Tokens
* **Módulo:** Autenticación y Sesiones
* **Origen:** RF-002, RF-007, RF-103, RNF-01, RNF-03, Decisión 02
* **Clasificación:** Seguridad
* **Descripción:** El inicio de sesión se realiza únicamente mediante correo electrónico (`email`, máx. 50 caracteres) y contraseña cifrada. El Access Token expira en 15 minutos; el token de recuperación de contraseña es de un solo uso y vence estrictamente a las 2 horas de su emisión.
* **Acción si no se cumple:** Si el token está ausente, vencido o ya fue utilizado, se deniega el acceso.
* **Respuesta al cliente:** HTTP `401 Unauthorized` — *"Sesión inválida, expirada o credenciales incorrectas."*

### RN-005: Vigencia y Revalidación del Modo Sin Conexión (*Offline*)
* **Módulo:** Autenticación y Sesiones
* **Origen:** RF-114, RF-115, Decisión 02
* **Clasificación:** Seguridad / Continuidad Operativa
* **Descripción:** El acceso sin conexión solo está habilitado para usuarios previamente autenticados en el dispositivo mediante credenciales locales cifradas (nunca contraseña en texto plano) y dentro del periodo máximo permitido. Al recuperar internet, el sistema debe revalidar los permisos vigentes en `UsuariosFincas`.
* **Acción si no se cumple:** Si expira el plazo sin conexión o si sus permisos fueron revocados en el servidor, se bloquea el acceso o se restringen las acciones no autorizadas.
* **Respuesta al cliente:** Bloqueo local — *"Su sesión sin conexión ha expirado o sus permisos han cambiado. Conéctese a internet para validar su acceso."*

### RN-006: Separación de Empleados Operativos y Cuentas de Usuario
* **Módulo:** Usuarios y Empleados
* **Origen:** RF-001, RF-116, Decisión 03
* **Clasificación:** Regla de Negocio / Arquitectura
* **Descripción:** Los trabajadores de campo (`Empleados`) existen de forma independiente a las cuentas de acceso (`Usuarios`). Un empleado no requiere usuario para ser asignado como responsable físico de labores o liquidación de nómina, salvo que necesite ingresar al sistema.
* **Acción si no se cumple:** No aplica bloqueo; permite registrar empleados sin credenciales de login.
* **Respuesta al cliente:** HTTP `201 Created` — *"Empleado registrado correctamente en la finca."*

---

## 2. Integridad de Datos, Baja Lógica y Concurrencia

### RN-007: Política General de Baja Lógica
* **Módulo:** Usuarios, Empleados, Parcelas, Insumos, Proveedores
* **Origen:** RF-004, RF-055, RF-117, 
* **Clasificación:** Integridad Histórica
* **Descripción:** Queda prohibida la eliminación física (`DELETE` permanente) de registros que posean historial operativo o referencias en otros módulos. La desactivación se realiza mediante el estado `activo: false`, excluyéndolos de nuevas operaciones pero conservando su consulta histórica.
* **Acción si no se cumple:** Si se intenta utilizar una entidad inactiva (`activo: false`) en una nueva labor, compra o venta, la operación es rechazada.
* **Respuesta al cliente:** HTTP `422 Unprocessable Entity` — *"El registro seleccionado se encuentra inactivo y no puede utilizarse en nuevas operaciones."*

### RN-008: Protección de Parcelas con Cultivos Activos
* **Módulo:** Parcelas
* **Origen:** RF-055, 
* **Clasificación:** Integridad Referencial
* **Descripción:** Una parcela no puede ser desactivada lógicamente si tiene uno o más cultivos asociados en estado `activo` o `en rotación`.
* **Acción si no se cumple:** Se cancela la desactivación de la parcela.
* **Respuesta al cliente:** HTTP `409 Conflict` — *"No se puede desactivar la parcela porque tiene cultivos activos o en rotación."*

### RN-009: Existencia Previa de Referencias Asociadas
* **Módulo:** Todos los módulos relacionales
* **Origen:** RF-030, RF-048, Guía de Arranque Sec. 3
* **Clasificación:** Integridad Referencial
* **Descripción:** Antes de guardar cualquier registro que referencie a otra entidad (parcela, cultivo, semilla, insumo, empleado, proveedor, maquinaria o comprador), el servicio debe verificar en base de datos que dicho identificador exista, esté activo y pertenezca a la misma finca.
* **Acción si no se cumple:** Se aborta la escritura en base de datos.
* **Respuesta al cliente:** HTTP `404 Not Found` o `422 Unprocessable Entity` — *"La entidad referenciada no existe o no pertenece a esta finca."*

### RN-010: Auditoría Inmutable y Control de Concurrencia Optimista
* **Módulo:** Auditoría y Registros Críticos
* **Origen:** RF-121, RNF-22, Decisión 14
* **Clasificación:** Confiabilidad / Trazabilidad
* **Descripción:** Toda creación, actualización o desactivación sobre registros críticos (parcelas, cultivos, inventarios, facturas, nómina, configuraciones) genera un registro inmutable en `Auditoria` con usuario, fecha, valor anterior y valor nuevo. Si dos usuarios editan simultáneamente el mismo documento, prevalece la primera escritura mediante control de versión (`__v`).
* **Acción si no se cumple:** La segunda escritura concurrente es rechazada para evitar pérdida de datos.
* **Respuesta al cliente:** HTTP `409 Conflict` — *"El registro fue modificado por otro usuario mientras lo editaba. Recargue los datos e intente nuevamente."*

---

## 3. Inventarios, Compras y Comercialización

### RN-011: Control Estricto de Stock en Salidas de Inventario
* **Módulo:** Fertilizaciones, Siembras, Desinfecciones, Inventario
* **Origen:** RF-033, RF-048, RF-097, RF-113, RNF-23, Decisión 06
* **Clasificación:** Integridad Transaccional
* **Descripción:** No se permite registrar aplicaciones de insumos (fertilización o desinfección) ni siembras de semillas si la cantidad requerida supera el stock disponible actual (`stockActual >= cantidadRequerida`). El descuento y el registro de la labor deben ocurrir en una única transacción atómica.
* **Acción si no se cumple:** Se revierte toda la transacción sin alterar el inventario ni crear la labor.
* **Respuesta al cliente:** HTTP `422 Unprocessable Entity` — *"Inventario insuficiente para completar la operación. Stock disponible actual: [X]."*

### RN-012: Incremento de Inventario Condicionado a Recepción Física
* **Módulo:** Facturas de Compra e Inventario
* **Origen:** RF-105, RF-112, Decisión 06
* **Clasificación:** Regla de Negocio / Control de Bodega
* **Descripción:** El registro contable o el pago de una factura de compra no incrementa automáticamente el stock de insumos o semillas. Las existencias solo aumentan cuando se confirma la **recepción física** total o parcial de los productos aceptados en la finca.
* **Acción si no se cumple:** El inventario permanece intacto hasta registrar la recepción física.
* **Respuesta al cliente:** HTTP `200 OK` / `201 Created` — *"Factura registrada. El inventario se actualizará al confirmar la recepción física de la mercancía."*

### RN-013: Control de Saldo y Calidad en Devoluciones Comerciales
* **Módulo:** Ventas y Devoluciones
* **Origen:** RF-110, RF-111, Decisión 04
* **Clasificación:** Regla de Negocio / Inventario
* **Descripción:** Toda devolución debe asociarse a una venta existente. La cantidad devuelta no puede superar la cantidad originalmente vendida menos devoluciones previas. Tras inspección, solo los productos evaluados como **aptos** se reintegran al inventario disponible del lote de producción; los productos dañados se registran por separado sin sumarse al stock vendible.
* **Acción si no se cumple:** Si supera el saldo vendible, se rechaza; si está dañado, no incrementa existencias comerciales.
* **Respuesta al cliente:** HTTP `422 Unprocessable Entity` — *"La cantidad a devolver supera el saldo pendiente de la venta original."*

### RN-014: Cálculo Financiero Exclusivo en el Servidor
* **Módulo:** Ventas, Facturas de Compra, Nómina
* **Origen:** RF-105, RF-106, RF-110, Decisión 09
* **Clasificación:** Seguridad Financiera
* **Descripción:** Todos los cálculos monetarios (subtotales, impuestos, totales de venta, totales de factura y liquidación de nómina mediante la fórmula $\text{Total} = \text{Monto Base} + \text{Bonificaciones} - \text{Descuentos}$) se ejecutan exclusivamente en el backend utilizando precisión decimal exacta (`Decimal128`), ignorando cualquier total enviado desde el cliente.
* **Acción si no se cumple:** Se sobrescribe o rechaza cualquier discrepancia enviada en el cuerpo de la petición.
* **Respuesta al cliente:** Respuesta con los valores oficiales calculados y auditados por el servidor.

---

## 4. Validaciones Agronómicas, Cronológicas y Operativas

### RN-015: Vigencia de Semillas en Siembras
* **Módulo:** Semillas y Siembras
* **Origen:** RF-094, RF-097
* **Clasificación:** Validación Agronómica
* **Descripción:** Una semilla cuya fecha de vencimiento sea estrictamente anterior a la fecha actual del sistema no puede registrarse como vigente ni utilizarse en nuevas siembras. Se aceptan fechas iguales o posteriores a hoy.
* **Acción si no se cumple:** Se bloquea el registro o el uso del lote de semillas.
* **Respuesta al cliente:** HTTP `422 Unprocessable Entity` — *"El lote de semillas seleccionado se encuentra vencido y no puede utilizarse."*

### RN-016: Coherencia Cronológica en Siembras y Riegos
* **Módulo:** Siembras y Riegos
* **Origen:** RF-088, RF-100
* **Clasificación:** Validación Temporal
* **Descripción:** 
  1. En **Siembras**, la fecha estimada o real de cosecha no puede ser anterior a la fecha de siembra (`fechaCosecha >= fechaSiembra`).
  2. En **Riegos**, la fecha de ejecución no puede ser futura (`fecha <= hoy`) y la hora de inicio debe ser estrictamente anterior a la hora de finalización (`horaInicio < horaFin`).
* **Acción si no se cumple:** Se rechaza el registro por inconsistencia cronológica.
* **Respuesta al cliente:** HTTP `400 Bad Request` — *"Error de validación temporal: verifique que las fechas y horas sigan un orden lógico válido."*

### RN-017: Validación Estricta de Cantidades y Formatos de Contacto
* **Módulo:** Usuarios, Proveedores, Siembras, Fertilizaciones
* **Origen:** RF-001, RF-038, RF-080, RF-081, RF-101, Decisión 07
* **Clasificación:** Validación de Entrada
* **Descripción:** 
  1. Las cantidades de semillas, dosis de fertilizantes y volúmenes de riego deben ser números positivos estrictamente mayores a cero ($> 0$), validados tanto en cliente como en servidor.
  2. Los correos electrónicos deben cumplir formato válido y no exceder 50 caracteres; los teléfonos deben contener exactamente 10 dígitos numéricos (prefijo `+57` por defecto).
* **Acción si no se cumple:** El esquema de validación (Zod) detiene la petición antes de llegar al controlador.
* **Respuesta al cliente:** HTTP `400 Bad Request` — Mensaje específico indicando el campo inválido y el formato esperado.

### RN-018: Gestión de Estados de Cultivo y Bloqueo al Finalizar
* **Módulo:** Cultivos y Configuración por Finca
* **Origen:** RF-025, RF-120, ADR-17
* **Clasificación:** Regla de Negocio / Flujo de Estado
* **Descripción:** Un cultivo debe operar dentro de los estados válidos (`activo`, `en rotación`, `finalizado`, más los estados adicionales parametrizados para la finca). Una vez que un cultivo pasa a estado `finalizado`, queda cerrado históricamente y no admite nuevas labores (riegos, fertilizaciones, plagas o siembras).
* **Acción si no se cumple:** Se rechazan estados inventados o intentos de registrar labores sobre cultivos finalizados.
* **Respuesta al cliente:** HTTP `409 Conflict` — *"No se pueden registrar nuevas labores sobre un cultivo que ya se encuentra finalizado."*

### RN-019: Separación entre Planificación Kanban y Ejecución Real
* **Módulo:** Tablero Kanban de Tareas
* **Origen:** RF-118, RF-119, Decisión 08
* **Clasificación:** Regla de Negocio / Flujo Operativo
* **Descripción:** El movimiento de una tarea hacia la columna `Finalizada` en el tablero Kanban actualiza únicamente el estado de planificación operativa; bajo ninguna circunstancia registra automáticamente una labor agronómica ni descuenta existencias del inventario.
* **Acción si no se cumple:** El sistema mantiene aislada la actualización visual de la tarea respecto a los módulos transaccionales.
* **Respuesta al cliente:** HTTP `200 OK` — *"Estado de la tarea actualizado. Si la actividad consumió insumos o recursos, regístrela en su módulo operativo correspondiente."*

---

## 5. Resumen Rápido para Pruebas Automatizadas (Jest / Supertest)

| Regla | Prueba Negativa Obligatoria (Intentar romper la regla) | Código Esperado |
| :--- | :--- | :---: |
| **RN-001** | Usuario de Finca A consulta por ID una parcela de Finca B | `403` / `404` |
| **RN-002** | Enviar `id_finca` de otra finca en el cuerpo `POST /api/v1/parcelas` | `400` / Ignorado |
| **RN-004** | Consumir endpoint protegido sin token o con token expirado | `401` |
| **RN-008** | Intentar desactivar (`DELETE`) una parcela con un cultivo `activo` | `409` |
| **RN-010** | Enviar dos actualizaciones simultáneas sobre el mismo cultivo con versión `__v` antigua | `409` |
| **RN-011** | Registrar fertilización solicitando `50 kg` cuando el stock actual es `10 kg` | `422` |
| **RN-013** | Registrar devolución por `20 kg` de una venta original de `15 kg` | `422` |
| **RN-014** | Enviar una factura con `subtotal: 1000`, `impuestos: 190` y `total: 500` alterado | Recalcula `1190` |
| **RN-015** | Registrar siembra con un lote de semillas vencido ayer | `422` |
| **RN-016** | Registrar riego con fecha de mañana o con `horaInicio: "14:00"` y `horaFin: "10:00"` | `400` |