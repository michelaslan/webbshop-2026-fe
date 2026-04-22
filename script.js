var currentAddress = "";
var map = L.map('map').setView([59.3293, 18.0686], 14);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

// Skapa en flyttbar marker
var marker = L.marker([59.3293, 18.0686], {
    draggable: true
}).addTo(map);

// Funktion som hämtar adress från koordinater
async function getAddress(lat, lon) {
    var url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`;

    try {
        var response = await fetch(url, {
            headers: {
                "Accept-Language": "sv"
            }
        });

        if (!response.ok) {
            throw new Error("Kunde inte hämta adress");
        }

        var data = await response.json();

        if (data && data.address) {
            const road = data.address.road || "";
            const houseNumber = data.address.house_number || "";
            const city =
                data.address.city ||
                data.address.town ||
                data.address.village ||
                "";

            const shortAddress = `${road} ${houseNumber}, ${city}`.trim();
            return shortAddress || data.display_name || "Ingen adress hittades";
        }

        return "Ingen adress hittades";
    } catch (error) {
        console.error(error);
        return "Kunde inte hämta adress";
    }
}

// Funktion som flyttar markern och visar popup med adress
async function updateMarkerAndPopup(latlng) {
    marker.setLatLng(latlng);
    currentAddress = await getAddress(latlng.lat, latlng.lng);
    marker.bindPopup("<b>Adress:</b><br>" + currentAddress).openPopup();
}

// Klick på kartan flyttar markern och visar adress
map.on('click', function (e) {
    updateMarkerAndPopup(e.latlng);
});

// När man drar klart markern visas adressen
marker.on('dragend', function (e) {
    var latlng = e.target.getLatLng();
    updateMarkerAndPopup(latlng);
});

// Visa popup direkt när sidan laddas
updateMarkerAndPopup(marker.getLatLng());

// Store plant markers in a layer group so we can clear them easily
const plantMarkersGroup = L.featureGroup().addTo(map);

// Load all plants on page load
async function loadAllPlants() {
  const token = localStorage.getItem('token');
  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

  try {
    const res = await fetch("/plants", { headers });
    const plants = await res.json();
    renderPlantMarkers(plants);
  } catch (error) {
    console.error("Error loading plants:", error);
  }
}

// Function to render plant markers on the map
function renderPlantMarkers(plants) {
  // Clear existing plant markers
  plantMarkersGroup.clearLayers();

  // Create markers for each plant
  plants.forEach(plant => {
    // Check if plant has location data
    if (plant.latitude && plant.longitude) {
      const plantMarker = L.marker([plant.latitude, plant.longitude], {
        draggable: false
      }).addTo(plantMarkersGroup);

      // Create popup content with plant info
      const popupContent = `
        <div class="plant-popup">
          <strong>${plant.name || 'Unnamed Plant'}</strong><br>
          <small>Ljusnivå: ${plant.lightLevel ? getLightLevelName(plant.lightLevel) : 'Okänd'}</small>
        </div>
      `;

      plantMarker.bindPopup(popupContent);
    }
  });
}

// Helper function to convert light level number to Swedish text
function getLightLevelName(level) {
  const levels = {
    1: "Lågt ljus",
    2: "Normalt ljus",
    3: "Starkt ljus"
  };
  return levels[level] || "Okänd";
}

// Load all plants when page loads
document.addEventListener("DOMContentLoaded", loadAllPlants);

// Listens for filtered plants from filter.js
// When the filter is applied, this will update the map markers
window.addEventListener("plantsFiltered", (e) => {
  const plants = e.detail;
  console.log("Filtered plants received:", plants);
  renderPlantMarkers(plants);
});