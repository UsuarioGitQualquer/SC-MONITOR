SC MONITOR - VERSIÓN 5.0
========================================================================

       Panel local de audiencia, chat, propinas, metas y moderación

                             para Stripchat
========================================================================

SC Monitor es una extensión para navegadores Chromium que supervisa en
tiempo real la actividad de las salas de Stripchat. Los datos se procesan y
se guardan localmente en el navegador. La versión 5.0 mejora la estabilidad
de los datos durante transmisiones largas y amplía el análisis con mapas de
calor, eficiencia de audiencia, interacción por liga y una cronología
combinada de metas y shows.


------------------------------------------------------------------------
📌 NOVEDADES Y FUNCIONES DE LA VERSIÓN 5.0
------------------------------------------------------------------------

COMPARACIONES POR DÍA DE LA SEMANA Y TRANSPARENCIA DE LAS MÉTRICAS

   - Los informes por período comparan el promedio de tokens, el promedio de
     espectadores y el pico de espectadores por día de la semana, contando
     solo los días con historial guardado.

   - El promedio de audiencia indica cuántas muestras se recopilaron durante
     el monitoreo; las categorías de público pueden superponerse.

   - Los valores de los shows son estimaciones basadas en el estado del
     reproductor y las tarifas configuradas; no confirman pagos.

   - La lista de usuarios sospechosos considera la visita actual observada en
     la lista de usuarios y descuenta los mensajes y tokens anteriores a esa
     visita. Al terminar el monitoreo de una sala offline, se finalizan las
     visitas abiertas.

   - El menú y la ruleta se leen a partir de los eventos y mensajes mostrados
     en el chat. El monitoreo no lee parámetros de iframe.


1. HISTORIAL ACUMULATIVO DE METAS DE LA SALA

   - Protección contra las actualizaciones del DOM y los cambios de pestaña
     del chat.

   - Un acumulador inteligente (Merge) conserva el historial de metas de la
     sesión aunque estas salgan del área visible del chat o la sala entre en
     modo ticket/offline.

   - Se conservan los estados de las metas (Pendiente, Completada,
     Interrumpida) y las metas completadas se agregan automáticamente a la
     lista de tareas.


2. LISTA DE TAREAS Y COPIA RÁPIDA

   - Las solicitudes se agregan automáticamente desde el Menú de Propinas,
     los resultados de plugins/ruleta, el Fan Club y las metas completadas.

   - El panel muestra cada elemento con la hora [HH:MM:SS], el usuario y el
     origen.

   - El nuevo botón "📋 Copiar pendientes" copia solo las tareas que aún no
     se completaron al portapapeles, con un formato limpio y encadenado:

     descripción (@nombredeusuario) -> descripción (@otronombre).


3. REGISTRO DE SHOWS (PRIVADO, EXCLUSIVO, GRUPO Y TICKET)

   - Los cargos y registros se crean inmediatamente al comenzar un show y
     luego se calculan ciclos precisos por cada 60 segundos activos.

   - Los importes de los Shows en Grupo se calculan dinámicamente según la
     tarifa por minuto y la cantidad de participantes que están mirando.

   - Los Ticket Shows se clasifican con datos del DOM, el precio anunciado y
     la confirmación de que el usuario ingresó.


4. DETECCIÓN DE ESPECTADORES SOSPECHOSOS / BOTS

   - El análisis de comportamiento combina el tiempo sin interacción, la liga
     y el nivel (con atención especial a las cuentas Grises de nivel 9 o
     inferior), patrones numéricos o genéricos en los nombres de usuario y
     salidas/regresos sincronizados durante shows restringidos.


5. PANELES ANALÍTICOS (SESIÓN ACTIVA Y RESUMEN DIARIO)

   - 📊 Analítica de sesión activa ofrece en tiempo real los picos y promedios
     de espectadores, la actividad efectiva, los tokens y la retención.

   - Retención de hoy muestra los usuarios nuevos y recurrentes, además del
     porcentaje de retorno. Los usuarios cuya fecha de primera visita se
     desconoce se clasifican como recurrentes; no se supone que sean nuevos.

   - La actividad efectiva es el tiempo neto en transmisión en vivo dividido
     por el tiempo total monitoreado. El Ritmo estima tokens por hora neta de
     la sesión.

   - 📅 Resumen diario (hoy) combina todas las transmisiones del día e incluye
     tokens, el pico máximo de espectadores y estadísticas de usuarios y
     ligas.

   - El Flujo de tokens permite elegir bloques de 5, 10 o 30 minutos, o de
     1 hora. Las diferencias entre el total diario y los registros por minuto
     se incluyen en el bloque actual; el tooltip identifica los tokens sin
     hora registrada. Los informes del día muestran esos tokens aparte, en
     lugar de distribuirlos artificialmente entre los intervalos.
     El panel de sesión también muestra el flujo promedio de usuarios listados
     en bloques de 2 minutos, actualizado cada 2 minutos.

   - La pestaña Usuarios muestra áreas independientes por liga y una línea
     del total de usuarios listados, en bloques de 2 minutos. El pico de
     espectadores de la sala sigue apareciendo en el encabezado; los
     espectadores sin nombre visible no se incluyen en el recuento de
     usuarios listados.


6. EVENTOS Y RESÚMENES POR SESIÓN O DÍA

   - La tabla de eventos y los bloques de resumen de la pestaña Eventos
     pueden alternar entre los datos de la sesión actual y los acumulados del
     día.

   - El selector Sesión/Día actualiza en conjunto la lista de eventos, el
     resumen consolidado por elemento, el gráfico de ganancias por tipo y la
     clasificación de usuarios.

   - Siguen disponibles los filtros Todos, Propinas, Menú y Metas/Shows.
     Menú limita la lista a eventos de menú/pedido; Metas/Shows incluye
     metas épicas, shows y tickets.

   - Los eventos se separan por fecha local (hora de Brasilia), para evitar
     que los registros del día anterior aparezcan en el resumen de hoy.


7. MODERACIÓN AUTOMÁTICA Y SEGUIMIENTO DE USUARIOS SILENCIADOS

   - Se pueden registrar dinámicamente palabras clave prohibidas por modelo
     como etiquetas.

   - La extensión puede intentar silenciar a un usuario mediante un cuadro
     de confirmación y mantiene un historial completo (PENDIENTE, ÉXITO o
     FALLO).

   - Los usuarios silenciados se detectan de forma robusta en el chat
     (.user-muted-message), registrando al autor, al moderador y el mensaje
     capturado más reciente.


8. CONTROL DEL TIEMPO E INTERFAZ FLOTANTE

   - Hay cronómetros independientes para el tiempo total transcurrido y el
     tiempo neto activo.

   - En el modo Monitorear sala, el aviso de sala offline espera 2 minutos y
     los mensajes nuevos prolongan la espera antes de terminar el monitoreo.

   - El panel se puede arrastrar desde el encabezado o la barra inferior
     interna, que muestra la fecha y el logo. Se puede ajustar el tamaño desde
     cualquiera de las cuatro esquinas. También se puede fijar y ofrece
     recolección automática alternando entre las pestañas de chat y usuarios.

   - El icono de la extensión muestra el avatar de la modelo mientras el
     monitoreo está activo.


9. EXPORTACIÓN E HISTORIAL LOCAL

   - Exporta informes completos de usuarios, visitas, tiempo y tokens en
     formato CSV.

   - Hay informes detallados en una página dedicada de la extensión, que se
     abre desde el popup o el panel. Los informes por período también muestran
     la evolución diaria de usuarios nuevos y recurrentes cuando se guardaron
     esos datos. El rey actual de cada día también se registra y aparece en
     los informes diarios y los resúmenes por período.

   - Los intervalos de los gráficos se seleccionan automáticamente según la
     duración registrada:
     hasta 9 min: 1 min; 10–29 min: 2 min; 30–59 min: 5 min; 1h–1h39: 10 min;
     1h40–2h59: 20 min; 3h–4h59: 30 min; desde 5h: 1 hora.

   - El período también incluye un mapa de calor por día/hora, una cronología
     de actividad y moderación, interacción por usuario, eficiencia de la
     audiencia, contribuciones por liga e historial combinado de metas y
     shows.

   - Cada meta o show de la cronología del período se puede borrar de forma
     individual. La acción pide confirmación, elimina el registro del
     historial y no recalcula las métricas agregadas. Antes de borrar, hay
     que pausar el monitoreo de ese modelo.

   - Los informes diarios y por período muestran la conversión de usuarios
     nuevos y recurrentes en donantes cuando hay datos completos. En los
     informes por período, los usuarios recurrentes se cuentan por día, así
     que una misma persona puede aparecer en varios días.

   - Para validar el total del rey, se conserva el valor del sitio hasta que
     coincida con la suma de las propinas capturadas en el chat; después de
     confirmarlo, el informe sigue la suma del chat. Si el límite para
     convertirse en rey aparece antes que el nombre, el sistema identifica
     quién lo alcanzó. Este historial comienza con esta versión y guarda solo
     el rey observado más recientemente para cada día.

   - Hay copias de seguridad JSON completas o limitadas a una modelo,
     disponibles en el panel y en la página de informes, con validación,
     vista previa, confirmación y un límite de 25 MiB. La restauración
     selectiva reemplaza los datos de esa modelo y conserva los demás,
     incluso en el historial compartido. Se siguen reconociendo las copias
     antiguas como completas; una copia limitada no se puede usar como
     restauración completa.

   - El historial se guarda en IndexedDB de la extensión, más adecuado para
     grandes volúmenes de datos que el almacenamiento clave/valor del navegador.

   - El uso de IndexedDB que aparece en la pestaña Historial es una estimación
     del tamaño de los datos serializados; el espacio real usado por el
     navegador puede variar.

   - La restauración comprueba todas las pestañas de Stripchat abiertas;
     pausa el monitoreo antes de importar. Una restauración completa
     reemplaza los datos locales de SC Monitor, así que exporta una copia
     actual antes de restaurar otro archivo. Guarda los archivos exportados
     fuera del navegador para evitar perderlos al desinstalar la extensión.

   - El contexto se aísla automáticamente al navegar entre salas (SPA).


------------------------------------------------------------------------
📖 GUÍA DE LAS PESTAÑAS Y LOS CONTROLES DEL PANEL
------------------------------------------------------------------------

PESTAÑAS

   - 📊 General: muestra la sala y el estado del monitoreo, tokens de la
     sesión y del día, tiempo total y neto, espectadores y ajustes de tarifas
     del Fan Club y los shows. Los valores de los shows son estimaciones.

   - 👥 Usuarios: presenta las cifras de audiencia, usuarios nuevos y
     recurrentes, ligas, el gráfico de usuarios listados y la lista de
     usuarios con tokens, propinas y mensajes. Los filtros permiten ver a
     todos, los nuevos o los recurrentes. También muestra espectadores
     sospechosos según criterios heurísticos; esto no confirma que una cuenta
     sea un bot.

   - 💰 Eventos: reúne los eventos capturados, como propinas, compras de
     contenido, menú, metas y shows. Los filtros separan todos los eventos,
     propinas, menú y metas/shows. Incluye las tareas generadas a partir de
     solicitudes y las metas de la sala; haz clic en una tarea para marcarla
     como completada.

   - 🛡️ Moderación: permite registrar palabras y frases prohibidas y consultar
     mensajes moderados y usuarios silenciados. La extensión puede intentar
     silenciar mensajes identificados; consulta el historial para ver el
     resultado.

   - 🗂️ Historial: muestra las salas/modelos y los datos diarios guardados,
     con acciones para esos registros. También permite exportar e importar
     copias de seguridad completas o de una modelo. Pausa el monitoreo en
     todas las pestañas abiertas antes de restaurar.

   - 📑 Informe: compara datos de la sesión, del día o de un período.
     Selecciona la sala y las fechas para consultar los gráficos y las
     métricas; usa "Página" para abrir los informes detallados. "Copiar
     resumen" y "CSV" exportan los datos del informe seleccionado.


CONTROLES DEL PANEL

   - Idioma: elige Português (Brasil), Español o English en el encabezado del
     panel o en la página de informes. La preferencia se aplica a las
     interfaces abiertas.

   - Monitorear / Pausar monitor: inicia o termina manualmente la recolección
     de la sesión actual. Al pausar, la sesión termina y se guarda; el
     historial diario no se borra.

   - Recolección automática: mientras el monitoreo está activo, alterna entre
     las pestañas de chat y usuarios aproximadamente cada 12 segundos para
     actualizar los eventos y la lista de usuarios; luego vuelve al chat. No
     inicia el monitoreo por sí sola.

   - Monitorear sala (OFF ⇄ ON): sigue automáticamente la sala abierta.
     Inicia la recolección cuando detecta una transmisión en vivo y termina
     después de 2 minutos offline sin mensajes nuevos en el chat. Los
     mensajes prolongan la espera; volver al directo cancela la parada. Al
     navegar a otra sala, termina la recolección de la sala monitoreada.
     Desactivar esta opción deshabilita la automatización, pero no pausa una
     sesión que ya esté monitoreando; usa "Pausar monitor".

   - Fijar: mantiene el panel abierto al hacer clic fuera de él. Para cerrarlo,
     usa "Cerrar".

   - Mover y cambiar tamaño: arrastra el panel desde el encabezado o la barra
     inferior. Ajusta el tamaño arrastrando cualquiera de las cuatro esquinas.

   - Actualizar: solicita una nueva lectura de los datos disponibles en la
     página. Guardar almacena los datos locales en ese momento. CSV exporta
     datos en formato de hoja de cálculo; "Limpiar sesión" reinicia los datos
     de la sesión actual.


------------------------------------------------------------------------
📂 ESTRUCTURA DEL PROYECTO
------------------------------------------------------------------------

```text
site_monitor/

├── manifest.json            # Configuración de la extensión Chromium Manifest V3 (v5.0)
├── README.txt               # Documentación oficial del proyecto
├── README.en.md             # Documentación en inglés
├── README.es.md             # Documentación en español
├── reports.html             # Página dedicada a los informes
├── reports.css              # Estilos de la página de informes
├── popup/
│   ├── popup.html           # Popup simplificado de la barra del navegador
│   ├── popup.css            # Estilos del popup
│   └── popup.js             # Conecta el popup con la pestaña activa
├── src/
│   ├── content.js           # Orquestación del monitoreo, sesión y navegación SPA
│   ├── background.js        # Service worker, IndexedDB, copias e icono por pestaña
│   ├── core/
│   │   ├── state.js         # Estado global en memoria y métricas
│   │   ├── persistence.js   # Guardado, consolidación e historial diario
│   │   ├── configuration.js # Valores iniciales y limpieza de opciones temporales
│   │   ├── backup.js        # Validación y formato de copias JSON
│   │   ├── room-king.js     # Concilia el rey actual con valores del sitio y el chat
│   │   ├── storage.js       # Interfaz de almacenamiento mediante el service worker
│   │   └── ui-refresh.js    # Actualizaciones de interfaz separadas de los módulos de dominio
│   ├── modules/
│   │   ├── auto-collector.js # Alternancia de pestañas y ciclo de recolección automática
│   │   ├── events.js        # Lectura de mensajes, propinas, plugins y shows
│   │   ├── moderation.js    # Motor de comprobación y filtrado por palabras clave
│   │   └── parsers.js       # Extractores del DOM para metas, rey, usuarios y ligas
│   ├── ui/
│   │   ├── panel.js         # Navegación, estado y orquestación del panel
│   │   ├── panel-events-controller.js # Resumen, filtros y eventos de la pestaña Eventos
│   │   ├── panel-report-controller.js # Estado e integración de la pestaña Informe
│   │   ├── panel-report-workspace.js # Carga y renderiza informes en el panel
│   │   ├── panel-report-controls.js # Controles y selectores de la pestaña Informe
│   │   ├── panel-template.js # Marcado HTML del panel
│   │   ├── panel-resize.js  # Cálculo del cambio de tamaño desde las cuatro esquinas
│   │   ├── open-reports.js  # Abre la página dedicada de informes
│   │   ├── chart-data.js    # Normalización y agregación de series temporales
│   │   ├── reports-page.js  # Controles y carga de informes
│   │   ├── reports-view.js  # Renderizado de informes detallados
│   │   ├── report-charts.js # Gráficos y controles de granularidad del informe
│   │   ├── report-data.js   # Agregación temporal y métricas de los informes
│   │   ├── history/
│   │   │   └── history-table.js # Renderizado de la tabla de historial
│   │   ├── users/
│   │   │   └── users-table.js # Renderizado y filtros de la tabla de usuarios
│   │   ├── todos/
│   │   │   └── todo-list.js # Renderizado y formato de las tareas
│   │   ├── moderation/
│   │   │   └── moderation-view.js # Renderizado de las listas de moderación
│   │   ├── dashboard/
│   │   │   ├── basic-charts.js # Gráficos SVG del panel
│   │   │   ├── daily-stats.js # Marcadores del resumen diario
│   │   │   └── event-summary.js # Renderizado del resumen de eventos
│   │   └── export/
│   │       └── csv-export.js # Generación y descarga de informes CSV
│   └── utils/
│       └── helpers.js       # Utilidades (sanitización de texto y formateadores)
└── tests/                   # Pruebas de regresión con el runner nativo de Node.js
```


PRUEBAS DE REGRESIÓN

   - Requiere Node.js 18 o posterior. Ejecuta `npm test` en la raíz del
     proyecto.
   - Las pruebas usan el runner nativo de Node.js y no agregan dependencias
     de terceros.
   - La suite cubre almacenamiento y copias de seguridad, persistencia,
     informes, captura de eventos, historial del rey y cambio de tamaño del
     panel.


------------------------------------------------------------------------
⚙️ CÓMO INSTALAR / ACTUALIZAR EN GOOGLE CHROME / BRAVE / EDGE
------------------------------------------------------------------------

AVISO: La extensión no se ha probado con una cuenta de modelo. Recomendamos
usar Stripchat con una cuenta normal de espectador.

La extensión se puede usar sin iniciar sesión, pero puede que no lea
correctamente los eventos de Ticket Show. Sin iniciar sesión, el precio del
ticket puede aparecer en dólares en lugar de tokens.

Descargar el código desde GitHub:

   Repositorio: `https://github.com/UsuarioGitQualquer/SC-MONITOR`

   - GitHub CLI:
     `gh repo clone UsuarioGitQualquer/SC-MONITOR`

   - Git:
     `git clone https://github.com/UsuarioGitQualquer/SC-MONITOR.git`

   - Descargar como ZIP desde el navegador:
     Abre `https://github.com/UsuarioGitQualquer/SC-MONITOR`, selecciona
     Code > Download ZIP y extrae el archivo.

   - Descargar y extraer como ZIP desde PowerShell (rama main):
     `$repo = "https://github.com/UsuarioGitQualquer/SC-MONITOR"`
     `$zip = "$HOME\Downloads\SC-Monitor.zip"`
     `Invoke-WebRequest -Uri "$repo/archive/refs/heads/main.zip" -OutFile $zip`
     `Expand-Archive -Path $zip -DestinationPath "$HOME\Downloads\SC-Monitor-source"`

   Después de clonar o extraer, selecciona la carpeta raíz del proyecto que
   contiene `manifest.json` al elegir "Load unpacked" (Cargar descomprimida).

1. Abre la página de extensiones del navegador:
   - Chrome o Brave: `chrome://extensions/`
   - Edge: `edge://extensions/`

2. Activa "Modo de desarrollador" en la esquina superior derecha.

3. Elige el procedimiento correspondiente:
   - INSTALACIÓN NUEVA: haz clic en "Load unpacked" (Cargar descomprimida)
     en la esquina superior izquierda y selecciona la carpeta raíz del
     proyecto que contiene `manifest.json`.
   - ACTUALIZACIÓN: busca SC Monitor en la lista de extensiones y haz clic
     en el icono de recarga (↻) de su tarjeta.

4. Abre la página de una transmisión de Stripchat y haz clic en el icono 📊
   de la extensión. Si la extensión se actualizó con la sala ya abierta, al
   abrir el popup se intentará reconectar el panel automáticamente, sin
   recargar la página.


Permitir el uso en ventanas de incógnito (opcional):

   - En la página de extensiones (`chrome://extensions/`), busca la tarjeta
     de SC Monitor y haz clic en "Detalles".
   - Desplázate hacia abajo hasta "Permitir en modo incógnito".
   - Activa la opción para permitir la extensión en páginas de Stripchat
     abiertas en una ventana de incógnito.


------------------------------------------------------------------------
🔒 PRIVACIDAD Y SEGURIDAD
------------------------------------------------------------------------

   - Todo el procesamiento de mensajes, el recuento de tokens y la captura
     de datos se realizan exclusivamente en el navegador (client-side).

   - El historial se guarda en IndexedDB local de la extensión, con una cuota
     ampliada mediante `unlimitedStorage`. Los datos permanecen en el
     navegador; conserva copias externas.

   - No se envía información de la modelo, los espectadores ni el chat a
     servidores externos.

   - Mientras el monitoreo está activo, el avatar de la modelo se carga desde
     el CDN de Stripchat para el icono de la pestaña; la imagen no se reenvía
     a otros servidores.

========================================================================
