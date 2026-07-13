> Este documento es la fuente principal de contexto funcional de CasaTicket. Las implementaciones deben respetarlo salvo modificacion explicita posterior.

# Product Context

CasaTicket es un marketplace movil para servicios, reparaciones y tareas del hogar. Conecta personas que necesitan resolver un problema en su casa con trabajadores y profesionales independientes que ofrecen uno o varios servicios.

## Actores

### Usuario

Persona que necesita ayuda para una tarea, arreglo o servicio en su hogar.

Capacidades previstas:

- publicar solicitudes;
- describir problemas;
- adjuntar fotos o videos;
- indicar ubicacion y disponibilidad;
- recibir postulaciones;
- comparar profesionales y propuestas;
- seleccionar a quien contratar;
- coordinar;
- aceptar presupuestos;
- confirmar trabajos;
- calificar;
- abrir reclamos.

### Profesional independiente

Trabajador que ofrece servicios de forma autonoma.

Capacidades previstas:

- crear perfil profesional;
- cargar experiencia;
- seleccionar rubros;
- definir radio de trabajo;
- definir disponibilidad;
- ver oportunidades;
- postularse;
- enviar propuestas;
- presupuestar;
- coordinar;
- ejecutar trabajos;
- cargar evidencia;
- recibir calificaciones.

### CasaTicket

CasaTicket no ejecuta los trabajos ni emplea inicialmente a los profesionales. Aporta el ecosistema para:

- solicitudes;
- perfiles;
- validacion;
- coincidencia futura;
- postulaciones;
- presupuestos;
- mensajeria futura;
- reputacion;
- trazabilidad;
- moderacion;
- reclamos;
- pagos futuros.

## Propuesta de valor

Para usuarios:

- encontrar profesionales de forma mas ordenada y trazable;
- comparar opciones antes de decidir;
- tener mas contexto sobre experiencia, rubros y disponibilidad.

Para profesionales:

- acceder a oportunidades relevantes;
- mantener autonomia comercial;
- definir radio y disponibilidad propios;
- construir reputacion dentro del ecosistema.

## Funcionamiento general

El flujo esperado es:

1. un usuario crea su perfil;
2. publica una necesidad del hogar;
3. profesionales compatibles reciben o encuentran la oportunidad;
4. se postulan o envian propuesta;
5. el usuario compara, selecciona y coordina;
6. se emite presupuesto;
7. el trabajo se ejecuta;
8. el usuario confirma y califica.

Ese flujo completo todavia no se implementa en esta fase.

## Cobertura geografica

La cobertura inicial sera:

- Ciudad Autonoma de Buenos Aires;
- Gran Buenos Aires;
- localidades dentro de un radio maximo de 100 km desde la Ciudad de Buenos Aires.

No se usaran zonas fijas como A, B o C. Cada profesional podra definir su propio radio de trabajo hasta 100 km.

La arquitectura queda preparada para evolucionar con:

- geocodificacion;
- coordenadas;
- calculo de distancia;
- PostGIS;
- Google Maps, Mapbox u OpenStreetMap.

## Categorias iniciales

Las categorias iniciales son configurables y persisten en base de datos:

1. Plomeria
2. Electricidad
3. Pintura
4. Albanileria y terminaciones
5. Cerrajeria
6. Persianas y mosquiteros
7. Carpinteria
8. Mantenimiento general y colocaciones

## Postulaciones, seleccion y presupuestos

CasaTicket debe permitir que los profesionales conserven autonomia para:

- aceptar o rechazar oportunidades;
- proponer precios;
- manejar su disponibilidad;
- elegir su radio de trabajo;
- operar tambien fuera de la plataforma.

El sistema debe facilitar postulaciones, comparacion y seleccion, pero sin convertir a los profesionales en empleados del ecosistema.

## Reputacion y reclamos

La plataforma incorporara reputacion, trazabilidad, moderacion y reclamos. En la fundacion actual solo se deja preparada la estructura tecnica y documental.

## Evolucion futura

Fases posteriores podran agregar:

- matching;
- chat;
- pagos protegidos;
- geolocalizacion real;
- reputacion avanzada;
- reclamos complejos;
- automatizaciones operativas.

