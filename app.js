const map = L.map('map').setView([51.505, -0.09], 13);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

function getIconForZoom(zoom) {
  const size = Math.max(16, Math.min(38, zoom * 2.2));
  return L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [size, size * 1.64],
    iconAnchor: [size / 2, size * 1.64],
    popupAnchor: [0, -(size * 1.64)]
  });
}

const marker = L.marker([51.5, -0.09], {
  draggable: true,
  icon: getIconForZoom(map.getZoom())
}).addTo(map);

map.on('zoomend', () => {
  marker.setIcon(getIconForZoom(map.getZoom()));
});

async function fetchAddress(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  const a = data.address || {};
  const parts = [
    [a.house_number, a.road || a.pedestrian || a.path].filter(Boolean).join(' '),
    a.city || a.town || a.village || a.suburb,
    a.country
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

async function updateMarkerPopup(latlng) {
  marker.setLatLng(latlng);
  marker.bindPopup('Loading...').openPopup();
  const address = await fetchAddress(latlng.lat, latlng.lng);
  marker.bindPopup(address).openPopup();
}

// Show address on drag end
marker.on('dragend', () => {
  updateMarkerPopup(marker.getLatLng());
});

// Click on map to move marker and show address
map.on('click', (e) => {
  updateMarkerPopup(e.latlng);
});

// Show address for initial marker position
updateMarkerPopup(marker.getLatLng());
