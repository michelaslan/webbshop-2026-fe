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