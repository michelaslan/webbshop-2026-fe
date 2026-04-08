var profileButton = document.querySelector('.profile-button');
var profilePanel = document.querySelector('.profile-panel');
var profileClose = document.querySelector('.panel-close');
var profileCoordinates = document.getElementById('profile-coordinates');

// Öppnar panelen
if (profileButton) {
    profileButton.addEventListener('click', function () {
        if (!profilePanel) return;

        profilePanel.classList.add('open');
        profilePanel.setAttribute('aria-hidden', 'false');

        // Visa koordinater baserad på markörens position när man öppnar panelen
        if (window.marker && profileCoordinates) {
            var pos = marker.getLatLng();
            profileCoordinates.textContent =
                pos.lat.toFixed(4) + ', ' + pos.lng.toFixed(4);
        }
    });
}

// Stänger panelen när man klickar på stängknappen
if (profileClose) {
    profileClose.addEventListener('click', function () {
        if (!profilePanel) return;

        profilePanel.classList.remove('open');
        profilePanel.setAttribute('aria-hidden', 'true');
    });
}

// Uppdaterar koordinater när markören dras
if (window.marker && profileCoordinates) {
    marker.on('dragend', function (e) {
        var pos = e.target.getLatLng();
        profileCoordinates.textContent =
            pos.lat.toFixed(4) + ', ' + pos.lng.toFixed(4);
    });
}

// Uppdaterar koordinater när man klickar på kartan
if (window.map && profileCoordinates) {
    map.on('click', function (e) {
        var pos = e.latlng;
        profileCoordinates.textContent =
            pos.lat.toFixed(4) + ', ' + pos.lng.toFixed(4);
    });
}