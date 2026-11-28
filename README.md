# Atalaya · inteligencia pública para Travian Legends

Atalaya es una alternativa a travcotools centrada en los datos públicos del juego. Descubre los mundos activos, descarga cada día su `map.sql`, guarda el historial y lo convierte en información que puedes usar:

| Función | Qué aporta frente a las herramientas clásicas |
|---|---|
| **Calendario del mundo** | Cada mundo publica en `/api/v1/info` cuándo salen los **artefactos** y los **planos de construcción**, el nivel de la Maravilla, las tribus disponibles y sus reglas (vacaciones, ciudades, puertos, fusión de tropas…). Atalaya lo guarda a diario y lo enseña en el Panel y en la ficha de cada mundo, con cuenta atrás. |
| **Mundos activos** | Detección automática desde `status.travian.com` y el calendario del lobby. Panel comparativo de todos los mundos: indicadores globales, burbujas de jugadores por día de vida, actividad diaria, reparto por región, velocidad y edad, destacados y próximas aperturas. Tabla o tarjetas con 14 ordenaciones, filtros que acotan toda la vista, exportación a CSV y panel con la evolución de cada mundo. Se adapta desde el móvil hasta monitores 4K. |
| **Buscador de inactivos** | Confianza 0–100 % **explicada** (días sin crecer, si le están catapulteando, si ha perdido aldeas, cuentas nuevas en protección). Modos por aldea o por jugador, distancia en el mapa que da la vuelta, tiempo de viaje real por unidad con plaza de torneos y artefactos, prioridad y exportación (coordenadas, CSV, Discord, BBCode). **Asistente para listas de vacas**: seleccionas los mejores 10/25/50/100 con un clic y Atalaya te lleva objetivo a objetivo: abre la ficha de cada aldea siempre en la misma pestaña del juego (dos clics: «Agregar a la lista de vacas» y Guardar) o copia `x\|y` para pegarlo en «Añadir objetivo». Atajos de teclado (Enter añadida, S saltar, D descartar), cola que se reanuda, **ventana flotante** siempre encima del juego (Chrome y Edge) y memoria de lo que ya está en tus listas: no vuelve a proponerlo. |
| **Mapa interactivo** | Canvas con zoom y desplazamiento, color por alianza, tribu, actividad o población, resaltado de jugadores, alianzas y coordenadas. |
| **Eventos** | Diferencias diarias: conquistas, destrucciones, fundaciones, cambios de alianza, cuentas borradas y cambios de nombre. Incluye un gráfico por día y **guerras entre alianzas**: quién conquista a quién, con cuántas aldeas y cuántas le devuelven. |
| **Perfiles** | Jugador y alianza en un panel lateral: historial de población, aldeas, territorio, ganancias y pérdidas, miembros inactivos. |
| **Clasificación** | Población con crecimiento a 24 h y 7 días, tendencia y filtros. La pestaña **Tribus** reparte el mundo por tribu: jugadores, aldeas, población, medias y crecimiento. |
| **Listas de vacas** | Pegas la lista de vacas del juego y Atalaya localiza cada objetivo en el `map.sql` y da un veredicto explicado. Lo mejor es pegar el **código fuente de la página** (Ctrl+U): ahí van los datos de todas tus listas con coordenadas exactas, tropas, icono del último informe, botín frente a capacidad y **botín acumulado y medio por objetivo**, oasis incluidos. También vale el texto copiado de la página (se localiza por nombre y distancia) o una lista de x\|y. Veredicto: **mantener**, **revisar**, **quitar** o **no existe**. Detecta dueños activos, aldeas que han crecido desde el último `map.sql`, objetivos renombrados o destruidos, botines llenos o casi vacíos (con la carga real de cada unidad), calcula el **neto de cada atraco** (botín menos el cereal del viaje) y propone inactivos cercanos que aún no están en la lista. |
| **Informes de batalla** | Pegas un informe del juego, aunque copies la página entera, y Atalaya resume bajas por bando, botín, carga y **neto** (botín menos materias perdidas), con un consejo si ninguna tropa volvió, si salió a pérdida o si puedes mandar más. Lo prepara para compartir en BBCode o Discord, con opción de ocultar nombres. |
| **Vecindario** | Alrededor de tu aldea o de cualquier punto: jugadores ordenados por peligro, cuánto tardaría la unidad de atraco más rápida de cada uno en llegar, peso de cada alianza en la zona, novedades recientes y candidatos a reclutar (activos sin alianza). |
| **Terreno** | Croppers (9c, 15c y 18c) y oasis. `map.sql` solo trae aldeas, así que el jugador pega la respuesta que su propio navegador recibió al pasar el ratón por el mapa del juego (31×31 casillas con el zoom más alejado), varias seguidas o un HAR de la pestaña Red con todas. **Sitios para fundar**: tipo de casilla (15c, 9c…), bono de cereal posible con los tres mejores oasis libres del 7×7, cereal efectivo, distancia y vecinos según `map.sql`. **Oasis**: bono, animales, defensa que suman, botín para el héroe, oasis vacíos para atracar sin bajas y **tu último atraco** a cada uno (cuándo, con o sin bajas, botín y capacidad). |
| **Herramientas** | Calculadora de viaje, planificador de llegada (“¿cuándo envío para llegar a las 18:00?”) y **analizador de ataques entrantes**: con las coordenadas del atacante y el “llega en” del juego dice qué unidad es la más lenta posible (atraco rápido, arietes o catapultas, o cacique y riesgo de conquista). Si añades varios ataques a la lista, los compara y marca **indicios de fake**: aldea de origen pequeña, jugador repartido entre muchos objetivos, trenes o varias aldeas sobre un mismo objetivo. Se puede **pegar el resumen de la plaza de reuniones** para añadir todos los ataques de una vez. **Calculadora de ejército** con los datos del manual del juego: ataque de infantería y caballería, defensas, coste, consumo, carga, tiempo de formación, cuántas unidades salen con tus recursos (con o sin cambio de mercado) y comparador de unidades por cada 1000 recursos. Incluye una **calculadora de puntos de cultura**: con lo que tienes, lo que necesitas y tu producción diaria dice qué día podrás tener la siguiente aldea. |
| **Operaciones** | Planificador de oleadas con **llegada común**: una fila por envío (quién, origen, objetivo, unidad más lenta, plaza de torneos, real o fake y desfase en segundos para trenes) y Atalaya calcula la hora de salida de cada una, con cuenta atrás. Se comparte por **enlace** (el plan va tras la `#`, no pasa por ningún servidor), Discord o BBCode, en hora local o UTC. Quien abre un enlace ve el plan sin perder el suyo. |
| **Enlaces al juego** | Cada aldea, jugador y alianza se abre en Travian: la casilla (con “Agregar a la lista de vacas”), el formulario de enviar tropas con x\|y rellenos (lo confirma siempre el jugador) y los perfiles. |
| **Vigilancia y alertas** | Lista de seguimiento y alertas por **webhook de Discord**: un jugador se para, conquistas o fundaciones en una zona, cambios de alianza, pérdidas de una alianza. |
| **Experiencia** | Español e inglés, tema claro y oscuro, paleta de comandos (`Ctrl K` o `/`), diseño adaptado a móvil y una interfaz rápida porque filtra en el navegador. |

> La demo publicada usa mundos **simulados** con el mismo motor que procesa los `map.sql` reales (`backend/atalaya/synthetic.py`).

---

## Puesta en marcha

### Con Docker (recomendado)

```bash
docker compose up -d --build
# Interfaz y API: http://localhost:8000      Documentación de la API: http://localhost:8000/docs
```

El servicio `collector` descubre los mundos y descarga sus `map.sql`. La primera pasada crea la instantánea inicial. Los inactivos y los eventos aparecen a partir del **segundo día**, porque se calculan comparando instantáneas.

### En internet, gratis y sin servidor (GitHub Actions + GitHub Pages)

La versión publicada no necesita ninguna máquina encendida. El workflow [`.github/workflows/collect.yml`](.github/workflows/collect.yml) se ejecuta **cada hora**:

1. Restaura la base SQLite desde la release `state` del repositorio (comprimida con zstd, unos 70 MB).
2. Ejecuta `collect`, que descubre los mundos y descarga los `map.sql` que hayan cambiado.
3. Si no hay nada nuevo, termina en un par de minutos. Si lo hay, **poda** la base (`prune`: 5 instantáneas por aldea, 60 de historial por jugador y alianza, mundos terminados 14 días), la guarda como un fichero nuevo de la release (se conservan los dos últimos) y **publica** la web.
4. La web se genera con `export-static` (un JSON por mundo con lo mismo que devolvería la API) y `web/build.py --static data`, y se despliega en GitHub Pages.

Al subir código a `main` también se vuelve a publicar. Si una pasada no encuentra la base guardada, falla en vez de empezar de cero (se perdería el historial). Para empezar de cero de verdad, lánzalo a mano desde *Actions → Recolectar y publicar → Run workflow* con `fresh` marcado. GitHub desactiva los workflows programados de un repositorio sin actividad durante 60 días, así que el propio workflow hace un commit vacío de mantenimiento cuando hace falta.

Limitaciones frente al servidor:
- Los datos se actualizan como mucho cada hora (los mundos regeneran `map.sql` una vez al día). El cron de GitHub puede retrasarse unos minutos.
- No hay API: los **avisos de Discord** no se crean desde la web. Se configuran en el secreto `ATALAYA_ALERT_RULES` del repositorio (*Settings → Secrets and variables → Actions*), con una lista JSON de `{server_id, kind, params, webhook_url, label}`. La página *Vigilancia* tiene un botón para copiar en ese formato las alertas creadas en tu navegador. En la base publicada solo queda una huella del webhook, nunca la URL.
- Los mundos de `ATALAYA_EXTRA_SERVERS` y `ATALAYA_IGNORE_SERVERS` se definen como *variables* del repositorio.
- El repositorio tiene que ser público para tener GitHub Pages y minutos de Actions ilimitados con el plan gratuito. La base de la release es pública, igual que los `map.sql` de los que sale.

Lo que el usuario guarda (aldea, vigilados, listas de vacas, terreno, operaciones) vive en su navegador, igual que con el servidor, salvo que inicie sesión (siguiente apartado).

### Cuentas y sincronización (opcional, con Supabase)

Cada jugador puede iniciar sesión para tener sus datos en todos sus dispositivos. Es **opcional**: sin sesión la web funciona exactamente igual y no carga nada de fuera. Se entra con un **enlace o código por correo** y, si se activa, con **Discord**. El botón de la nube, arriba a la derecha, muestra si hay sesión y el estado (sincronizado, sincronizando, sin conexión, error); al pulsarlo se entra, se sale, se sincroniza a mano, se descargan los datos o se borra la cuenta.

**Qué se sincroniza** (claves de `A.store`, por mundo las que llevan `:<mundo>`):

| Se sincroniza | Se queda en el navegador |
|---|---|
| `homes` aldea de cada mundo · `watch` vigilados · `rules:<mundo>` reglas de alerta · `webhook` el de Discord de las alertas · `fbMarks:<mundo>` marcas del asistente · `farmText:<mundo>`, `farmArmy:<mundo>` lista de vacas pegada y ejército · `reportText:<mundo>` informe pegado · `culture:<mundo>` puntos de cultura · `incoming:<mundo>` ataques apuntados · `ops:<mundo>` operación · `land:<mundo>` terreno · `army:<mundo>` tropas del planificador | Preferencias de interfaz: `theme`, `lang`, `sid` (último mundo), `filters`, `mapMode`, `nb`, `landView`, `opsUtc`, `srv:prefs`, `fbPrefs`. Estado pasajero del asistente de listas, ligado a la pestaña del juego: `fbq:<mundo>`, `fbResume` |

**Cómo se fusiona.** Una fila por clave en la tabla `user_data(user_id, key, value jsonb, updated_at, synced_at)`. Cada escritura queda apuntada con su hora y se sube a los 2-3 segundos; los cambios de otros dispositivos se bajan al abrir la página, al volver a la pestaña y cada 90 s. **Gana el más reciente por clave**, y el servidor lo garantiza: un disparador ignora una escritura con `updated_at` anterior al que ya tiene. Lo que había en el navegador antes de iniciar sesión por primera vez se **fusiona** con la nube sin perder nada (objetos clave a clave, listas sin repetir) y se guarda además una copia local en `~backup:<clave>`. Sin conexión, los cambios esperan y se suben al volver. Si en el mismo navegador entra otra cuenta, los datos de la anterior no se suben a la nueva. De un HAR pegado solo se sube el JSON de las respuestas (sin cabeceras ni cookies del juego).

**Seguridad.** La clave pública (*anon* o *publishable*) va en el HTML: es pública por diseño y solo permite lo que dejan las políticas. La tabla tiene **Row Level Security**: cada usuario solo lee y escribe sus filas. Hay cuota por usuario (2000 claves, 25 MB, 1 MB por clave) para que nadie llene la base gratuita. `web/build.py` se niega a publicar la clave secreta (`service_role` o `sb_secret_…`). supabase-js se carga de jsDelivr con versión fija (2.118.0) e integridad SRI, y solo cuando el jugador usa la cuenta.

**Puesta en marcha** (una vez, unos 10 minutos):

1. Crea un proyecto en [supabase.com](https://supabase.com) con el plan *Free* (no pide tarjeta). Elige la región **Central EU (Frankfurt)** para que los datos se queden en la UE.
2. *SQL Editor → New query*: pega [`supabase/schema.sql`](supabase/schema.sql) y pulsa *Run*. Crea la tabla, las políticas, el disparador y la función `delete_my_account` (para que cada usuario pueda borrar su cuenta). Se puede ejecutar otra vez sin problema.
3. *Authentication → URL Configuration*: *Site URL* `https://juanfra-martinez.github.io/atalaya/`, y en *Redirect URLs* esa misma y `http://localhost:8766/` (para probar en local).
4. *Authentication → Emails → Templates*: en **Magic Link** y en **Confirm signup** añade el código, por ejemplo `<p>O escribe este código en Atalaya: <b>{{ .Token }}</b></p>`. Así se puede entrar escribiendo el código, también si el correo se abre en otro dispositivo (el enlace tiene que abrirse en el mismo navegador donde se pidió).
5. **Correo para usuarios reales.** El servidor de correo que trae Supabase es para pruebas: hoy solo envía a los miembros del equipo del proyecto y unos pocos correos por hora. Para abrirlo a todos, configura un SMTP propio en *Authentication → Emails → SMTP Settings* (por ejemplo [Resend](https://resend.com) o [Brevo](https://www.brevo.com), con plan gratuito) y sube el límite en *Authentication → Rate Limits*. Entrar con Discord no necesita correo.
6. *(Opcional) Discord*: crea una aplicación en el [portal de desarrolladores de Discord](https://discord.com/developers/applications), en *OAuth2* añade la redirección `https://<tu-proyecto>.supabase.co/auth/v1/callback`, y pega el *Client ID* y el *Client Secret* en *Authentication → Sign In / Providers → Discord*.
7. *Project Settings → API Keys* (o *Data API*): copia la **Project URL** y la clave **pública** (*anon* o *publishable*). Nunca la *service_role* / *secret*.
8. En GitHub, *Settings → Secrets and variables → Actions → **Variables*** (no secretos, porque son públicos):
   - `ATALAYA_SUPABASE_URL`: la Project URL (`https://<ref>.supabase.co`).
   - `ATALAYA_SUPABASE_ANON_KEY`: la clave pública.
   - `ATALAYA_AUTH_PROVIDERS` *(opcional)*: `discord` si hiciste el paso 6.
   - `ATALAYA_SUPABASE_REGION` *(opcional)*: cómo se nombra la región en la política de privacidad, por ejemplo `la Unión Europea (Fráncfort, Alemania)`.
   - `ATALAYA_PRIVACY_CONTACT` *(opcional)*: correo o URL para las solicitudes de privacidad. Sin ella se muestra la página de incidencias del repositorio, que es pública: mejor un correo.
9. Lanza el workflow a mano (*Actions → Recolectar y publicar → Run workflow*) o sube cualquier cambio a `main`. Mientras haya URL y clave configuradas, cada pasada hace además una petición mínima a Supabase para que el proyecto gratuito no se pause por inactividad (se pausa tras una semana sin uso).

Para probar en local, con los datos de una pasada en `web/dist/site/data`:

```bash
python web/build.py --static data --out web/dist/site/index.html \
  --supabase-url https://<ref>.supabase.co --supabase-key <clave pública>
python -m http.server 8766 --directory web/dist/site   # http://localhost:8766/
```

**Privacidad (RGPD).** Los correos son datos personales. La web incluye una política de privacidad (enlace *Privacidad* en el pie del menú, `#privacy`) que explica qué se guarda, para qué, dónde, cuánto tiempo y cómo ejercer los derechos. Desde la propia web el usuario descarga sus datos en JSON (portabilidad) y borra su cuenta con todo lo de la nube (supresión). Como responsable, conviene aceptar el acuerdo de tratamiento de datos (DPA) de Supabase desde su panel y atender las solicitudes que lleguen al contacto configurado.

### Sin Docker

```bash
cd backend
pip install -r requirements.txt
python ../web/build.py                       # genera web/dist/index.html
python -m atalaya.cli collect                # una pasada (o: collect --loop)
python -m atalaya.cli serve                  # http://localhost:8000
```

### Probar sin red (datos simulados)

```bash
cd backend
python -m atalaya.cli --db data/demo.db seed-demo
python -m atalaya.cli --db data/demo.db serve
# o generar la demo estática de un solo fichero:
python -m atalaya.cli --db data/demo.db export-demo /tmp/demo.json && python ../web/build.py --demo /tmp/demo.json
```

### Importar un map.sql descargado a mano

```bash
python -m atalaya.cli import map.sql --server ts1.x1.europe.travian.com --day 2026-11-01
```

### Tests

```bash
cd backend && python -m pytest -q
node --test web/tests/*.test.mjs         # lógica del navegador (listas de vacas, datos del juego, ataques, vecindario, tropas, terreno, operaciones, estadísticas de mundos, sincronización de cuentas)
```

Cubren el parser (11 y 16 columnas, escapes, gzip y varias tuplas por INSERT), la distancia en el mapa que da la vuelta, el tiempo de viaje, el modelo de inactividad, los eventos, la exportación, las alertas, el descubrimiento de mundos y la API.

---

## Cómo funciona

```
status.travian.com ─┐                                ┌─> /api/servers
lobby /api/calendar ┼─> discovery ─> servers         │
ATALAYA_EXTRA_*  ───┘                  │             ├─> /api/servers/{id}/world   (estado compacto + historial)
                                       ▼             ├─> /api/servers/{id}/events
https://<mundo>/map.sql ─> parser ─> ingest ─> SQLite ┤
       (ETag / If-Modified-Since)     │  diff         └─> /api/alerts  ──> webhook de Discord
                                      ▼
                         events · player_days · alliance_days
```

### 1. Descubrimiento de mundos (`discovery.py`)
1. **`https://status.travian.com/`**: el HTML incrusta `<script id="__GW_DATA__">` con `{"items": {…: {id, name, state, url}}}`.
2. **`https://lobby.legends.travian.com/api/calendar`** (público): próximos lanzamientos con fecha de inicio, velocidad y tipo. El host sale de `metadata.url` (`domain` es la región). Los que aún no han empezado quedan como **próximos** y no se descargan hasta su fecha.
3. **`https://<mundo>/api/v1/info`** (público): `ageInDays`, velocidad y tamaño del mapa, para conocer el día de vida real y la velocidad de hosts sin `xN` (`alpha.travian.com`, `ptr.travian.com`). De la misma respuesta sale el **calendario del mundo** (`artefactsDate`, `constructionPlansDate`, `wwLevel`, `tribeIds` y las reglas de `serverSupportedFeatures`), que se refresca como mucho una vez al día y se guarda en `servers.info`.
4. **`ATALAYA_EXTRA_SERVERS`**: lista manual de respaldo.

La velocidad y la región se deducen del dominio (`ts3.x2.europe.travian.com` → ×2, europe). Un mundo pasa a **terminado** cuando desaparece de su fuente (solo si esa fuente respondió) o su `map.sql` devuelve 404 tres veces seguidas.

### 2. Descarga e ingesta (`collector.py`, `ingest.py`)
- Descarga `map.sql` (y `map.sql.gz` si no existe), con concurrencia limitada, pausa entre peticiones y un *User-Agent* identificable (solo ASCII). Los servidores no envían `ETag` ni `Last-Modified`, así que si el contenido es idéntico a la última instantánea no se guarda como un día nuevo y se reintenta en la siguiente pasada.
- **Una instantánea por mundo y día.** La reingesta es idempotente.
- El parser (`mapsql.py`) acepta cualquier número de columnas (≥ 11), `NULL`/`TRUE`/`FALSE` y comillas escapadas. Formato actual de 16 columnas:
  `id, x, y, tid, vid, aldea, uid, jugador, aid, alianza, población, region, isCapital, isCity, isHarbor, victoryPoints`.
- Los eventos se obtienen comparando con la instantánea anterior **por id de aldea**, nunca por nombre ni coordenadas.

### 3. Modelo de inactividad (`analytics.player_inactivity`)
En Travian la población solo sube si el jugador construye, así que cualquier subida de población o de número de aldeas prueba que está activo.

- `streak`: días desde la última subida observada. `bounded` indica que nunca le vimos crecer en el historial guardado.
- Banderas: `attacked` (pierde población sin perder aldeas), `lost_village`, `new` (cuenta con menos de `5 / velocidad` días, que puede estar en protección de principiante) y `shrinking`.
- `confidence = 100 · (1 − e^(−streak / 2.5))`. Se rebaja si hay poco historial y se limita a 25 % en cuentas nuevas. Estado: `active`, `slowing` (1–2 días), `inactive` (≥ 3 días), `new` o `natar`.
- **Prioridad** de un objetivo = confianza × √población / (1 + distancia / 6), para ordenar por rentabilidad.

> Limitación: `map.sql` no indica vacaciones, baneos ni protección de principiante, así que se marcan como posibles, nunca como hechos.

### 4. Viaje (`geo.py` / `core.js`)
La velocidad de las tropas no es proporcional a la del mundo: `A.troopSpeed` aplica la tabla de Kirilloid (×1 → ×1; ×2, ×3 y ×5 → ×2; ×10 → ×4) en inactivos, vecindario, ataques entrantes, calculadora de viaje y operaciones. Está sin comprobar en un mundo rápido real, y en la calculadora y en operaciones el multiplicador se puede corregir a mano.

El mapa da la vuelta si el mundo tiene la regla `travelOverTheWorldEdge` (casi todos; se lee de `/api/v1/info`): los bordes se tocan y la distancia usa el camino más corto en cada eje. Sin esa regla la distancia es la recta, igual que la calcula el juego (`crypt.js`). La plaza de torneos solo acelera el tramo que pasa de 20 casillas (+20 % por nivel, configurable). Velocidades de unidades de las seis tribus jugables.

### 5. Lo que se cruza con el juego (`intel.js`)
Todo se calcula en el navegador con lo que el jugador pega o escribe; Atalaya no lee la cuenta de nadie.
- **Lista de vacas (datos del juego).** La página de Plaza de reuniones → Lista de vacas no pide sus datos aparte: los lleva incrustados en el HTML (`Travian.React.FarmList.render({gql, viewData})`). Por objetivo: `target{x y name population type}` (tipo 0 aldea, 1 capital, 2 oasis ocupado, 3 oasis libre), `troop{t1…t10}`, `distance`, `isActive`, `lastRaid{time raidedResources bootyMax icon}` (icono 1 sin bajas, 2 con bajas, 3 perdido) y `totalBooty{booty raids}`. Solo vienen las listas desplegadas. Atalaya guarda una copia reducida, sin `authKey` ni `reportObjectId`, que abren los informes. Con las tropas exactas el coste del viaje usa el consumo de cada unidad y la más lenta. Comprobado en International 7 (19 nov 2026).
- **Lista de vacas (texto).** El texto copiado de Plaza de reuniones → Lista de vacas trae, por objetivo, `nombre⇥habitantes⇥distancia`, las tropas, la hora y el botín del último atraco (con marcas de dirección U+202D/U+202C alrededor de los números, que se limpian). Sin coordenadas: cada objetivo se localiza por nombre y distancia desde tu aldea (el juego la redondea a un decimal); si el nombre ya no existe, por la única aldea a esa distancia con población parecida. Si el juego muestra más habitantes que el último `map.sql`, alguien está construyendo. Un botín igual a tropas × carga de alguna unidad significa que volvieron llenas.
- **Asistente de listas de vacas** (`farmbuild.js`). El juego no importa objetivos en bloque: se añaden de uno en uno. Por defecto el asistente abre `karte.php?x=&y=` en una pestaña del juego y la reutiliza navegándola por la referencia que devuelve `window.open` (en Chrome, buscarla por nombre abría otra pestaña; con la referencia la reutiliza y te lleva a ella). Si el navegador abre el juego en la misma pestaña que Atalaya, al volver atrás el asistente se reabre en el mismo objetivo. Esa URL abre la ficha de la aldea, y su enlace «Agregar a la lista de vacas» abre el formulario con el objetivo ya resuelto: dos clics. Si ya está en una lista, la ficha dice «Editar lista de vacas». Alternativa sin pestañas: el campo X de «Añadir objetivo» acepta pegar `x|y` y lo reparte en X e Y, pero el juego solo busca la aldea al salir del campo (~1 s) y hasta entonces Guardar está desactivado, así que es Ctrl+V → Tab → Guardar. Comprobado en International 7 (23 nov 2026, versión 718.5). La ventana flotante usa Document Picture-in-Picture (Chrome/Edge 116+) y, si no existe, una ventana emergente del mismo origen. Lo que ya está en tus listas sale de los datos pegados en «Listas de vacas» y de las marcas del asistente (`fbMarks:<mundo>` en el navegador); el buscador lo oculta y las sugerencias de «Listas de vacas» también. Atalaya nunca añade nada por su cuenta.
- **Neto del atraco.** Botín del último atraco − tropas × cereal por hora × horas de ida y vuelta, con la unidad y la plaza de torneos que elijas. Si no compensa, un objetivo “mantener” pasa a “revisar”. No cuenta bajas, sirve para comparar objetivos (las tropas comen igual en casa) y no aplica la velocidad del mundo: si el consumo escala con ella el resultado es exacto, y si no, el coste es un máximo. Esto último está sin verificar.
- **Informe de batalla.** Se lee por estructura, no por etiquetas: primer bloque de tropas, agresor; los demás, defensores y refuerzos (cabecera de 10 u 11 unidades, enviadas y perdidas); tras el agresor, cuatro recursos y `llevado/capacidad`; al final, tríos etiqueta, agresor y defensor. Las materias perdidas las calcula el juego. Comprobado con tres informes reales en español; ni otros idiomas, ni exploraciones, ni informes con héroe.
- **Ataque entrante.** Salió como muy tarde cuando lo viste, así que el viaje dura al menos llegada − visto; las unidades más rápidas no pueden ser la más lenta del ataque.
- **Indicios de fake.** Saldo de señales, nunca una prueba. Suman a favor de fake una aldea de origen con menos del 25 % de la población de la mayor del jugador (+2) y tres o más objetivos en 5 minutos (+1). Restan un tren (misma aldea y objetivo en 10 s, −2), varias aldeas sobre un objetivo en 1 minuto (−2) y la velocidad de un cacique (−3). Con un saldo de 2 o más, “posible fake”; con −2 o menos, “probablemente real”; un cacique nunca puede salir “posible fake”. La lista se guarda en el navegador y olvida los ataques llegados hace más de una hora.
- **Plaza de reuniones.** Cada movimiento del resumen es una tabla con la misma forma: aldea y descripción, coordenadas de origen, tropas y «Llegada en h:mm:ss». Se lee por estructura; los movimientos que salen de una aldea tuya se descartan. Comprobado con tropas salientes en un mundo real; con ataques entrantes está sin verificar.
- **Terreno.** La respuesta `POST /api/v1/map/position` del juego trae por casilla `{k.vt} {k.fN}` (libre, tipo N: f1…f12 y f13 = 0-0-0-18 en los mundos `crop18`, según las traducciones del propio juego), `{k.fo}` (oasis, con su bono `{a:rN} 25%`, sus animales `unit uNN` y, si ya lo atracaste, `{b:riN} fecha {b.riN}` y `{b:biN} llevado/capacidad`) o la aldea. Según `crypt.js`, el mapa **solo** lanza esa petición al pasar el ratón por una casilla cuyo tooltip no tiene en memoria (mover el mapa no basta; las imágenes llegan por `/map/block/…png`) y para un rectángulo que depende del zoom: 11×9 casillas con zoom 1, 21×17 con zoom 2 y 31×31 con zoom 3 (configuración que envía el servidor en la página del mapa). Atalaya **no** la pide: exige sesión y las reglas de Travian prohíben escanear el mapa con programas. Solo interpreta lo que el jugador copia a mano de su navegador (una respuesta, varias seguidas o un HAR) y lo guarda en ese navegador. Las fechas del último atraco («hoy», «ayer» o día) se interpretan respecto al momento de copiar. Formato comprobado en International 7 (18 y 19 nov 2026); las estadísticas de los animales son las tablas públicas de la comunidad.
- **Operaciones.** Salida = llegada común + desfase − viaje (segundos enteros), con el mismo motor de tiempos que la calculadora. La tribu sale de la aldea de origen según `map.sql`. El plan se guarda en el navegador y el enlace lo lleva como JSON compacto en base64 tras `#ops?w=<mundo>&o=…`. La velocidad de tropas es editable.
- **Unidades.** Ataque, defensas, coste, consumo, velocidad, carga y formación de romanos, germanos, galos, egipcios y hunos copiados del manual del juego (`gamedata.js`). Espartanos y vikingos (tribu 9), de las tablas públicas de Kirilloid, que en las otras cinco tribus coinciden con el manual; dudas anotadas en el código. El consumo de cereal de las seis primeras unidades de cada tribu sale de la tabla oficial del soporte de Travian (artículo 187), con la caballería romana sin abrevadero.

---

## Configuración (variables de entorno)

| Variable | Por defecto | Uso |
|---|---|---|
| `ATALAYA_DB` | `data/atalaya.db` | Fichero SQLite |
| `ATALAYA_EXTRA_SERVERS` / `ATALAYA_IGNORE_SERVERS` | — | Hosts separados por comas |
| `ATALAYA_LOOP_MINUTES` | `60` | Frecuencia de comprobación del recolector |
| `ATALAYA_CONCURRENCY` · `ATALAYA_REQUEST_DELAY` | `3` · `1.5` s | Educación con los servidores de Travian |
| `ATALAYA_VILLAGE_RETENTION_DAYS` | `45` | Instantáneas por aldea que se guardan (la exportación necesita al menos 4) |
| `ATALAYA_DAY_RETENTION_DAYS` | `0` (siempre) | Instantáneas de agregados por jugador y alianza y de eventos que conserva `prune` |
| `ATALAYA_ENDED_RETENTION_DAYS` | `0` (siempre) | Días que `prune` guarda un mundo terminado antes de borrarlo |
| `ATALAYA_ALERT_RULES` | — | Reglas de alerta en JSON, para la versión sin servidor (ver arriba) |
| `ATALAYA_HISTORY_DAYS` | `21` | Historial que se envía al navegador |
| `ATALAYA_CORS_ORIGINS` | `*` | Si sirves la web desde otro dominio |

Para usar la web con una API en otro dominio, define `window.ATALAYA_API = "https://api.tudominio/api"` antes del script.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/health` | Estado |
| GET | `/api/servers?status=active` | Mundos con resumen, eventos del día y evolución reciente (`trend`: jugadores, aldeas, alianzas, población, conquistas, destrucciones y fundaciones por instantánea) |
| GET | `/api/servers/{id}/world` | Jugadores, alianzas y aldeas con historial y métricas, en arrays compactos (ver `schema`) |
| GET | `/api/servers/{id}/events?days=14` | Eventos |
| GET | `/api/servers/{id}/players/{uid}/villages` | Historial por aldea |
| GET / POST / DELETE | `/api/alerts` | Reglas de alerta. Solo se aceptan webhooks de `discord.com`, para evitar SSRF |
| POST | `/api/alerts/test` | Envía un mensaje de prueba |

## Escalado

Un mundo grande tiene unas 20–60 mil aldeas. Con unos 100 mundos activos salen 2–6 millones de filas al día. SQLite en modo WAL con retención de 45 días aguanta un VPS pequeño. Si crece:
1. Postgres, con `villages` particionada por día, o ClickHouse para el historial.
2. Pasar la exportación de `/world` a un JSON precalculado por mundo después de cada ingesta, servido por un CDN.
3. Workers de ingesta por región.

## Normas del juego y privacidad

- Atalaya **solo** usa el `map.sql` público y lo que el usuario escribe. **No** inicia sesión por nadie, **no** automatiza acciones del juego y **no** incluye extensión de navegador, porque Travian prohíbe las herramientas que interactúan con el juego. Revisa las reglas vigentes de Travian antes de publicar el servicio.
- Muestra siempre el aviso “herramienta no oficial” y no uses marcas ni logotipos de Travian Games.
- RGPD: los nombres de jugador son seudónimos públicos del juego, pero en la UE siguen siendo datos personales. Publica una política de privacidad, limita la retención (`ATALAYA_VILLAGE_RETENTION_DAYS`) y atiende las solicitudes de borrado. Los webhooks de Discord se guardan en el servidor: protégelos. Con las cuentas opcionales, la política de privacidad de la web (`#privacy`) cubre los correos y los datos sincronizados; ver *Cuentas y sincronización*.
- Verificado contra los mundos reales (noviembre de 2026): `status.travian.com`, el calendario del lobby y `/api/v1/info` responden sin sesión; `map.sql` tiene 16 columnas y aparecen los `tid` 6, 7 y 8. Sin verificar: el porcentaje de la plaza de torneos.

## Próximos pasos sugeridos

Del estudio de herramientas existentes (Kirilloid, GetterTools, Travco, TraviTools, TravGuild, Siegewise), lo que más valor añadiría y aún falta:

- **Tabla de llamada de defensa**: página por aldea atacada donde cada defensor ve si llega a tiempo y apunta lo enviado.
- **Simulador de combate** con las fórmulas de Kirilloid (el juego ya trae uno en la plaza de reuniones, por eso no es lo primero).
- **Regiones y puntos de victoria** en mundos anuales: `map.sql` ya trae región, ciudad, puerto y puntos, y la ingesta los guarda.
- **Contraataque / «salvar tropas»**: cuándo vuelven a casa las tropas del atacante, y qué inactivo queda a la distancia justa para tener las tuyas fuera N horas.
- Costes y tiempos de edificios, herrería frente a entrenar y orden óptimo de campos (solo datos estáticos).

Ya apuntados antes:


- Página pública por jugador y alianza enlazable (SEO) y API pública con clave.
- Bot de Discord con comandos (`/inactivos 12|-30 radio:20`).
- Detección de conquistas coordinadas y de “olas” de chiefeo por alianza.
- Mapa de calor de frentes de guerra y predicción de la próxima conquista.
- Notificaciones push (PWA).

## Estructura

```
backend/atalaya/   config · mapsql · discovery · collector · ingest · analytics · geo · alerts · api · cli · synthetic · publish
backend/tests/     pytest
web/src/           styles.css · i18n.js · core.js · gamedata.js · worlds.js · intel.js · terrain.js · ops.js · farmbuild.js · ui.js · charts.js · map.js · views-main.js · views-servers.js · views-more.js · views-intel.js · views-plan.js · views-ops.js · sync.js · app.js
web/tests/         node --test (intel.js con datos reales de Asia 9; tropas, terreno, mapa y lista de vacas del juego con datos de International 7; estadísticas de worlds.js; fusión y sincronización de sync.js)
web/build.py       empaqueta en un único HTML (web/dist/index.html, demo.html con datos incrustados, o --static para GitHub Pages)
.github/workflows/ recolección cada hora y publicación en GitHub Pages
supabase/          schema.sql: tabla, políticas y funciones de las cuentas opcionales
scripts/           capturas y comprobación con Playwright
```
