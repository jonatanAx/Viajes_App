// Configuración de Supabase
const SB_URL = 'https://llpofkbyacuivbkfxfpq.supabase.co'; 
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxscG9ma2J5YWN1aXZia2Z4ZnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzI2MjgsImV4cCI6MjA5MjMwODYyOH0.ScPCtYjV2J_QSJtlLHQHY1JqRSYuDRFxm1krLeNOukc'; 

const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

// 1. Inicializar el mapa del Modal
var map = L.map('map').setView([13.4833, -88.1833], 13);
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO'
}).addTo(map);

var markerOrigen, markerDestino;
var paso = 1; 

// Iconos personalizados
var redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

// Función para setear si es Origen o Destino desde los botones
function setPaso(n) {
    paso = n;
}

// 2. Lógica de clics en el Modal
map.on('click', async function (e) {
    var lat = e.latlng.lat.toFixed(5);
    var lng = e.latlng.lng.toFixed(5);
    
    if (paso === 1) {
        document.getElementById('origen').value = "Buscando...";
        if (markerOrigen) map.removeLayer(markerOrigen);
        markerOrigen = L.marker([lat, lng]).addTo(map).bindPopup("Recogida").openPopup();
        const direccion = await obtenerDireccion(lat, lng);
        document.getElementById('origen').value = direccion;
    } else {
        document.getElementById('destino').value = "Buscando...";
        if (markerDestino) map.removeLayer(markerDestino);
        markerDestino = L.marker([lat, lng], {icon: redIcon}).addTo(map).bindPopup("Destino").openPopup();
        const direccion = await obtenerDireccion(lat, lng);
        document.getElementById('destino').value = direccion;
    }
});

async function obtenerDireccion(lat, lng) {
    try {
        const respuesta = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
        const datos = await respuesta.json();
        return datos.display_name.split(',').slice(0, 3).join(',') || `Lat: ${lat}, Lng: ${lng}`;
    } catch (error) {
        return `Lat: ${lat}, Lng: ${lng}`;
    }
}

// 3. Función para mostrar el mapa de recorrido final
// Variable global para el marcador que se va a mover
var marcadorMovil = null;

async function mostrarRecorrido(lat1, lon1, lat2, lon2, costo) {
    // 1. Mostrar el contenedor primero
    document.getElementById('seccionFormulario').classList.add('d-none');
    const contenedor = document.getElementById('contenedorRecorrido');
    contenedor.classList.remove('d-none');
    document.getElementById('resumenCosto').innerText = costo;

    // 2. Inicializar el mapa (con un pequeño delay para que el DOM se actualice)
    setTimeout(() => {
        const mapRecorrido = L.map('mapaRecorrido').setView([lat1, lon1], 14);
        
        // Forzamos a Leaflet a recalcular el tamaño para que no salga gris/blanco
        mapRecorrido.invalidateSize();

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; CARTO'
        }).addTo(mapRecorrido);

        // 3. Configurar la ruta
        const controlRuta = L.Routing.control({
            waypoints: [
                L.latLng(lat1, lon1),
                L.latLng(lat2, lon2)
            ],
            lineOptions: {
                styles: [{ color: '#3388ff', opacity: 0.7, weight: 6 }]
            },
            addWaypoints: false,
            draggableWaypoints: false,
            createMarker: function(i, wp) {
                return L.marker(wp.latLng, { 
                    icon: i === 0 ? new L.Icon.Default() : redIcon 
                }).bindPopup(i === 0 ? "Origen" : "Destino");
            }
        }).addTo(mapRecorrido);

        // 4. Animación del "dispositivo" siguiendo la calle
        controlRuta.on('routesfound', function(e) {
            const rutaPoints = e.routes[0].coordinates;
            const movil = L.marker([lat1, lon1], { icon: iconoCarrito }).addTo(mapRecorrido);
            
            let index = 0;
            function animar() {
                if (index < rutaPoints.length) {
                    movil.setLatLng(rutaPoints[index]);
                    index++;
                    setTimeout(animar, 40); // Velocidad de movimiento
                }
            }
            animar();
        });
    }, 200); // El delay de 200ms es clave para que el mapa cargue bien
}

// 4. Manejo del Formulario (Guardado + Cambio de Vista)
document.getElementById('viajeForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    if (!markerOrigen || !markerDestino) {
        alert("Por favor selecciona origen y destino en el mapa.");
        return;
    }

    const nombre = document.querySelector('input[placeholder="Ej. Jonatan"]').value;
    const origenTexto = document.getElementById('origen').value;
    const destinoTexto = document.getElementById('destino').value;
    const costoViaje = document.getElementById('costo').value;

    const { error } = await supabaseClient
        .from('viajes')
        .insert([{ 
            cliente_nombre: nombre, 
            ubicacion_recogida: origenTexto, 
            destino: destinoTexto, 
            precio_ofertado: parseFloat(costoViaje) 
        }]);

    if (error) {
        alert("Error al guardar: " + error.message);
    } else {
        // Obtenemos coordenadas para el mapa de recorrido
        const latO = markerOrigen.getLatLng().lat;
        const lonO = markerOrigen.getLatLng().lng;
        const latD = markerDestino.getLatLng().lat;
        const lonD = markerDestino.getLatLng().lng;

        // ¡Mágia! Cambiamos la vista al mapa de recorrido
        mostrarRecorrido(latO, lonO, latD, lonD, costoViaje);
    }
});

// Refrescar mapa del modal al abrirlo
document.getElementById('mapaModal').addEventListener('shown.bs.modal', function () {
    setTimeout(function() {
        map.invalidateSize();
    }, 100);
});
