var profileButton = document.querySelector('.profile-button');
var profilePanel = document.querySelector('.profile-panel');
var profileClose = document.querySelector('.panel-close');
var profileCoordinates = document.getElementById('profile-coordinates');

var profileName = document.getElementById('profile-name');
var profileEmail = document.getElementById('profile-email');

var editButton = document.querySelector('.profile-action-button');
var editPanel = document.querySelector('.profile-edit-panel');
var editClose = document.querySelector('.profile-edit-close');
var editCancel = document.querySelector('.profile-edit-cancel');
var editSave = document.querySelector('.profile-edit-save');

var inputName = document.getElementById('edit-name');
var inputEmail = document.getElementById('edit-email');
var inputCurrentPassword = document.getElementById('current-password');
var inputNewPassword = document.getElementById('new-password');
var inputConfirmPassword = document.getElementById('confirm-password');

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

        // Stäng redigeringspanelen också
        if (editPanel) {
            editPanel.classList.remove('open');
            editPanel.setAttribute('aria-hidden', 'true');
        }
    });
}

// Öppnar redigera-profilpanelen
if (editButton) {
    editButton.addEventListener('click', function () {
        if (!editPanel) return;

        // Fyll i nuvarande namn och email
        if (profileName && inputName) inputName.value = profileName.textContent.trim();
        if (profileEmail && inputEmail) inputEmail.value = profileEmail.textContent.trim();
        if (inputCurrentPassword) inputCurrentPassword.value = '';
        if (inputNewPassword) inputNewPassword.value = '';
        if (inputConfirmPassword) inputConfirmPassword.value = '';

        editPanel.classList.add('open');
        editPanel.setAttribute('aria-hidden', 'false');
    });
}

// Stänger redigeringspanelen
if (editClose) editClose.addEventListener('click', function () {
    if (!editPanel) return;
    editPanel.classList.remove('open');
    editPanel.setAttribute('aria-hidden', 'true');
});

if (editCancel) editCancel.addEventListener('click', function () {
    if (!editPanel) return;
    editPanel.classList.remove('open');
    editPanel.setAttribute('aria-hidden', 'true');
});

// Sparar ändringar i profilen
if (editSave) editSave.addEventListener('click', function () {
    if (!profileName || !profileEmail || !inputName || !inputEmail) return;

    // Kolla om nya lösenord matchar
    if (inputNewPassword.value && inputNewPassword.value !== inputConfirmPassword.value) {
        alert('De nya lösenorden matchar inte. Kontrollera och försök igen.');
        return;
    }

    profileName.textContent = inputName.value || 'Du';
    profileEmail.textContent = inputEmail.value || 'du@exempel.se';

    // Stäng redigeringspanelen efter sparning
    if (editPanel) {
        editPanel.classList.remove('open');
        editPanel.setAttribute('aria-hidden', 'true');
    }
});

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