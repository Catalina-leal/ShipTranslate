# Contexto del proyecto de titulo: ShipTranslate

## Vision general

ShipTranslate es un sistema web para visualizar, interpretar, editar y generar mensajes EDI maritimos de forma mas amigable que la edicion directa del texto EDI. Tambien contempla la lectura de Bills of Lading en PDF con apoyo de inteligencia artificial para extraer datos logisticos y convertirlos a una estructura EDI.

## Problema

En comercio exterior, la informacion de BLs y mensajes EDI se trabaja con datos criticos: contenedores, puertos, buques, viajes, ETA/ETD, naviera, consignatario, shipper y referencias documentales. La edicion manual de EDI y el traspaso manual desde PDFs generan errores, reprocesos y retrasos. En el contexto aduanero, la trazabilidad completa del contenedor es relevante para evitar sanciones, retenciones, multas, perdida de confianza operacional y riesgos asociados a irregularidades.

## Objetivo

Desarrollar una plataforma que facilite la visualizacion clara e intuitiva de informacion EDI, permita editar campos relevantes de manera controlada e integre IA para leer informacion desde PDFs maritimos, reduciendo errores y tiempos de digitacion.

## Alcance declarado

- Gestion de mensajes EDI y PDFs maritimos.
- Visualizacion estructurada de mensajes EDI.
- Edicion controlada de campos seleccionados.
- Conversion de informacion extraida desde PDF a EDI.
- Soporte solo para navieras y segmentos definidos previamente.
- No contempla conversion a formatos distintos de EDI.

## Contexto funcional

El proyecto se orienta a operadores logisticos, analistas de comercio exterior, personal de navieras y usuarios que trabajan con mensajeria EDI maritima. El flujo central esperado es:

1. Cargar archivo EDI o PDF.
2. Extraer datos logisticos relevantes.
3. Presentar la informacion en una interfaz visual.
4. Detectar discrepancias, por ejemplo diferencias de buque o Lloyd entre BLs.
5. Permitir revision y edicion.
6. Generar o exportar un EDI consolidado.

## Metodologia

El documento del proyecto declara metodologia en cascada:

1. Requerimientos y analisis.
2. Diseno del sistema y del parser EDI.
3. Desarrollo del parser, visualizador, editor, parser PDF, validaciones, identificacion de naviera e IA.
4. Pruebas y ajustes.
5. Implementacion y documentacion.
6. Presentacion final.

## Arquitectura tecnica actual

La solucion esta implementada como aplicacion web cliente-servidor:

- Frontend: React + Vite.
- Backend: Node.js + Express.
- Base de datos: MongoDB con Mongoose.
- Navegacion: React Router.
- Comunicacion API: Axios.
- Carga de archivos: Multer.
- Lectura PDF: pdfjs-dist.
- IA: OpenAI API para extraer datos desde PDFs de BL.
- Autenticacion basica: login contra usuarios MongoDB, hash de contrasena con `crypto.scryptSync`, sesion local en `localStorage`.
- Control de acceso frontend por rol: `admin` y `user`.

## Backend

Rutas principales:

- `GET /api/shipments`
- `POST /api/shipments`
- `GET /api/shipments/:id`
- `PUT /api/shipments/:id`
- `DELETE /api/shipments/:id`
- `POST /api/shipments/parse`
- `POST /api/shipments/upload`
- `POST /api/shipments/parse-pdf`
- `POST /api/auth/login`
- `POST /api/auth/access-requests`
- `GET /api/auth/access-requests`
- `PUT /api/auth/access-requests/:id`

El parser EDI procesa segmentos como `UNB`, `UNH`, `BGM`, `RFF`, `DTM`, `LOC`, `NAD`, `GID`, `FTX`, `PIA`, `PCI`, `EQD`, `MEA`, `TDT`, `TSR`, `TOD`, `TCC`, `PRI`, `QTY`, `CUX`, `MOA`, `SGP`, `SEL`, `TMD`, `UNT` y `UNZ`.

Modelos y colecciones principales:

- `shipments`: historico de EDI procesados/generados. Guarda intercambio, mensajes EDI, contenido original, estado editado, multiples mensajes y `processedBy` con usuario que proceso el EDI.
- `trackings`: resultados de lectura de PDFs. Guarda nombre de archivo, tamano, datos extraidos, texto bruto y metadata de IA.
- `users`: usuarios de acceso con roles `admin` y `user`, estado de cuenta y hash/salt de contrasena.
- `accessrequests`: solicitudes administrativas de tipo `create-account` y `recover-access`, con estados `pending`, `approved`, `rejected` y `finalized`.

Autenticacion y solicitudes:

- `POST /api/auth/login` valida correo/contrasena contra `users` y devuelve usuario sin password.
- `POST /api/auth/access-requests` guarda solicitudes enviadas desde Crear cuenta o Recuperar acceso.
- `GET /api/auth/access-requests` lista solicitudes para la vista administrador.
- `PUT /api/auth/access-requests/:id` actualiza estado de solicitud.
- Crear cuenta puede aprobarse o rechazarse desde admin.
- Recuperar acceso puede marcarse como finalizado o rechazado desde admin.

Persistencia PDF/EDI:

- Al leer PDF en `/parse-pdf`, ademas de devolver los datos extraidos, se guarda un documento en `trackings`.
- Al generar un EDI desde PDF en `convert-edi`, se crea un archivo EDI en memoria, se sube por `/shipments/upload` y queda registrado en `shipments`.
- Al subir/generar EDI se envia `processedBy` desde la sesion frontend para que el historico admin muestre el usuario que lo proceso.
- Si se edita un EDI en `edi-preview` y se presiona Generar EDI, el shipment guardado se marca con `isEdited: true`.
- El parser EDI reconoce fechas `DTM+132` en formato `YYYYMMDD` y `YYYYMMDDHHMM`; para ETA visible usa el `DTM+132` asociado al `TDT` de mayor etapa.

## Guia tecnica EDI aprendida

Estructura general:

- `UNB ... UNZ`: inicio y cierre del intercambio EDI completo.
- `UNH ... UNT`: inicio y cierre de cada mensaje unitario dentro del intercambio.
- Un archivo puede contener multiples mensajes `UNH ... UNT`.
- `BGM`: inicio del mensaje, tipo de documento, numero y estado.
- `RFF+BM`: referencia principal del embarque; el valor posterior a `BM:` corresponde al numero de BL.
- `DTM`: fechas. `342` es emision del BL, `132` es llegada/ETA y `133` es salida/ETD.
- `LOC`: ubicaciones. Codigos relevantes: `7` entrega/destino, `88` carga, `76` origen, `170` destino final, `91` lugar de pago prepaid, `11` descarga, `9` embarque.
- `TOD`: terminos comerciales o de transporte. `TOD+5+PP` indica freight prepaid; `TOD+1+CIF` indica Incoterm CIF.
- `TSR`: requisitos de transporte.

Transporte:

- `TDT+20`: tramo principal en los ejemplos revisados, con viaje, carrier y buque.
- `TDT+30`: tramo secundario o transbordo, puede incluir Lloyd number y buque.
- Cuando existen multiples `TDT`, para la ETA visible del mensaje se debe usar el tramo de mayor etapa.
- Regla funcional clave para `edi-preview`: localizar dentro del mensaje unitario el `TDT` mayor, luego tomar el `LOC+11` asociado a ese tramo y su `DTM+132`; esa fecha debe mostrarse como ETA en formato `DD/MM/AAAA`.
- En el ejemplo aprendido, `TDT+30` contiene el transbordo/final, `LOC+11+CLSAI` indica puerto destino San Antonio y `DTM+132:202604300600:102` representa la ETA.

Cargos:

- `TCC`: bloque de cargo. Ejemplos: `OF` Ocean Freight, `DT` Documentation Fee, `VS` VGM/Surcharge, `DF` Destination Fee, `TH` Terminal Handling.
- Cada bloque de cargo puede incluir `LOC` lugar de pago, `CUX` moneda, `PRI` precio, `MOA` monto total y `QTY` cantidad/tipo de contenedor.

Partes:

- `NAD+CZ`: shipper/consignor.
- `NAD+CN`: consignee.
- `NAD+N1`: notify party.

Mercancia y contenedor:

- `GID`: detalle de carga, cantidad de bultos y tipo.
- `PIA`: codigo arancelario o HS.
- `FTX+AAA`: descripcion de mercancia.
- `MEA`: pesos y medidas. `KGM` para peso bruto; `MTQ` para volumen.
- `PCI`: marcas y numeracion.
- `SGP`: asignacion de mercancia a contenedor.
- `EQD`: detalle de contenedor, numero, tipo y estado.
- `TMD`: tipo de movimiento del contenedor.
- `SEL`: sellos del contenedor.

## Estructura Yang Ming aprendida desde `Analisis EDI YM.xlsx`

Fuente: archivo `C:\Users\catal\Desktop\Analisis EDI YM.xlsx`, hoja `KOTASANTOS`.

La muestra corresponde a un intercambio Yang Ming:

- `UNB+UNOA:2+YML+AGUNSA+260330:0719+4399`
- Emisor: `YML` (Yang Ming).
- Receptor: `AGUNSA`.
- Cierre: `UNZ+49+4399`.
- Contiene 49 mensajes unitarios `UNH ... UNT`.
- Tipo de mensaje: `IFTMCS:D:00B:UN`.
- Los BL principales aparecen como `RFF+BM:YMJAC...`.

Secuencia funcional observada por mensaje:

1. `UNH`: inicio del mensaje unitario.
2. `BGM+707+...+9`: documento/mensaje original.
3. `DTM+342:...:102`: fecha de documento BL.
4. `TSR+30+2`: requisitos/tipo de servicio.
5. Bloque de ubicaciones generales: `LOC+7`, `LOC+88`, `LOC+76`, `LOC+170`, `LOC+91`.
6. Terminos: `TOD+5+PP+YY` y, cuando aplica, `TOD+1+CIF`.
7. Referencia BL: `RFF+BM:<numero BL>`.
8. Bloques de cargos: `TCC`, `LOC`, `CUX`, `PRI`, `MOA`, `QTY`.
9. Bloques de transporte: uno o mas `TDT`, cada uno seguido por `LOC+11` + `DTM+132` y `LOC+9` + `DTM+133`.
10. Partes: `NAD+CZ`, `NAD+CN`, `NAD+N1`.
11. Mercancia: `GID`, `PIA`, `FTX`, `MEA`, `PCI`, `SGP`, `EQD`, `TMD`, `SEL`.
12. `UNT`: cierre del mensaje unitario.

Patrones de rutas detectados en los 49 mensajes:

- 19 mensajes tienen 1 tramo: `TDT+30`.
- 21 mensajes tienen 2 tramos: `TDT+20 > TDT+30`.
- 3 mensajes tienen 2 tramos: `TDT+30 > TDT+40`.
- 6 mensajes tienen 3 tramos: `TDT+20 > TDT+30 > TDT+40`.
- Por lo tanto, la etapa final visible no siempre es `TDT+30`; en 9 mensajes la etapa final es `TDT+40`.

Regla Yang Ming para ETA final:

- Dentro de cada mensaje `UNH ... UNT`, se deben agrupar los datos por tramo `TDT`.
- El tramo final es el `TDT` con mayor numero de etapa (`20`, `30`, `40`, etc.).
- La ETA final del mensaje es el `DTM+132` asociado al `LOC+11` de ese tramo final.
- La fecha viene como `YYYYMMDDHHMM` o `YYYYMMDD`; para la vista se debe mostrar como `DD/MM/AAAA`.
- Si el `DTM+132` viene vacio, por ejemplo `DTM+132::102`, debe tratarse como fecha no disponible y no como fecha valida.

Ejemplos de ETA final Yang Ming:

- BL `YMJAC232147021`: `TDT+30+019E+++YMLU+++9293765:::KOTA SANTOS`, `LOC+11+CLSAI`, `DTM+132:202604300600:102` => ETA `30/04/2026`.
- BL `YMJAC232147212`: `TDT+30+019E+++YMLU+++9293765:::KOTA SANTOS`, `LOC+11+CLSAI`, `DTM+132:202603121500:102` => ETA `12/03/2026`.
- En rutas con `TDT+40`, el valor de `TDT+40` debe prevalecer sobre `TDT+30`.

Observacion de parsing:

- Algunos textos largos de `NAD` o `FTX` pueden aparecer visualmente partidos en la planilla. Para el sistema, la fuente confiable debe seguir siendo el EDI delimitado por apostrofe (`'`) y no los saltos visuales de la hoja.

## Estructura ONE aprendida desde `Analisis EDI ONE.xlsx`

Fuente: archivo `C:\Users\catal\Desktop\Analisis EDI ONE.xlsx`.

Este archivo documenta EDI unitarios de ONE, pensados para casos donde se trabaja solo un BL. Por eso cada hoja es mucho mas pequena que el analisis Yang Ming y cada intercambio cierra con `UNZ+1+...`.

Hojas/casos aprendidos:

- `NORMAL`: carga general.
- `REEFER`: carga refrigerada.
- `REEFER NOR`: reefer non-operating o caso reefer especial, con dos contenedores en la muestra.
- `IMO`: carga peligrosa.
- `SOC`: shipper owned container / caso con mas tramos de transporte.

Cabecera y estructura base ONE:

- `UNB+UNOC:3+ONEY+AGUNSA+...`: intercambio EDI ONE hacia AGUNSA.
- `UNH+...+IFTMCS:D:00B:UN`: mensaje unitario.
- `BGM+707+ONEY...+5`: documento/BL.
- `DTM+342`: fecha del documento.
- `DTM+182`: fecha adicional de emision.
- `TSR+30+2`: servicio/condicion de transporte.
- Ubicaciones generales: `LOC+88`, `LOC+76`, `LOC+170`, `LOC+7`, `LOC+91`.
- `TOD+5+YY+PP` o `TOD+5+YY+CC`: condicion de pago/prepaid o collect.
- `RFF+BM:ONEY...`: BL principal.
- `RFF+CTC:...`: referencia adicional, booking o contrato.
- `CPI+4++P` o `CPI+4++C`: instrucciones/condiciones de pago.
- Bloques `TDT` con sus ubicaciones y fechas.
- Partes: `NAD+CN`, `NAD+CZ`, `NAD+N1`.
- Mercancia/contenedor: `GID`, `PIA`, `FTX+AAA`, `MEA`, `PCI`, `SGP`, `EQD`, `TMD`, `SEL`.
- Cierre unitario: `UNT+...` y `UNZ+1+...`.

Diferencias importantes frente a Yang Ming:

- ONE unitario no trae los bloques de cargos Yang Ming (`TCC`, `CUX`, `PRI`, `MOA`, `QTY`) en las muestras revisadas.
- Usa `CPI` para condiciones de pago.
- El BL viene en `RFF+BM` y tambien aparece embebido en `BGM` con prefijo `ONEY`.
- Los segmentos terminan con apostrofe directamente en la celda de la planilla.
- La estructura es de un solo mensaje por archivo/intercambio.

Regla ONE para ETA final:

- Igual que Yang Ming, se debe agrupar por tramo `TDT`.
- El tramo final es el `TDT` de mayor etapa (`20`, `30`, `40`, etc.).
- La ETA final se toma desde el `DTM+132` asociado al `LOC+11` del tramo final.
- En ONE, dentro de un mismo tramo tambien pueden aparecer `LOC+9` seguido de `DTM+132`; aunque la descripcion de la hoja lo llame salida o fecha de tramo, para la ETA visible final debe priorizarse el `DTM+132` que sigue al `LOC+11` del tramo mayor.
- La fecha viene normalmente como `YYYYMMDD` y debe mostrarse como `DD/MM/AAAA`.

Ejemplos ONE por caso:

- `NORMAL`: BL `ONEYDLCG01910700`, rutas `TDT+20 > TDT+30`, llegada final `LOC+11+CLSAI`, `DTM+132:20260423:102` => ETA `23/04/2026`.
- `REEFER`: BL `ONEYDL6CJ0948300`, rutas `TDT+20 > TDT+30`, llegada final `DTM+132:20260425:102`, incluye `TMP+1+-18:CEL` para temperatura.
- `REEFER NOR`: BL `ONEYDL5CB0563300`, dos contenedores `ONEU9455326` y `SZLU9551481`, pesos/volumen por contenedor.
- `IMO`: BL `ONEYNBOG32146900`, un tramo `TDT+20`, llegada final `DTM+132:20260423:102`, incluye `DGS+IMD+2.1+1950` y `FTX+AAC` para nombre tecnico/condicion peligrosa.
- `SOC`: BL `ONEYXMNG11402400`, rutas `TDT+20 > TDT+30 > TDT+40`, llegada final en `TDT+40`, `LOC+11+CLSAI`, `DTM+132:20260423:102`.

Segmentos especiales ONE que el modelo/parser deberia contemplar:

- `CPI`: instrucciones o condicion de pago.
- `TMP`: temperatura para cargas reefer.
- `DGS`: datos de mercancia peligrosa/IMO.
- `FTX+AAC`: nombre tecnico o condiciones especiales, especialmente en IMO.
- Multiples `SGP`, `EQD`, `TMD`, `MEA`, `SEL` para multiples contenedores dentro de un unico BL.

El modelo de datos guarda:

- Datos de intercambio EDI.
- Multiples mensajes EDI.
- Referencias BL/documento.
- Ubicaciones.
- Fechas.
- Transporte, buque, viaje, Lloyd, ETA/ETD y rutas.
- Parties: shipper, consignee, notify.
- Mercancia.
- Contenedores.
- Terminos, servicios, cargos y segmentos crudos.

## Frontend

Vistas principales:

- Inicio.
- Inicio administrador.
- Login.
- Crear cuenta.
- Recuperar acceso.
- Solicitudes administrador.
- Historico de envios.
- Nuevo EDI.
- Preview EDI.
- Detalle de shipment.
- PDF / Tracking.
- Conversion a EDI.

Funciones relevantes:

- Carga de archivos `.edi` y `.txt`.
- Parseo de EDI mediante backend.
- Guardado de EDI en MongoDB.
- Tabla de revision de mensajes EDI.
- Deteccion de discrepancias de buque entre mensajes.
- Cambio masivo de buque y Lloyd.
- Lectura de PDFs maritimos.
- Visualizacion de datos extraidos desde PDF.
- Generacion de archivo EDI descargable.
- Rutas protegidas: sin sesion solo se permite `/login`, `/register` y `/recover-access`.
- Rol `user`: menu con Inicio, Historico, Nuevo EDI, PDF y Cerrar sesion.
- Rol `admin`: menu con Inicio, Historico, Solicitudes y Cerrar sesion.
- Inicio admin: metricas de EDI, estado de solicitudes pendientes, acciones rapidas, solicitudes por revisar y actividad reciente.
- Historico para admin: columna Usuario y accion Eliminar solo para administrador.
- Vista `/admin/requests`: separa solicitudes en Crear cuenta y Recuperar acceso.
- Drag and drop habilitado en carga de EDI (`/shipments/new`) y PDF (`/tracking`).
- `convert-edi` muestra destino desde `locations.destination` cuando viene desde EDI parseado.

## Seguridad y roles

- Los usuarios no autenticados no pueden entrar a vistas operacionales; son redirigidos a `/login`.
- La sesion frontend se guarda en `localStorage` bajo la clave `shiptranslateSession`.
- El login real valida contra la coleccion `users` en MongoDB.
- Existen roles `admin` y `user`.
- El rol `admin` tiene vista de inicio distinta, acceso a solicitudes y permiso visual para eliminar EDI desde el historico.
- El rol `user` mantiene el flujo operacional de carga, lectura PDF, historico y generacion EDI.
- Las solicitudes de cuenta y recuperacion no activan cuentas automaticamente; quedan pendientes de revision administrativa.

## Estado actual de vistas administrativas

- `/`: muestra `AdminHomePage` cuando el rol de sesion es `admin`; muestra `Home` para usuarios normales.
- `/admin/requests`: vista exclusiva admin. Muestra dos areas:
  - Crear cuenta: permite Aprobar o Rechazar solicitudes pendientes.
  - Recuperar acceso: permite marcar como Finalizado o Rechazado.
- El inicio admin muestra el cuadro `Solicitudes` como:
  - `Revision` si hay solicitudes pendientes.
  - `Al dia` si no hay solicitudes pendientes, con estilo verde sutil.
- El bloque `Solicitudes por revisar` muestra cantidades pendientes por tipo: Crear cuenta y Recuperar acceso.
- Las acciones rapidas del inicio admin son: Revisar historico, Solicitudes y Cerrar sesion.

## Datos semilla y pruebas manuales

- Se crearon usuarios iniciales en la coleccion `users`:
  - Administrador: `admin@shiptranslate.cl`
  - Usuario: `usuario@shiptranslate.cl`
- Las contrasenas se guardan hasheadas con salt; no se almacenan en texto plano.
- Se insertaron solicitudes ficticias de crear cuenta y recuperar acceso en `accessrequests` para probar la vista `/admin/requests`.

## Puntos fuertes para defender en presentacion

- El proyecto nace de experiencia real en comercio exterior.
- Ataca una fuente concreta de errores operacionales: digitacion y edicion manual de EDI/PDF.
- Traduce informacion tecnica EDI a una interfaz entendible.
- Tiene trazabilidad documental y foco en cumplimiento aduanero.
- Usa tecnologias actuales y una arquitectura separada frontend/backend.
- Integra IA con un caso de uso acotado: extraer campos desde BLs PDF.

## Riesgos o brechas a vigilar

- El nombre aparece como ShipTranslate y en algunos lugares como ShipTraslate; conviene unificarlo.
- Hay textos con problemas de codificacion en consola/archivos visibles como `MarÃ­tima`.
- El generador EDI actual parece simplificado y debe validarse contra el estandar real esperado.
- El alcance dice soportar segmentos/navieras predefinidas; conviene documentar exactamente cuales.
- La IA depende de `OPENAI_API_KEY`; debe existir un comportamiento claro cuando no este configurada.
- Para defensa, conviene mostrar antes/despues: EDI crudo versus vista visual editable.
