ADR 01: Gestión del contexto de finca y aislamiento de datos multi-finca  

Estado: Aprobado
Decisión: Actualización de la decisión original.

1. Problema identificado

Los requerimientos RF 39, 40, 41, 53, 54, 77, 91 y 93 solicitan el uso de "id_finca" como parámetro manual en formularios y filtros.

Esto representa un riesgo de seguridad porque un usuario podría modificar ese identificador para intentar consultar o modificar información de una finca a la que no tiene acceso, contradiciendo el RNF 16, que exige aislamiento de datos entre fincas.

Además, la decisión original asumía que cada usuario pertenecía a una sola finca. Sin embargo, el sistema debe permitir que un mismo usuario tenga acceso a varias fincas y pueda desempeñar diferentes roles en cada una.

Por ejemplo:

- Juan puede ser administrador de la Finca A y administrador de la Finca B.
- María puede ser trabajadora de la Finca A y administradora de la Finca C.

Por lo tanto, no es adecuado almacenar un único "fincaId" directamente en el documento del usuario como referencia permanente.

2. Requerimientos afectados

- RF 39, RF 40, RF 41.
- RF 53, RF 54.
- RF 77, RF 91, RF 93.
- RNF 16: aislamiento de información entre fincas.
- RNF 20: seguridad y control de acceso.

3. Decisión adoptada

Se implementará un modelo de gestión multi-finca que permita que un usuario tenga acceso a una o varias fincas, con un rol específico para cada una.

Se establecerán las siguientes reglas:

1. El identificador de finca ("fincaId") no podrá ser enviado libremente por el cliente en formularios o filtros para determinar el acceso a los datos.
2. La relación entre usuarios y fincas se almacenará en una colección independiente denominada "UsuariosFincas".
3. Cada registro de "UsuariosFincas" relacionará un usuario con una finca y definirá el rol que tiene dentro de ella.
4. Al iniciar sesión, el sistema identificará las fincas a las que el usuario tiene acceso.
5. El usuario podrá seleccionar la finca en la que desea trabajar.
6. El backend validará que el usuario realmente tenga autorización para acceder a la finca seleccionada.
7. El contexto de finca seleccionado se utilizará para consultar, crear, modificar y eliminar información.
8. Un usuario podrá tener diferentes roles en diferentes fincas.
9. La creación de nuevas fincas y la administración global de sus asignaciones corresponderán al superadministrador.

4. Solución técnica propuesta

4.1. Colecciones de MongoDB

Se implementarán tres colecciones principales:

Usuarios

Almacenará la información de autenticación e identidad de cada persona.

Ejemplo:

"{ _id, nombre, email, password }"

Fincas

Almacenará la información de cada finca registrada en el sistema.

Ejemplo:

"{ _id, nombre, ubicacion, activo }"

UsuariosFincas

Funcionará como colección intermedia para relacionar usuarios con fincas y definir sus roles.

Ejemplo:

"{ _id, usuarioId, fincaId, rolId, activo }"

Se establecerá un índice único compuesto por "usuarioId" y "fincaId" para evitar que un mismo usuario tenga asignaciones duplicadas dentro de una misma finca.

4.2. Autenticación y selección de finca

Cuando un usuario inicie sesión:

1. El backend verificará sus credenciales.
2. Consultará la colección "UsuariosFincas" para obtener las fincas a las que tiene acceso.
3. El sistema mostrará las fincas disponibles para ese usuario.
4. El usuario seleccionará la finca en la que desea trabajar.
5. El backend verificará nuevamente que exista una asignación activa para ese usuario y esa finca.
6. Una vez validada la relación, se establecerá el contexto de trabajo con el identificador de usuario, el identificador de finca y el rol correspondiente.

4.3. Token de autenticación

El JWT incluirá el contexto autorizado de trabajo:

"{ userId, fincaId, rolId }"

El "fincaId" representará la finca seleccionada y validada por el backend, no un valor aceptado sin verificación desde el cliente.

Cuando el usuario cambie de finca, el backend deberá validar la nueva asignación y actualizar el contexto de autenticación.

4.4. Middleware de seguridad

Se implementarán mecanismos de validación en Express para:

- Verificar que el usuario esté autenticado.
- Comprobar que tenga una asignación activa para la finca seleccionada.
- Obtener el rol correspondiente a esa relación.
- Garantizar que las consultas y operaciones de escritura estén limitadas a la finca autorizada.

4.5. Aislamiento de información

Todas las operaciones sobre los módulos de gestión agrícola deberán utilizar el "fincaId" del contexto validado por el backend.

Esto impedirá que un usuario pueda consultar, modificar o eliminar información perteneciente a otra finca simplemente cambiando un identificador enviado desde el frontend.

Si un usuario intenta acceder a una finca para la cual no tiene una asignación autorizada, el sistema responderá con un error HTTP 403 (Forbidden).

4.6. Administración de fincas y asignaciones

- El superadministrador podrá crear fincas y gestionar globalmente las asignaciones de usuarios.
- El administrador de una finca podrá gestionar los usuarios y trabajadores de su propia finca, de acuerdo con los permisos definidos.
- Un administrador de finca no podrá asignar usuarios a otras fincas sin autorización global.

5. Justificación

Esta decisión permite que AgroSmart funcione como un sistema multi-finca, sin limitar a los usuarios a pertenecer a una única finca.

También permite que una misma persona tenga diferentes responsabilidades dependiendo de la finca en la que esté trabajando.

La colección intermedia "UsuariosFincas" facilita la administración de estas relaciones y evita duplicar cuentas de usuario.

Finalmente, la validación del contexto de finca desde el backend fortalece la seguridad y garantiza el aislamiento de la información entre las diferentes fincas.

6. Resultado esperado

- Un usuario puede acceder a varias fincas con una sola cuenta.
- Un usuario puede tener un rol diferente en cada finca.
- Cada finca conserva sus propios datos y registros.
- Los usuarios únicamente pueden consultar y modificar información de las fincas a las que tienen acceso.
- El sistema puede incorporar nuevas fincas sin modificar la estructura principal de usuarios.



Decisión 02: Esquema Unificado de Autenticación, Manejo de Sesiones y Acceso sin Conexión 

* Problema:

Existen contradicciones en la gestión de sesiones y autenticación del sistema. El RF 2 establece el inicio de sesión con correo y contraseña mediante cookies; el RF 102 exige el uso de "nombreUsuario"; el RF 103 plantea almacenar tokens de manera ambigua en la base de datos cliente; mientras que el RNF 1 exige el uso de tokens JWT en el encabezado "Authorization: Bearer" y el RNF 3 solicita persistencia segura entre sesiones del navegador sin exposición de credenciales.

Adicionalmente, AgroSmart será utilizado en entornos agrícolas donde pueden presentarse interrupciones o ausencia temporal de conexión a internet. Por esta razón, es necesario contemplar un mecanismo que permita a los usuarios previamente registrados y autenticados ingresar al sistema sin depender permanentemente de la conectividad.

El sistema también debe considerar que un mismo usuario puede tener acceso a varias fincas y desempeñar diferentes roles en cada una, de acuerdo con la Decisión 01.

* Requerimientos afectados:

RF 02, RF 102, RF 103, RNF 01, RNF 03.

* Decisión:

Se unificará el proceso de autenticación mediante un único identificador: el correo electrónico ("email") y una contraseña almacenada mediante un hash seguro generado con "bcrypt".

Se adoptará una arquitectura de doble token (Access Token y Refresh Token) para la autenticación y administración de sesiones cuando exista conexión a internet.

Adicionalmente, se propone implementar un mecanismo de autenticación sin conexión (Offline Authentication), que permita a los usuarios previamente autenticados en un dispositivo acceder al sistema utilizando información de autenticación almacenada localmente de forma protegida.

El acceso sin conexión utilizará la última información de autorización disponible en el dispositivo, incluyendo las fincas y los roles asociados al usuario. Esta autorización tendrá una vigencia limitada y deberá actualizarse cuando se recupere la conexión.

* Justificación:

La unificación del identificador de acceso evita inconsistencias entre los requerimientos y facilita la administración de las cuentas de usuario.

El uso de Access Token y Refresh Token permite controlar la duración de las credenciales, renovar sesiones y gestionar su revocación desde el servidor.

Por otra parte, depender exclusivamente de una conexión permanente impediría que los administradores y trabajadores puedan ingresar al sistema durante interrupciones de internet en la finca.

El mecanismo de autenticación sin conexión permitirá mantener el acceso para usuarios previamente autorizados, sin almacenar contraseñas en texto plano ni depender de una validación inmediata con el servidor.

Sin embargo, el dispositivo no podrá conocer en tiempo real si un usuario perdió sus permisos mientras permanecía desconectado. Por esta razón, se establecerán límites de vigencia para las autorizaciones locales y se realizará una nueva validación al recuperar la conectividad.

* Solución técnica propuesta:

1. Identificación y almacenamiento de contraseñas:
 
   - El inicio de sesión utilizará exclusivamente el correo electrónico ("email") y la contraseña.
   - Las contraseñas se almacenarán mediante hashes generados con "bcrypt"; nunca se guardarán en texto plano.
   - Se unificará el uso de "email" en los requerimientos relacionados con autenticación.

2. Access Token:
 
   - Se utilizará un JWT de corta vigencia, inicialmente propuesta de 15 minutos.
   - Se transportará mediante el encabezado "Authorization: Bearer <token>".
   - Contendrá la información necesaria para identificar al usuario y su contexto de trabajo autorizado, incluyendo la finca seleccionada y el rol correspondiente, de acuerdo con la Decisión 01.

3. Refresh Token:
 
   - Se generará mediante un mecanismo criptográficamente seguro.
   - Se almacenará una representación protegida del token en una colección "Sesiones" de MongoDB, evitando guardar el token original en texto plano.
   - Se enviará al cliente mediante una cookie con los atributos "httpOnly: true", "secure: true" y "sameSite: 'Strict'", sujeto a la compatibilidad con el entorno de despliegue.
   - La colección "Sesiones" contará con un índice TTL para permitir la expiración automática de los registros.
   - Se implementará un mecanismo de renovación controlada de credenciales.

4. Cierre de sesión y revocación:
 
   - El endpoint de "logout" eliminará o revocará el registro de la sesión en MongoDB.
   - Se limpiarán las credenciales locales del dispositivo cuando corresponda.
   - Se tendrá en cuenta que eliminar una sesión no invalida automáticamente un Access Token JWT que ya fue emitido. Si se requiere revocación inmediata, deberá implementarse un mecanismo adicional de validación.
   - Se protegerá el proceso de renovación de tokens frente a solicitudes no autorizadas.

5. Autenticación sin conexión (Offline Authentication):
 
   - El usuario deberá realizar una primera autenticación satisfactoria con conexión a internet.
   - El dispositivo conservará de manera protegida la información necesaria para reconocer al usuario en futuros accesos sin conexión.
   - No se almacenará la contraseña original en el dispositivo.
   - Se implementará un mecanismo de verificación local de credenciales, utilizando almacenamiento seguro y protección criptográfica.
   - El acceso sin conexión estará disponible únicamente para usuarios que hayan sido autenticados previamente en ese dispositivo.
   - Se establecerá un periodo máximo de funcionamiento sin conexión, después del cual será necesaria una nueva validación con el servidor.
   - Si el usuario tiene acceso a varias fincas, el dispositivo mostrará las fincas y los roles disponibles según la última sincronización realizada.
   - El usuario podrá seleccionar la finca en la que desea trabajar, respetando la última autorización conocida por el dispositivo.

6. Validación de permisos al recuperar la conexión:
 
   - Cuando se restablezca la conectividad, el sistema verificará nuevamente la sesión del usuario.
   - Se consultarán las asignaciones vigentes en "UsuariosFincas", incluyendo el usuario, la finca y el rol correspondiente.
   - Se actualizarán las autorizaciones locales según la información vigente del servidor.
   - Si una asignación fue eliminada, desactivada o modificada, el sistema deberá actualizar o restringir el acceso correspondiente.
   - Las operaciones que requieran autorización vigente deberán validarse contra el servidor.

7. Protección de la información local:
 
   - La información de autenticación y los datos almacenados localmente deberán contar con mecanismos de protección y cifrado.
   - No se permitirá almacenar contraseñas en texto plano ni utilizar "localStorage" como almacenamiento de credenciales sensibles.
   - Se evaluará el uso de mecanismos de almacenamiento local seguro, considerando la tecnología y el tipo de dispositivo utilizado.
   - Se deberá contemplar la protección de la información cuando el dispositivo sea compartido por diferentes usuarios.

8. Alcance del acceso sin conexión:
 
   - La autenticación sin conexión permitirá ingresar al sistema y acceder a las funcionalidades que estén disponibles localmente.
   - Esta decisión no implica que todos los módulos puedan registrar o modificar información sin internet.
   - La consulta, creación y modificación de registros sin conexión, así como su almacenamiento local y posterior sincronización, deberán definirse en una decisión de arquitectura complementaria.
   - La sincronización entre dispositivos y la resolución de conflictos se especificarán por separado.

* Resultado esperado:

- Unificar el inicio de sesión mediante correo electrónico y contraseña.
- Proteger las credenciales de los usuarios.
- Administrar las sesiones mediante Access Token y Refresh Token.
- Permitir que usuarios previamente autenticados puedan ingresar sin conexión a internet durante un periodo limitado.
- Permitir que el usuario seleccione una de sus fincas autorizadas y utilice el rol correspondiente según la última sincronización.
- Actualizar y validar los permisos cuando se recupere la conectividad.
- Mantener la seguridad de las sesiones y la información almacenada localmente.

* Estado: Aprobado.


DECISIÓN 03: Gestión de roles, permisos, usuarios y empleados

Estado: Propuesto para revisión y aprobación del equipo.

1. Problema

El sistema debe diferenciar entre las personas que administran la plataforma, las personas que administran cada finca y las personas que realizan actividades agrícolas.

Además, AgroSmart es desarrollado inicialmente por un equipo de estudiantes del SENA y posteriormente será entregado a la institución. Por esta razón, es necesario diferenciar los permisos de desarrollo y mantenimiento de los permisos administrativos que utilizará el SENA en el entorno de producción.

También se debe evitar que todos los empleados necesiten una cuenta para ingresar al sistema, ya que algunos solamente estarán registrados para la gestión de las actividades agrícolas.

2. Requerimientos relacionados

- RNF 2: definición de roles y permisos.
- RNF 17: posibilidad de incorporar nuevos roles sin modificar el código fuente.
- RF relacionados con la gestión de empleados y las actividades agrícolas.

3. Decisión propuesta

Se establecerá una separación entre usuarios, empleados, roles y permisos.

Se mantendrán tres roles base para la administración funcional de AgroSmart:

SuperAdmin

Será el responsable de la administración global de la plataforma en el entorno de producción.

Una vez entregado el software, el SENA designará a la persona responsable de recibir este rol.

Sus facultades incluirán:

- Registrar y gestionar fincas.
- Crear o asignar administradores de fincas.
- Gestionar los roles y permisos globales.
- Administrar configuraciones generales de la plataforma.
- Supervisar la gestión de las diferentes fincas registradas.

Admin

Será el responsable administrativo de una finca específica.

Sus facultades incluirán:

- Gestionar los empleados de su finca.
- Crear o gestionar cuentas de usuarios de su finca, según los permisos establecidos.
- Asignar roles operativos a los usuarios de su finca.
- Gestionar la información y las actividades agrícolas de su finca.
- Administrar únicamente los recursos a los que tenga autorización.

Un administrador no podrá gestionar otras fincas ni modificar configuraciones globales reservadas al SuperAdmin.

Usuario

Representará a las personas que utilizan AgroSmart para realizar actividades específicas dentro de una finca.

Sus permisos dependerán del rol asignado en esa finca. Podrán existir perfiles como trabajador, agrónomo o supervisor, entre otros.

4. Separación entre desarrollo y administración

El equipo desarrollador tendrá acceso a los entornos de desarrollo y pruebas para crear fincas de prueba, configurar usuarios, asignar roles, verificar permisos y solucionar errores.

Este acceso técnico no deberá confundirse con los roles funcionales de producción.

Una vez entregado el software:

- El SENA designará al responsable de la administración global.
- El equipo desarrollador no tendrá que administrar las operaciones agrícolas.
- Si se requiere mantenimiento posterior, el acceso técnico a producción deberá ser autorizado, limitado y registrado.
- No se crearán cuentas técnicas ocultas ni accesos permanentes sin autorización.

Se recomienda mantener separados los entornos de desarrollo, pruebas y producción.

5. Separación entre empleados y usuarios

La colección "Empleados" representará a las personas que trabajan en una finca, independientemente de si utilizan o no el sistema.

La colección "Usuarios" almacenará las cuentas que permiten iniciar sesión.

Un empleado solo necesitará una cuenta de usuario cuando requiera acceder a AgroSmart.

Cuando exista esa relación, podrá vincularse el registro del empleado con la cuenta correspondiente mediante un identificador de usuario.

El administrador de la finca podrá gestionar esa vinculación y asignar roles dentro de su finca, siempre que tenga los permisos correspondientes.

6. Solución técnica propuesta

- "Usuarios": almacenará las credenciales y datos de las cuentas.
- "Empleados": almacenará la información de las personas vinculadas laboralmente a una finca.
- "Roles": almacenará los nombres, descripciones y permisos de cada rol.
- "UsuariosFincas": relacionará usuarios con las fincas a las que tienen acceso, indicando el rol asignado en cada una y su estado de acceso.

La colección "UsuariosFincas" permitirá que un mismo usuario tenga roles diferentes en distintas fincas.

El middleware "checkPermission(modulo, accion)" verificará que el usuario tenga el permiso necesario para ejecutar cada operación.

La validación deberá considerar:

- La identidad del usuario.
- La finca seleccionada.
- La relación activa entre el usuario y la finca.
- El rol asignado en esa finca.
- Los permisos correspondientes.

Las operaciones no autorizadas deberán rechazarse mediante una respuesta HTTP 403.

7. Resultado esperado

Esta decisión permitirá:

- Separar las responsabilidades del equipo desarrollador y de los administradores de AgroSmart.
- Entregar al SENA el control administrativo de la plataforma sin entregar automáticamente la administración operativa de todas las fincas a una misma persona.
- Permitir que cada finca gestione sus propios usuarios y empleados.
- Incorporar nuevos perfiles y permisos según las necesidades del sistema.
- Mantener el aislamiento de información entre fincas.
- Facilitar el mantenimiento técnico sin conceder privilegios administrativos innecesarios.

Estado final: Aprobado.


DECISIÓN 04: Separación del Maestro de Compradores, Registro de Ventas y Gestión de Devoluciones

Estado: Propuesto para revisión y aprobación del equipo.

1. Problema

El RF 15 ("Creación de Compradores") mezcla datos de identificación de un tercero (cliente) con datos transaccionales comerciales propios de una venta (especie, cantidad, guía de transporte y valor monetario).

Adicionalmente, es necesario contemplar que una venta puede incluir diferentes productos agrícolas y que el comprador puede devolver una parte o la totalidad de los productos adquiridos.

El sistema debe garantizar que las cantidades vendidas se descuenten de los lotes de producción correspondientes y que las cantidades devueltas se registren correctamente, evitando inconsistencias en el inventario.

2. Requerimientos afectados

RF 15, RF 16, RF 17, RF 18, RF 69 y RNF 23.

Se deberá verificar si existen otros requerimientos relacionados con inventarios, producción, ventas, devoluciones y movimientos de existencias.

3. Decisión propuesta

Se separará la información comercial en tres componentes:

- "Compradores": maestro de clientes que almacena sus datos de identificación.
- "Ventas": registra las operaciones comerciales realizadas.
- "Devoluciones": registra las devoluciones parciales o totales asociadas a ventas previamente registradas.

Esta separación permitirá mantener el historial comercial y controlar los movimientos de inventario.

4. Justificación

La separación evita repetir los datos de un mismo comprador en cada venta.

Además, una venta puede contener diferentes productos agrícolas y cada producto debe relacionarse con el lote de producción del cual se obtiene.

La gestión independiente de devoluciones permite conservar el historial de las operaciones y controlar las cantidades que regresan al inventario, sin alterar o eliminar la venta original.

5. Solución técnica propuesta

5.1. Colección "Compradores"

Almacenará la información de identificación de los compradores.

Estructura propuesta:

"{ fincaId, nombre, documento, telefono, email, direccion, activo }"

Un comprador podrá tener múltiples ventas dentro de la finca correspondiente.

5.2. Colección "Ventas"

Almacenará cada operación comercial.

Estructura conceptual:

"{ fincaId, compradorId, fecha, detalles, total, guiaTransporte, estado }"

El campo "detalles" contendrá los productos incluidos en la venta. Cada elemento deberá identificar:

- "productoId": producto agrícola vendido.
- "produccionId": lote de producción del que procede.
- "cantidad": cantidad vendida.
- "precioUnitario": precio por unidad.
- "subtotal": resultado de multiplicar cantidad por precio unitario.

El total de la venta será calculado y validado por el servidor, utilizando "Decimal128" para los valores monetarios.

Una misma venta podrá incluir diferentes productos y lotes de producción.

5.3. Colección "Devoluciones"

Almacenará las devoluciones relacionadas con una venta existente.

Estructura conceptual:

"{ fincaId, ventaId, fecha, motivo, detalles, estado }"

Cada elemento de "detalles" deberá identificar:

- "productoId": producto devuelto.
- "produccionId": lote de producción al que corresponde.
- "cantidadDevuelta": cantidad recibida como devolución.
- "estadoProducto": condición del producto después de la revisión.
- "cantidadReintegrada": cantidad que vuelve al inventario disponible.

Se permitirán devoluciones parciales o totales.

5.4. Reglas de negocio para las devoluciones

1. Una devolución deberá estar asociada a una venta existente.
2. La cantidad devuelta no podrá superar la cantidad vendida, descontando las devoluciones previamente registradas.
3. El sistema deberá identificar el producto y el lote de producción de origen.
4. Los productos devueltos deberán ser revisados para determinar su condición.
5. Los productos aptos para comercialización podrán reincorporarse al inventario disponible.
6. Los productos dañados o no aptos deberán quedar registrados, pero no podrán sumarse al inventario disponible para la venta.
7. La venta original no deberá eliminarse ni perder su historial por realizar una devolución.
8. Si se requiere reembolsar dinero, deberá registrarse el movimiento económico correspondiente, independientemente del movimiento físico del inventario.

5.5. Control de inventario y transacciones

Al registrar una venta, el servidor deberá:

- Verificar que el producto y el lote pertenezcan a la finca autorizada.
- Comprobar que exista suficiente cantidad disponible.
- Calcular el total de la venta.
- Registrar la venta.
- Descontar las cantidades correspondientes de los lotes de producción.

Al registrar una devolución, el servidor deberá:

- Verificar que la venta exista y pertenezca a la finca autorizada.
- Comprobar que las cantidades devueltas no superen las cantidades vendidas pendientes de devolución.
- Registrar la devolución.
- Reintegrar al inventario disponible únicamente las cantidades aceptadas como aptas para comercialización.
- Registrar por separado las cantidades devueltas que no puedan reincorporarse al inventario disponible.

Las operaciones de venta y devolución deberán ejecutarse mediante transacciones de MongoDB ("session.withTransaction()"), para garantizar que el registro comercial y los movimientos de inventario se confirmen conjuntamente o se reviertan si ocurre un error.

El entorno de MongoDB deberá contar con una configuración compatible con transacciones.

6. Resultado esperado

- Evitar la duplicación de datos de compradores.
- Permitir que un comprador realice múltiples compras.
- Permitir ventas con diferentes productos y lotes de producción.
- Descontar correctamente las cantidades vendidas del inventario correspondiente.
- Registrar devoluciones parciales y totales.
- Reintegrar al inventario disponible únicamente los productos devueltos que sean aptos.
- Conservar el historial de ventas y devoluciones.
- Mantener la consistencia del inventario y el aislamiento de información entre fincas.

Estado final: Aprobado.


DECISIÓN 05: Integridad Referencial y Baja Lógica en Parcelas y Recursos

Estado: Propuesto para revisión y aprobación de los ajustes por parte del equipo.

1. Problema

El RF 55 propone eliminar físicamente parcelas mediante operaciones DELETE, aunque estas pueden estar relacionadas con otros módulos del sistema, como "Cultivos", "AnalisisSuelo" y "PreparacionTerreno".

La eliminación física podría provocar pérdida de información histórica, referencias inválidas e inconsistencias en los reportes.

Adicionalmente, es necesario establecer un mecanismo para desactivar usuarios, empleados e insumos sin eliminar sus registros ni perder la trazabilidad de las operaciones realizadas anteriormente.

2. Requerimientos afectados

RF 04, RF 23, RF 53, RF 55 y RNF 22.

Se deberán revisar otros requerimientos relacionados con la gestión de usuarios, empleados, insumos, inventarios y consultas históricas.

3. Decisión propuesta

Se implementará la baja lógica mediante el campo "activo: false" para las entidades que requieran desactivación, evitando la eliminación física de registros que tengan importancia histórica o relaciones con otros módulos.

La baja lógica permitirá conservar la información y excluir los registros inactivos de las operaciones habituales.

La desactivación de una entidad deberá cumplir las validaciones correspondientes según su naturaleza y las relaciones que mantenga con otros módulos.

4. Justificación

MongoDB permite almacenar referencias entre documentos, pero no garantiza automáticamente la integridad referencial como lo hacen las restricciones de claves foráneas de algunos sistemas relacionales.

Por esta razón, la aplicación deberá validar las relaciones antes de desactivar registros y conservar los documentos necesarios para mantener la trazabilidad.

Esta decisión evita la pérdida de información histórica y permite consultar operaciones anteriores, incluso cuando las entidades relacionadas ya no se encuentren activas.

5. Solución técnica propuesta

5.1. Baja lógica de parcelas

En la colección "Parcelas" se utilizará el campo "activo" para determinar si una parcela está disponible para nuevas operaciones.

Al solicitar la desactivación de una parcela, el servicio "parcelas.service.js" deberá consultar la colección "Cultivos".

Si existen cultivos asociados con estados considerados en curso, como "activo" o "en rotación", la API rechazará la operación y responderá con HTTP 409 Conflict.

Si no existen cultivos en curso, se permitirá la desactivación mediante la actualización:

"{ activo: false }"

La desactivación no eliminará los registros históricos de "Cultivos", "AnalisisSuelo" ni "PreparacionTerreno".

Los módulos que creen nuevas operaciones deberán verificar que la parcela se encuentre activa y pertenezca a la finca autorizada.

5.2. Baja lógica de usuarios

La gestión de usuarios deberá respetar el modelo multi-finca definido en la Decisión 01.

Se distinguirán dos situaciones:

- Desactivación del acceso a una finca: se actualizará el estado de la relación correspondiente en "UsuariosFincas", sin afectar el acceso del usuario a otras fincas.
- Desactivación de la cuenta completa: se realizará únicamente cuando se requiera impedir que el usuario acceda a AgroSmart en general.

La desactivación de una cuenta deberá impedir nuevos accesos y considerar la revocación de sus sesiones activas.

Los registros históricos de las operaciones realizadas por el usuario deberán conservarse.

5.3. Baja lógica de empleados

En la colección "Empleados" se utilizará el campo "activo".

Cuando una persona deje de trabajar en una finca, su registro podrá desactivarse.

La desactivación no eliminará las actividades, registros ni operaciones históricas asociadas al empleado.

Los registros inactivos no deberán aparecer en los listados habituales de empleados disponibles.

5.4. Baja lógica de insumos

En la colección correspondiente a los insumos se utilizará el campo "activo".

Cuando un insumo deje de utilizarse, podrá desactivarse para impedir que sea seleccionado en nuevas operaciones.

Antes de permitir su desactivación, el sistema deberá verificar si existen cantidades disponibles o movimientos pendientes que requieran atención.

La desactivación no eliminará los movimientos históricos ni modificará las operaciones anteriores.

5.5. Consultas y conservación histórica

Los listados habituales deberán filtrar los registros activos mediante:

"{ activo: true }"

Las consultas históricas y administrativas podrán incluir registros inactivos cuando el usuario tenga los permisos correspondientes.

Las referencias históricas deberán seguir siendo consultables, aunque la entidad relacionada se encuentre desactivada.

5.6. Reactivación

Se permitirá reactivar registros previamente desactivados mediante la actualización:

"{ activo: true }"

La reactivación deberá estar restringida a usuarios autorizados y cumplir nuevamente las validaciones correspondientes.

En el caso de las parcelas, deberá comprobarse que su estado permita volver a utilizarla en nuevas operaciones.

6. Reglas generales

1. No se permitirá la eliminación física de registros que deban conservarse por razones de trazabilidad.
2. Los registros inactivos no podrán utilizarse en nuevas operaciones que requieran entidades activas.
3. Las operaciones históricas deberán conservar sus referencias y datos originales.
4. La desactivación de un usuario en una finca no deberá eliminar automáticamente sus accesos a otras fincas.
5. Cada operación de desactivación y reactivación deberá estar protegida mediante los permisos correspondientes.
6. Los cambios de estado deberán registrarse para facilitar la auditoría.

7. Resultado esperado

- Evitar la pérdida de información histórica.
- Mantener la integridad de las relaciones entre módulos.
- Evitar que se utilicen parcelas, usuarios, empleados o insumos desactivados en nuevas operaciones.
- Permitir la consulta de información histórica.
- Mantener la independencia de los accesos de usuarios en diferentes fincas.
- Facilitar la administración y reactivación de registros cuando corresponda.

Estado final: Aprobado.


DECISIÓN 06: Control de Movimientos de Inventario en Insumos y Semillas.

Estado: Propuesto para revisión y aprobación de los ajustes por parte del equipo.

1. Problema

El SRS registra cantidades al crear insumos (RF 39) y semillas (RF 91), y contempla su utilización en fertilizaciones (RF 33) y siembras (RF 97). Sin embargo, no se especifica claramente si estas operaciones deben descontar existencias ni cómo deben registrarse las entradas de inventario derivadas de las compras (RF 105).

Además, es necesario diferenciar el registro de una factura, el pago de una compra y la recepción física de los productos, ya que no necesariamente ocurren al mismo tiempo.

El RNF 23 exige el uso de transacciones para garantizar la integridad de las operaciones que modifican el inventario.

2. Requerimientos afectados

RF 33, RF 39, RF 91, RF 97, RF 105 y RNF 23.

También se deberán revisar los requerimientos relacionados con devoluciones, ajustes y consultas de inventario, si existen.

3. Decisión propuesta

Las cantidades registradas en insumos y semillas representarán las existencias reales disponibles en cada finca.

El inventario se actualizará automáticamente mediante movimientos de entrada y salida:

- Entradas: recepción de compras, devoluciones aceptadas y otros ingresos autorizados.
- Salidas: utilización de insumos en fertilizaciones y semillas en siembras, devoluciones a proveedores y otros egresos autorizados.

Cada movimiento deberá quedar registrado para conservar la trazabilidad de los cambios en las existencias.

No se permitirá consumir cantidades superiores al stock disponible.

4. Justificación

Un sistema de gestión agrícola debe reflejar las existencias reales de los productos almacenados en cada finca.

El control automático de entradas y salidas permite evitar consumos superiores a las cantidades disponibles, facilita la consulta de movimientos históricos y mejora la planificación de las labores agrícolas.

La utilización de transacciones permite mantener la consistencia entre las operaciones agrícolas y las modificaciones del inventario.

5. Solución técnica propuesta

5.1. Control de existencias

Las existencias de insumos y semillas deberán estar asociadas a la finca correspondiente.

Cada registro deberá permitir identificar el producto, su unidad de medida y la cantidad disponible.

Las operaciones deberán validar que el producto pertenezca a la finca autorizada y que se encuentre activo.

5.2. Salidas de inventario

Cuando se registre una fertilización (RF 33) o una siembra (RF 97), el sistema deberá descontar automáticamente las cantidades utilizadas de los insumos o semillas correspondientes.

Antes de realizar el descuento, el servidor deberá comprobar que:

"stockActual >= cantidadRequerida"

Si las existencias son insuficientes, la operación deberá rechazarse y devolver un error HTTP 422 Unprocessable Entity, informando que no hay suficiente inventario disponible.

La actualización deberá realizarse de manera atómica para evitar que dos operaciones concurrentes consuman las mismas existencias.

Se utilizará una actualización condicional junto con "$inc" para descontar las cantidades.

5.3. Entradas de inventario y compras

Las compras registradas mediante el RF 105 deberán diferenciar:

- Registro de la factura o compra.
- Registro del pago.
- Recepción física de los productos.

El inventario aumentará cuando se confirme la recepción física de los productos en la finca, no únicamente cuando se registre o pague una factura.

Si la entrega es parcial, solo se ingresará la cantidad efectivamente recibida y aceptada.

Cada recepción deberá generar un movimiento de entrada asociado a la compra correspondiente.

5.4. Colección "MovimientosInventario"

Se propone registrar los cambios de existencias en una colección que permita conservar el historial de entradas y salidas.

Estructura conceptual:

"{ fincaId, productoId, tipoMovimiento, cantidad, fecha, motivo, referenciaId, usuarioId }"

Donde:

- "fincaId": identifica la finca propietaria del inventario.
- "productoId": identifica el insumo o semilla.
- "tipoMovimiento": entrada o salida.
- "cantidad": unidades que ingresan o salen.
- "fecha": momento en que se registra el movimiento.
- "motivo": causa del movimiento.
- "referenciaId": identifica la compra, labor agrícola, devolución u operación relacionada.
- "usuarioId": identifica al usuario responsable.

El historial de movimientos no deberá eliminarse al modificar las existencias actuales.

5.5. Transacciones y consistencia

Las operaciones que modifiquen el inventario deberán ejecutarse mediante transacciones de MongoDB ("session.withTransaction()").

Para las salidas por fertilización y siembra, la transacción deberá:

1. Validar el inventario disponible.
2. Descontar la cantidad requerida.
3. Registrar el movimiento de salida.
4. Registrar la operación agrícola correspondiente.

Para las entradas por recepción de compras, deberá:

1. Validar la recepción y las cantidades aceptadas.
2. Incrementar las existencias.
3. Registrar el movimiento de entrada.
4. Actualizar el estado de recepción de la compra.

Si alguna operación falla, los cambios de la transacción deberán revertirse.

El entorno de MongoDB deberá contar con una configuración compatible con transacciones.

5.6. Devoluciones y ajustes

Las devoluciones de productos y los ajustes de inventario deberán generar movimientos registrados.

Cuando un producto sea devuelto por una labor o por otro motivo, solo se reincorporará al inventario disponible si se verifica que se encuentra en condiciones adecuadas.

Las devoluciones a proveedores y las correcciones de existencias deberán registrarse como movimientos de salida o ajustes, según corresponda.

6. Resultado esperado

- Mantener las existencias actualizadas por finca.
- Descontar automáticamente los insumos utilizados en fertilizaciones.
- Descontar automáticamente las semillas utilizadas en siembras.
- Registrar las entradas cuando los productos sean recibidos físicamente.
- Evitar consumos superiores a las cantidades disponibles.
- Conservar el historial de movimientos de inventario.
- Mantener la consistencia entre compras, recepciones y labores agrícolas.
- Evitar inconsistencias cuando varios usuarios realicen operaciones simultáneamente.

Estado final: Aprobado.


Decisión 07: Redefinición de Reglas de Validación Inviables en Fertilizaciones

Problema:

El RF 38 establece una longitud de entre 3 y 10 caracteres para todos los campos del módulo de fertilizaciones. Esta regla resulta incompatible con la naturaleza de los datos que deben registrarse, como fechas, identificadores de MongoDB, cantidades numéricas y nombres descriptivos de insumos, impidiendo el almacenamiento de información real.

Requerimientos afectados: RF 33, RF 34, RF 35 y RF 38.

Decisión:

Eliminar la regla genérica de longitud de 3 a 10 caracteres y sustituirla por un esquema de validación tipificado mediante Zod, aplicando restricciones específicas según el tipo de dato y las reglas de negocio correspondientes.

Justificación:

Los campos de una fertilización representan información de diferentes tipos y, por tanto, requieren validaciones independientes. Aplicar una única restricción de longitud puede impedir el registro de datos válidos y no garantiza la integridad de la información.

Solución técnica:

1. Implementar "fertilizacion.schema.js" utilizando Zod para validar los datos recibidos por el backend.

2. Definir las siguientes validaciones:
 
   - "cultivoId": cadena hexadecimal de exactamente 24 caracteres, compatible con el formato ObjectId de MongoDB.
   - "insumoId": cadena hexadecimal de exactamente 24 caracteres, compatible con el formato ObjectId de MongoDB.
   - "encargadoId": identificador del empleado responsable de ejecutar la fertilización. Debe ser una cadena hexadecimal de exactamente 24 caracteres, compatible con el formato ObjectId de MongoDB.
   - "registradoPorId": identificador del usuario autenticado que registra la información en AgroSmart. Debe obtenerse del contexto de autenticación del backend y no confiarse al valor enviado por el cliente.
   - "fecha": fecha válida en el formato ISO 8601 definido por el sistema. No debe permitir fechas futuras cuando se trate del registro de actividades ya ejecutadas.
   - "dosis": valor numérico finito estrictamente mayor que cero.
   - "unidad": valor perteneciente a un conjunto de unidades de medida previamente definido y acorde con las necesidades agronómicas del sistema.

3. Complementar las validaciones de formato con validaciones de negocio en el servicio correspondiente:
 
   - Comprobar que el cultivo, el insumo y el empleado encargado existan.
   - Verificar que el cultivo, el insumo y el empleado pertenezcan a la finca autorizada para la operación.
   - Comprobar que los registros relacionados se encuentren activos y puedan utilizarse en la fertilización.
   - Verificar que la unidad de medida corresponda con la unidad configurada para el insumo y con la operación registrada.
   - Obtener la identidad del usuario que registra la operación desde el contexto de autenticación del backend.

4. Mantener la separación entre las responsabilidades de los campos:
 
   - "encargadoId": identifica al empleado que ejecutó físicamente la fertilización.
   - "registradoPorId": identifica al usuario que registró la información en el sistema.

5. Definir las unidades de medida y aplicación de acuerdo con los requerimientos agronómicos. Diferenciar las unidades simples (kg, g, L, ml) de las unidades de aplicación (kg/ha, g/planta, L/ha), cuando corresponda.

Justificación técnica:

Zod permite validar la estructura, el tipo y el formato de los datos antes de procesarlos. Sin embargo, estas validaciones no reemplazan las consultas a MongoDB necesarias para comprobar la existencia, pertenencia y estado de los documentos relacionados.

La separación entre empleado y usuario permite conservar la trazabilidad de las actividades agrícolas, incluso cuando una persona realiza una labor y otra registra la información en el sistema.

Estado: Aprobado.


Decisión 08: Tratamiento del Requerimiento No Especificado de Gestión de Tareas (RNF 10)   corregir

Problema:

El RNF 10 exige la funcionalidad de «arrastrar y soltar tareas en menos de 100 ms». Sin embargo, ninguno de los requerimientos funcionales (RF 1 al RF 107) define un módulo de gestión de tareas, una entidad "Tareas" ni las operaciones necesarias para implementar un tablero Kanban.

Esta situación genera una inconsistencia entre el requisito de rendimiento solicitado y las funcionalidades definidas en el alcance del sistema.

Requerimiento afectado: RNF 10.

Decisión propuesta:

Solicitar al instructor la aclaración del alcance del RNF 10. Como alternativa inicial, se propone evaluar su adaptación a las interacciones de cambio de estado de cultivos y lotes de producción, siempre que dichas operaciones estén contempladas en los requerimientos funcionales existentes.

La implementación de un tablero general de tareas no se incluirá en el alcance inicial mientras no exista una definición funcional y una aprobación expresa.

Justificación:

Implementar un módulo de gestión de tareas sin requerimientos funcionales definidos implicaría diseñar nuevas entidades, reglas de negocio, permisos y operaciones que no están contempladas en el alcance inicial del proyecto.

Esto aumentaría la complejidad y el tiempo de desarrollo, pudiendo afectar el cumplimiento del cronograma establecido en la guía de arranque.

Solución técnica propuesta:

1. No implementar inicialmente una colección "Tareas" en MongoDB ni desarrollar un tablero Kanban general.

2. Revisar los requerimientos funcionales relacionados con los cultivos y lotes de producción para identificar si existen operaciones de cambio de estado que permitan adaptar el requisito de rendimiento a funcionalidades ya contempladas.

3. Si el instructor aprueba esta adaptación, definir y medir el rendimiento de la interacción en el frontend. Se deberá precisar si el límite de 100 ms corresponde a la respuesta visual de la interfaz o al tiempo total de procesamiento y persistencia del cambio.

4. Si el instructor solicita posteriormente un módulo de gestión de tareas, su alcance deberá definirse mediante nuevos requerimientos funcionales, incluyendo como mínimo la creación, asignación, estados, responsables y relación con las labores agrícolas. Su posible incorporación en la Etapa 8 quedará sujeta a aprobación y evaluación del cronograma.

Estado: Pendiente de confirmación con el instructor.


Decisión 09: Desglose de Módulos Comprimidos (Facturación, Nómina y Estadísticas)

Problema:

Los requerimientos RF 105 (Facturas), RF 106 (Nómina) y RF 107 (Estadísticas) agrupan múltiples funcionalidades en descripciones generales, sin especificar suficientemente las operaciones, reglas de negocio, fórmulas matemáticas, datos de entrada y resultados esperados.

Esta falta de detalle dificulta el diseño de endpoints, la estructuración de las colecciones de MongoDB y la elaboración de pruebas unitarias y de integración.

Requerimientos afectados: RF 105, RF 106 y RF 107.

Decisión propuesta:

Descomponer los tres requerimientos en funcionalidades atómicas, documentando las operaciones, reglas de negocio, cálculos y resultados esperados antes de implementar sus respectivos módulos.

Justificación:

Cada módulo requiere reglas específicas para garantizar la integridad de los datos y la consistencia de los resultados. Implementar operaciones financieras o estadísticas sin fórmulas y criterios definidos puede generar cálculos incorrectos y dificultades de mantenimiento.

Solución técnica propuesta:

1. Facturación (RF 105)

- Descomponer las funcionalidades de registro, consulta, actualización y gestión de estados de las facturas, según las operaciones permitidas por el negocio.
- Definir si el módulo contempla facturas de compra, facturas de venta o ambas.
- Realizar los cálculos monetarios en el backend, sin confiar en los totales enviados por el frontend.
- Definir la fórmula de cálculo considerando subtotal, descuentos, impuestos, retenciones y reglas de redondeo, cuando correspondan.
- Utilizar "Decimal128" para almacenar valores monetarios con precisión decimal.
- Mantener la relación entre facturas de compra y recepción física de insumos, de manera que el registro de una factura no incremente automáticamente el inventario.
- Evitar la eliminación física de documentos que tengan operaciones o movimientos relacionados, conservando la trazabilidad.

2. Nómina (RF 106)

- Descomponer las funcionalidades de registro de trabajadores, períodos de liquidación, novedades, bonificaciones, deducciones, liquidaciones y pagos, según el alcance aprobado.
- Definir las modalidades de remuneración y las reglas de cálculo aplicables.
- Realizar las liquidaciones en el backend, con reglas explícitas para cada concepto.
- Diferenciar el valor liquidado del pago efectivamente realizado.
- Registrar el historial de liquidaciones y pagos para mantener trazabilidad.
- Generar comprobantes PDF mediante "pdfkit", permitiendo su descarga sin depender del almacenamiento temporal del servidor.
- Si se requiere conservar los comprobantes, utilizar un mecanismo de almacenamiento persistente.
- Restringir el acceso a la información de nómina según los permisos correspondientes, por tratarse de información personal y financiera.

Como estructura básica de cálculo se podrá utilizar:

"Total a pagar = Monto base + Bonificaciones - Descuentos"

Esta fórmula deberá complementarse con las reglas laborales y de negocio que correspondan al alcance del módulo.

3. Estadísticas (RF 107)

Implementar endpoints de consulta respaldados por agregaciones de MongoDB, con filtros por finca, período y demás criterios definidos para cada indicador.

Indicadores propuestos:

- Rendimiento por cultivo: calcular la relación entre kilogramos cosechados y hectáreas utilizadas, definiendo previamente si el área corresponde a superficie sembrada o efectivamente cosechada.
- Balance financiero: definir si se calculará mediante movimientos de dinero efectivamente recibidos y pagados o mediante ingresos y gastos reconocidos en un período. No asumir que las facturas registradas representan pagos realizados.
- Consumo acumulado de insumos por ciclo fenológico: obtener las cantidades aplicadas a partir del historial de movimientos de inventario y registros de fertilización, siembra y demás operaciones que generen consumo. Relacionar los consumos con el cultivo y el ciclo correspondiente.

4. Consideraciones generales de implementación

- Todas las operaciones deben respetar el aislamiento de información por "fincaId", conforme a la Decisión 01.
- Los cálculos deben ejecutarse en el backend y contar con pruebas que verifiquen sus resultados.
- Los módulos deben conservar la trazabilidad de las operaciones y evitar modificaciones que alteren registros históricos.
- Las funcionalidades y fórmulas definitivas deben documentarse antes de desarrollar los endpoints correspondientes.

Estado: Propuesto para revisión y aprobación del equipo. Pendiente de definir el alcance de facturación, las reglas de liquidación de nómina y los criterios de cálculo de las estadísticas.


Decisión 10: Validación de Requisitos de Rendimiento y Capacidad ante las Limitaciones del Despliegue Gratuito

Problema:

Los RNF 6 y RNF 15 establecen metas de rendimiento y capacidad que deben demostrarse mediante pruebas técnicas:

- RNF 6: el 95 % de las operaciones CRUD debe ejecutarse en menos de 2 segundos.
- RNF 15: el sistema debe soportar 1.000.000 de registros por colección.

El entorno de despliegue gratuito disponible para el proyecto puede presentar limitaciones de recursos que afectan las mediciones de rendimiento y capacidad. Por tanto, los resultados obtenidos exclusivamente en dicho entorno podrían no representar las capacidades de la arquitectura bajo condiciones controladas.

Requerimientos afectados: RNF 6 y RNF 15.

Decisión propuesta:

Realizar pruebas locales controladas para verificar el cumplimiento técnico de los RNF 6 y RNF 15, utilizando datos de prueba representativos y documentando las condiciones en las que se ejecutan.

Los resultados de estas pruebas se considerarán evidencia de validación en el entorno local y no una garantía automática del rendimiento del sistema en producción.

Justificación:

Las limitaciones de recursos del plan gratuito pueden introducir factores externos que alteren los resultados de las pruebas. La validación local permite evaluar el comportamiento de la aplicación y de la base de datos bajo condiciones conocidas y reproducibles.

Sin embargo, el rendimiento y la capacidad también dependen de los recursos físicos o virtuales disponibles, la configuración de MongoDB, los índices, la concurrencia y las características del entorno de ejecución.

Solución técnica:

1. Validación del RNF 6: rendimiento

- Ejecutar pruebas de las operaciones de creación, consulta, actualización y eliminación.
- Utilizar datos representativos de las colecciones del sistema.
- Realizar múltiples ejecuciones y registrar los tiempos de respuesta.
- Calcular el percentil 95 (p95) para verificar que al menos el 95 % de las operaciones evaluadas se complete en menos de 2 segundos.
- Definir las condiciones de medición, incluyendo concurrencia, volumen de datos, recursos del equipo y alcance de la medición (backend o recorrido completo de la solicitud).
- Documentar los resultados y las condiciones de ejecución.

2. Validación del RNF 15: capacidad

- Generar datos de prueba con estructuras representativas de los documentos reales del sistema.
- Ejecutar pruebas de inserción y consulta con hasta 1.000.000 de documentos por colección evaluada.
- Verificar que los documentos puedan almacenarse y consultarse correctamente.
- Considerar los índices definidos para las operaciones habituales.
- Registrar el espacio utilizado, los recursos consumidos y los resultados obtenidos.
- Documentar las colecciones evaluadas y la cantidad de documentos utilizada en cada prueba.

3. Evidencias de validación

Conservar informes que incluyan:

- Herramientas utilizadas.
- Configuración del entorno de pruebas.
- Volumen y características de los datos.
- Cantidad de operaciones ejecutadas.
- Tiempos de respuesta y percentil 95.
- Cantidad de documentos por colección.
- Resultados y limitaciones identificadas.

4. Consideraciones sobre producción

Los resultados locales no deben presentarse como mediciones del entorno de producción. Si posteriormente se dispone de un entorno con recursos equivalentes al despliegue definitivo, deberán realizarse pruebas complementarias para verificar el comportamiento bajo esas condiciones.

Estado: Propuesto para revisión y aprobación del equipo y confirmación del instructor sobre el alcance de las evidencias exigidas.


Decisión 11: Construcción del Modelo de Datos ante la Ausencia de un Diagrama Entidad-Relación

Problema:

El documento de especificación de requisitos no presenta un modelo de datos explícito ni un diagrama entidad-relación que identifique las entidades, atributos, relaciones y restricciones del sistema.

Por esta razón, el equipo de desarrollo debe deducir la estructura de los datos a partir de la información de entrada, salida y operaciones descritas en los requerimientos funcionales, tomando como referencia la sección 1.3 del documento.

Esta ausencia puede generar interpretaciones diferentes sobre las entidades del sistema, duplicidad de información, relaciones incorrectas y dificultades para mantener la integridad de los datos.

Requerimientos afectados: Transversal a los RF 1 al RF 107 y a los RNF relacionados con integridad, persistencia, aislamiento y rendimiento.

Decisión propuesta:

Construir y documentar un modelo de datos conceptual y lógico a partir del análisis de los requerimientos funcionales, identificando las entidades, atributos, relaciones, cardinalidades y restricciones necesarias para implementar AgroSmart en MongoDB.

Justificación:

Antes de implementar las colecciones y sus operaciones, es necesario establecer una estructura de información coherente con las necesidades del sistema.

La ausencia de un modelo de datos documentado aumenta el riesgo de crear estructuras incompatibles entre módulos, duplicar información o establecer relaciones que no permitan mantener la trazabilidad de las operaciones agrícolas y administrativas.

Solución técnica propuesta:

1. Identificación de entidades:
 
   - Revisar los RF y extraer los elementos sobre los cuales el sistema necesita almacenar información.
   - Identificar las entidades principales y las entidades transaccionales.
   - Evitar crear entidades o colecciones únicamente porque se menciona un término en un requerimiento; primero debe comprobarse que tenga información y comportamiento propios.

2. Identificación de atributos:
 
   - Determinar qué datos pertenecen a cada entidad.
   - Definir tipos de datos, obligatoriedad, formatos y restricciones.
   - Identificar los campos que funcionan como identificadores y referencias a otros documentos.

3. Definición de relaciones:
 
   - Identificar cómo se relacionan las entidades.
   - Establecer cardinalidades, como uno a uno, uno a muchos y muchos a muchos.
   - Definir las reglas de integridad y pertenencia entre documentos relacionados.

4. Construcción del modelo conceptual:
 
   - Elaborar un diagrama que represente las entidades, atributos principales y relaciones.
   - Documentar las reglas de negocio que afectan las relaciones y restricciones.

5. Diseño lógico para MongoDB:
 
   - Definir las colecciones necesarias.
   - Determinar cuándo utilizar referencias mediante ObjectId y cuándo utilizar documentos embebidos.
   - Definir índices, restricciones de unicidad y mecanismos de validación.
   - Incorporar el aislamiento por "fincaId" conforme a la Decisión 01.
   - Garantizar la trazabilidad de las operaciones y la coherencia con las decisiones de arquitectura anteriores.

6. Documentación y trazabilidad:
 
   - Relacionar las entidades y atributos con los requerimientos funcionales que justifican su existencia.
   - Mantener un diccionario de datos con nombres, tipos, descripciones y restricciones.
   - Revisar el modelo frente a las decisiones de arquitectura para evitar contradicciones entre módulos.

Resultado esperado:

Un modelo conceptual documentado, un modelo lógico adaptado a MongoDB y un diccionario de datos que sirvan como referencia común para el desarrollo, las pruebas y el mantenimiento de AgroSmart.

Estado: Aprobado.


Decisión 12: Extracción y Centralización de Reglas de Negocio de los Requerimientos Funcionales

Problema:

Las columnas «Restricciones» y «Efecto Colateral» de los requerimientos funcionales no contienen información específica suficiente para su implementación.

En los 107 RF, la columna «Restricciones» repite el texto genérico de la plantilla («Limitaciones técnicas, Restricciones de negocio…»). Asimismo, en 105 RF, la columna «Efecto Colateral» presenta el mismo problema.

Las condiciones y reglas reales del negocio se encuentran descritas dentro de la columna «Proceso», lo que dificulta su identificación, consulta, trazabilidad y utilización durante el desarrollo y las pruebas.

Por otra parte, los requerimientos no funcionales sí contienen criterios de aceptación, por lo que no se identifica la misma deficiencia en ellos.

Requerimientos afectados: RF 1 al RF 107.

Decisión propuesta:

Extraer, identificar y centralizar las reglas de negocio expresadas en los procesos de los requerimientos funcionales en el documento "docs/reglas-de-negocio.md", tomando como punto de partida la primera lista de reglas incluida en la sección 3 del SRS.

La extracción deberá conservar la trazabilidad con los requerimientos originales y distinguir las reglas explícitas de aquellas que requieren aclaración o aprobación.

Justificación:

Las reglas de negocio establecen las condiciones, restricciones, validaciones y comportamientos que debe respetar el sistema. Mantenerlas dispersas dentro de las descripciones de los procesos dificulta su reutilización, implementación y verificación.

Centralizarlas permitirá que el equipo de desarrollo tenga una referencia común para implementar las validaciones del backend, definir las operaciones y elaborar casos de prueba, sin modificar arbitrariamente el significado de los requerimientos originales.

Solución técnica y documental:

1. Revisión de los requerimientos funcionales:
 
   - Revisar los 107 RF y analizar el contenido de la columna «Proceso».
   - Identificar condiciones, restricciones, autorizaciones, cálculos y consecuencias de las operaciones.
   - Diferenciar las reglas de negocio de las simples descripciones de funcionamiento.

2. Extracción de reglas:
 
   - Recuperar las reglas identificadas en la sección 3 del SRS.
   - Complementarlas con las reglas explícitas encontradas en los procesos de los RF.
   - Evitar duplicidades y conservar el significado original.
   - No incorporar como reglas aprobadas comportamientos que no estén sustentados por los requerimientos o por decisiones formalmente aprobadas.

3. Organización del documento:
 
   Crear "docs/reglas-de-negocio.md" con una estructura que incluya:
 
   - Identificador único de cada regla.
   - Descripción de la regla.
   - RF de origen.
   - Módulo relacionado.
   - Clasificación de la regla.
   - Estado de definición y aprobación.

4. Clasificación y tratamiento:
 
   - Identificar reglas explícitas y verificables.
   - Marcar reglas ambiguas o incompletas para consulta con el instructor o el equipo.
   - Identificar contradicciones entre requerimientos y decisiones de arquitectura.
   - Mantener diferenciadas las restricciones, validaciones y efectos adicionales de cada operación.

5. Trazabilidad:
 
   - Cada regla deberá relacionarse con el RF del que se obtuvo.
   - Las reglas modificadas mediante decisiones de arquitectura deberán conservar su referencia y estado de aprobación.
   - Los cambios posteriores deberán actualizar el documento centralizado.

6. Requerimientos no funcionales:
 
   - Mantener los criterios de aceptación existentes en los RNF.
   - No trasladarlos automáticamente al documento de reglas de negocio, ya que cumplen una función diferente.
   - Mantener su trazabilidad con las pruebas de aceptación correspondientes.

Resultado esperado:

Un documento centralizado de reglas de negocio que reúna las condiciones y restricciones identificadas en los requerimientos funcionales, permita rastrear su origen y sirva como referencia para el desarrollo, las validaciones y las pruebas de AgroSmart.

Estado: Aprobado.


Decisión 13: Insuficiencia de la clasificación de prioridad para establecer el orden de implementación

* Problema: La clasificación actual de prioridades no permite establecer un orden útil de desarrollo. De los 107 requerimientos funcionales, 99 están clasificados como «Alto»; los 25 requerimientos no funcionales también tienen esa clasificación. Por lo tanto, la prioridad no permite distinguir qué funcionalidades deben construirse primero.

* Requerimientos afectados: RF 1–107 y RNF 1–25.

* Decisión propuesta:
 
  Se conservará la prioridad como indicador de importancia del requerimiento, pero no se utilizará como único criterio para determinar el orden de implementación.
 
  Se establecerá una planificación basada en las dependencias entre módulos y requerimientos, identificando:
 
  1. Los módulos y funcionalidades que deben existir previamente para desarrollar otros.
  2. Las dependencias entre entidades, procesos y módulos.
  3. Las funcionalidades que pueden desarrollarse en paralelo.
  4. Las fases o etapas de implementación.
  5. La justificación del orden establecido.
 
  Se elaborará un mapa o grafo de dependencias que permita identificar la secuencia lógica de construcción del sistema.
 
  La planificación deberá considerar las decisiones de arquitectura aprobadas y las relaciones entre las entidades del modelo de datos. Las decisiones arquitectónicas que todavía estén propuestas no se tratarán como definitivas hasta su aprobación.

* Justificación: La prioridad indica la importancia de una funcionalidad, mientras que las dependencias determinan qué componentes necesitan estar implementados antes de que otros puedan construirse correctamente. Separar ambos criterios permite establecer una secuencia de desarrollo coherente, reducir retrabajos y evitar implementar módulos sobre estructuras que todavía no existen.

* Estado: Propuesto para revisión y aprobación del equipo.


Decisión 14: Completar operaciones de consulta y actualización en módulos incompletos y garantizar trazabilidad de registros críticos

* Problema: Se identificaron módulos cuyos requerimientos no contemplan todas las operaciones necesarias para gestionar sus registros. Análisis de suelo, compradores, control de plagas, sustratos y facturas de compra no especifican operaciones de actualización. Además, las facturas de compra no contemplan una operación de listado. Esta situación puede impedir corregir información, consultar registros existentes y mantener una gestión completa de los datos.

* Requerimientos afectados: Requerimientos funcionales correspondientes a los módulos de análisis de suelo, compradores, control de plagas, sustratos y facturas de compra. También se relaciona con el RNF 22.

* Decisión propuesta:
 
  Se revisarán los requerimientos de cada módulo para determinar e incorporar las operaciones de consulta, listado y actualización que sean necesarias según su naturaleza y las reglas del negocio.
 
  Se proponen los siguientes ajustes:
 
  1. Análisis de suelo: definir un mecanismo para corregir o actualizar registros, conservando la información anterior y la trazabilidad de los cambios.
  2. Compradores: permitir actualizar sus datos de identificación y contacto, sin modificar ni afectar las transacciones históricas asociadas.
  3. Control de plagas: permitir actualizar o corregir los registros de tratamientos y aplicaciones, conservando la trazabilidad de las modificaciones.
  4. Sustratos: incorporar la actualización de sus datos y establecer restricciones cuando estén relacionados con operaciones o registros históricos.
  5. Facturas de compra: incorporar el listado y consulta de facturas registradas, y definir el procedimiento de corrección, anulación o ajuste de documentos según su estado y las reglas del negocio.
 
  Trazabilidad de modificaciones (RNF 22):
 
  Las modificaciones de registros clasificados como críticos deberán conservar un historial de auditoría que permita identificar, como mínimo, el registro afectado, el usuario responsable, la fecha y hora del cambio y los valores anteriores y nuevos.
 
  El historial deberá conservarse sin que una modificación ordinaria permita eliminar o alterar la evidencia de cambios anteriores. También deberán definirse los permisos de consulta del historial.
 
  Antes de incorporar estas operaciones, se verificará cuáles registros se consideran críticos y qué restricciones de actualización corresponden a cada módulo.

* Justificación: Completar las operaciones de gestión permite que los módulos no se limiten al registro inicial de información. La incorporación de trazabilidad protege la integridad de los datos, facilita la auditoría y permite conocer cómo han evolucionado los registros críticos.

* Estado: Aprobado.


Decisión 15: Definición de criterios de validación para registros ICA e Invima

* Problema: Los requerimientos RF 39, RF 42 y RF 91 solicitan validar registros ICA e Invima, pero no especifican el formato, la estructura ni los criterios que debe utilizar el sistema para determinar si estos registros son válidos. Esta falta de información impide implementar una validación correcta y verificable.

* Requerimientos afectados: RF 39, RF 42 y RF 91.

* Decisión propuesta:
 
  Se solicitará al instructor la aclaración de los criterios de validación aplicables a los registros ICA e Invima antes de implementar esta funcionalidad.
 
  Se deberán definir los siguientes aspectos:
 
  1. El tipo de registro ICA o Invima que debe almacenarse en cada módulo.
  2. El formato y la estructura que debe cumplir cada registro.
  3. Si la validación será únicamente de formato o si también deberá comprobar la existencia y vigencia del registro mediante una fuente oficial.
  4. El comportamiento del sistema cuando el registro no cumpla los criterios establecidos.
  5. Si existen diferencias en las reglas de validación según el tipo de producto o registro.
 
  Una vez recibida la respuesta del instructor, se documentarán los criterios correspondientes en los requerimientos afectados y se implementarán las validaciones de acuerdo con las reglas confirmadas.
 
  No se establecerán expresiones regulares, longitudes ni formatos por suposición, ya que podrían ocasionar el rechazo de registros válidos o la aceptación de registros incorrectos.

* Justificación: Definir los criterios de validación antes de implementar evita establecer reglas arbitrarias y garantiza que el sistema responda a los requisitos reales del proyecto y a las condiciones aplicables a los registros ICA e Invima.

* Estado: Pendiente de aclaración con el instructor.


Decisión 16: Revisión de posibles duplicidades y homogeneización de nombres de funcionalidades

* Problema: Se identificaron nombres de funcionalidades repetidos en diferentes requerimientos funcionales del SRS:
 
  - «Exportación de Datos»: 3 apariciones.
  - «Búsqueda por Cultivo y Fecha»: 5 apariciones.
  - «Filtrado por Estado»: 2 apariciones.
  - «Filtrado por Fechas»: 2 apariciones.
  - «Registro Histórico»: 2 apariciones.
  - «Validación de Fechas»: 2 apariciones.
  - «Búsqueda por Nombre»: 2 apariciones.
 
  Estas coincidencias dificultan identificar las funcionalidades y determinar si existen requerimientos duplicados o si corresponden a operaciones independientes de diferentes módulos.

* Requerimientos afectados: RF que contienen las denominaciones repetidas identificadas en el SRS.

* Decisión propuesta:
 
  Se realizará una revisión individual de los requerimientos que comparten denominación, considerando su código, módulo, descripción, datos involucrados, condiciones y resultado esperado.
 
  La revisión permitirá clasificarlos en:
 
  1. Duplicidad real: cuando dos requerimientos describan la misma funcionalidad, dentro del mismo contexto y con el mismo comportamiento.
  2. Funcionalidades independientes: cuando compartan nombre, pero correspondan a módulos, datos o procesos diferentes.
  3. Duplicidad parcial: cuando exista una operación común, pero también diferencias que deban conservarse.
  4. Ambigüedad: cuando la descripción no permita determinar si se trata de la misma funcionalidad.
 
  Cuando se confirme una duplicidad real, se propondrá consolidar o corregir los requerimientos sin perder las condiciones y reglas que deban conservarse.
 
  Cuando sean funcionalidades independientes, se mantendrán separadas y se ajustarán sus denominaciones para identificar claramente el módulo y el propósito de cada una.
 
  Además, se propone utilizar una convención de identificación en los issues y commits del repositorio que incluya el código del requerimiento y el módulo correspondiente. Ejemplo: «RF 86 - Riegos».

* Justificación: La revisión permite evitar duplicación innecesaria de funcionalidades, conservar las operaciones que pertenecen a módulos diferentes y mejorar la trazabilidad entre el SRS, las tareas de desarrollo y los cambios realizados en el código.

* Estado: Aprobado.


ADR 17: Configuración por Finca y Gestión de Estados de los Procesos

Estado: Aprobado.

1. Problema

El RNF 21 establece que el sistema debe permitir configurar determinados aspectos de AgroSmart por finca. Sin embargo, algunos requerimientos funcionales definen estados específicos para los cultivos y la producción, sin aclarar si estos estados serán fijos o podrán personalizarse.

Esto genera una contradicción entre la configuración por finca y los estados establecidos directamente en los requerimientos.

2. Requerimientos afectados

- RNF 20.
- RNF 21.
- RF 25.
- RF 74.
- RNF 2 y RNF 17, en lo relacionado con permisos de administración.

3. Decisión propuesta

Cada finca contará con una configuración propia para los parámetros y estados de los procesos que sean definidos como personalizables.

Los estados iniciales se establecerán mediante valores predeterminados del sistema, respetando los estados expresamente indicados en los requerimientos funcionales.

La personalización de estados se desarrollará en la etapa de configuración del sistema, de acuerdo con la planificación de la guía.

4. Reglas propuestas

1. Cada configuración deberá estar asociada a una finca mediante "fincaId".
2. La configuración de una finca no podrá modificar los estados ni parámetros de otra finca.
3. Los valores iniciales deberán respetar los requerimientos funcionales.
4. La modificación de configuraciones deberá estar restringida a usuarios autorizados.
5. Los cambios de configuración deberán conservar la trazabilidad cuando afecten registros o procesos críticos.
6. No se permitirá eliminar o modificar un estado que esté siendo utilizado por registros existentes sin definir previamente cómo se conservará su integridad histórica.

5. Solución técnica propuesta

Se evaluará una colección "ConfiguracionesFinca" que permita almacenar los parámetros personalizables de cada finca.

Su estructura y los estados que podrán modificarse se definirán durante el diseño del modelo de datos.

El backend deberá validar que cada configuración pertenezca a la finca autorizada y que los estados utilizados por los registros sean válidos para esa configuración.

6. Justificación

Esta solución permite mantener la independencia de configuración entre fincas y cumplir el RNF 21 sin modificar directamente el código fuente cada vez que una finca requiera ajustar parámetros permitidos.

7. Pendientes de aclaración

Se deberá confirmar con el instructor:

- Qué estados pueden personalizarse.
- Si se permite agregar estados nuevos o solamente modificar los existentes.
- Qué estados deben mantenerse obligatoriamente por los RF.
- Qué parámetros adicionales pueden configurarse por finca.
- Qué rol puede modificar la configuración de cada finca.

Resultado esperado: Cada finca contará con una configuración independiente, con valores iniciales definidos por el sistema y personalización limitada a los parámetros autorizados.





