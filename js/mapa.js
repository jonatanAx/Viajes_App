// Asegúrate de usar nombres diferentes para no confundir a la librería
const SB_URL = 'https://llpofkbyacuivbkfxfpq.supabase.co'; 
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxscG9ma2J5YWN1aXZia2Z4ZnBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MzI2MjgsImV4cCI6MjA5MjMwODYyOH0.ScPCtYjV2J_QSJtlLHQHY1JqRSYuDRFxm1krLeNOukc'; 

const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

// 1. Inicializar el mapa
var map = L.map('map').setView([13.4833, -88.1833], 13);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
}).addTo(map);

// Fuerza al mapa a dibujarse bien apenas cargue la página
window.onload = function() {
    setTimeout(function(){ 
        map.invalidateSize(); 
    }, 500);
};

var markerOrigen, markerDestino, motoMarker;
var paso = 1; 

// Iconos personalizados
var redIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

var iconoCarrito = L.divIcon({
    html: '<img src="https://cdn-icons-png.flaticon.com/512/3082/3082103.png" style="width: 35px; height: 35px;">',
    className: 'carrito-original',
    iconSize: [35, 35],
    iconAnchor: [17, 17]
});

// 2. Lógica de clics para direcciones
map.on('click', async function (e) {
    var lat = e.latlng.lat.toFixed(5);
    var lng = e.latlng.lng.toFixed(5);
    
    if (paso === 1) {
        document.getElementById('origen').value = "Buscando dirección...";
        if (markerOrigen) map.removeLayer(markerOrigen);
        markerOrigen = L.marker([lat, lng]).addTo(map).bindPopup("Recogida").openPopup();
        const direccion = await obtenerDireccion(lat, lng);
        document.getElementById('origen').value = direccion;
        paso = 2;
    } else {
        document.getElementById('destino').value = "Buscando dirección...";
        if (markerDestino) map.removeLayer(markerDestino);
        markerDestino = L.marker([lat, lng], {icon: redIcon}).addTo(map).bindPopup("Destino").openPopup();
        const direccion = await obtenerDireccion(lat, lng);
        document.getElementById('destino').value = direccion;
        paso = 1;
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

// 3. Función de Animación (CORREGIDA PARA QUE SE MUEVA)
function animarTrayectoria(inicio, fin, esDestino = false) {
    if (motoMarker) map.removeLayer(motoMarker);
    
    // Aseguramos que inicio sea un array [lat, lng]
    var startCoords = Array.isArray(inicio) ? inicio : [inicio.lat, inicio.lng];
    var endCoords = Array.isArray(fin) ? fin : [fin.lat, fin.lng];

    motoMarker = L.marker(startCoords, {icon: iconoCarrito}).addTo(map);
    
    var pasos = 100; 
    var i = 0;

    var intervalo = setInterval(function() {
        i++;
        var lat = startCoords[0] + (endCoords[0] - startCoords[0]) * (i / pasos);
        var lng = startCoords[1] + (endCoords[1] - startCoords[1]) * (i / pasos);
        
        motoMarker.setLatLng([lat, lng]);
        map.panTo([lat, lng]); 

        if (i >= pasos) {
            clearInterval(intervalo);
            if (!esDestino) {
                alert("¡Jonatan ha llegado al punto de recogida!");
                // Extraer coordenadas para la siguiente fase
                const proximoDestino = [markerDestino.getLatLng().lat, markerDestino.getLatLng().lng];
                animarTrayectoria(endCoords, proximoDestino, true);
            } else {
                alert("¡Llegamos al destino!");
            }
        }
    }, 40); 
}

// 4. Manejo del Formulario (CORREGIDO PARA ENVIAR COORDENADAS BIEN)
document.getElementById('viajeForm').addEventListener('submit', async function(event) {
    event.preventDefault();

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
        alert(`¡Confirmado ${nombre}! El motorista va en camino.`);
        
        // Coordenadas de inicio (ej. tu ubicación actual)
        const misCoordsActuales = [13.4812, -88.1775]; 
        // Coordenadas de recogida sacadas del marcador
        const coordsRecogida = [markerOrigen.getLatLng().lat, markerOrigen.getLatLng().lng];
        
        animarTrayectoria(misCoordsActuales, coordsRecogida);
    }
});