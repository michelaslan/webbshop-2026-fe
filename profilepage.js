var profileButton = document.querySelector('.profile-button');
var profilePanel = document.querySelector('.profile-panel');
var profileClose = document.querySelector('.panel-close');
var profileCoordinates = document.getElementById('profile-coordinates');

var requestsButton = document.getElementById('requestsBtn');
var requestsPanel = document.querySelector('.requests-panel');
var requestsClose = document.querySelector('.requests-close');

var profileName = document.getElementById('profile-name');
var profileEmail = document.getElementById('profile-email');
var logoutButton = document.getElementById('logoutBtn');

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

function getAuthToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token') || '';
}

function getStoredUser() {
    try {
        var localUser = JSON.parse(localStorage.getItem('user') || 'null');
        if (localUser) return localUser;

        var sessionUser = JSON.parse(sessionStorage.getItem('user') || 'null');
        if (sessionUser) {
            localStorage.setItem('user', JSON.stringify(sessionUser));
            return sessionUser;
        }

        return null;
    } catch (error) {
        return null;
    }
}

async function verifyCurrentPassword(email, password) {
    var normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) return false;

    try {
        var response = await fetch('https://webbshop-2026-be-g08.vercel.app/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: normalizedEmail, password: password }),
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

async function updateProfileInDatabase(params) {
    var token = getAuthToken();
    if (!token) {
        return { ok: false, message: 'Du måste vara inloggad för att uppdatera profilen.' };
    }

    var payload = {
        name: params.name,
        email: params.email,
    };

    if (params.wantsPasswordChange) {
        payload.currentPassword = params.currentPassword;
        payload.oldPassword = params.currentPassword;
        payload.newPassword = params.newPassword;
        payload.password = params.newPassword;
    }

    try {
        var response = await fetch('https://webbshop-2026-be-g08.vercel.app/auth/me', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: 'Bearer ' + token,
            },
            body: JSON.stringify(payload),
        });

        var data = null;
        try {
            data = await response.json();
        } catch (error) {
            data = null;
        }

        if (!response.ok) {
            var message = (data && (data.error || data.message)) || 'Kunde inte uppdatera profil i databasen.';
            return { ok: false, message: message };
        }

        var userFromResponse =
            (data && data.user) ||
            (data && data.data && data.data.user) ||
            (data && data._id ? data : null);

        return {
            ok: true,
            user: userFromResponse,
        };
    } catch (error) {
        return { ok: false, message: 'Nätverksfel vid uppdatering av profilen.' };
    }
}

function closeRequestsPanel() {
    if (!requestsPanel) return;

    requestsPanel.classList.remove('open');
    requestsPanel.setAttribute('aria-hidden', 'true');
}

function closeProfilePanel() {
    if (!profilePanel) return;

    profilePanel.classList.remove('open');
    profilePanel.setAttribute('aria-hidden', 'true');
    profilePanel.classList.remove('is-editing-profile');

    if (editPanel) {
        editPanel.classList.remove('open');
        editPanel.setAttribute('aria-hidden', 'true');
    }
}

function setEditPanelOpen(isOpen) {
    if (!editPanel) return;

    editPanel.classList.toggle('open', isOpen);
    editPanel.setAttribute('aria-hidden', isOpen ? 'false' : 'true');

    if (profilePanel) {
        profilePanel.classList.toggle('is-editing-profile', isOpen);
    }
}

function openLoginModal() {
    var loginModal = document.getElementById('login-modal');
    if (loginModal) {
        loginModal.style.display = 'flex';
    }
}

function updateAuthButton() {
    if (!logoutButton) return;

    var token = getAuthToken();
    var isLoggedIn = Boolean(token);

    logoutButton.textContent = isLoggedIn ? 'Logga ut' : 'Logga in';
    logoutButton.classList.toggle('is-logout', isLoggedIn);
    logoutButton.classList.toggle('is-login', !isLoggedIn);
}

function logoutUser() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    if (profileName) profileName.textContent = 'Du';
    if (profileEmail) profileEmail.textContent = 'du@exempel.se';

    closeProfilePanel();
    updateAuthButton();
    window.dispatchEvent(new Event('auth-changed'));

    openLoginModal();
}

const storedUser = getStoredUser();
if (storedUser) {
    if (profileName && storedUser.name) profileName.textContent = storedUser.name;
    if (profileEmail && storedUser.email) profileEmail.textContent = storedUser.email;
}

function refreshProfileDisplay() {
    updateAuthButton();
    var currentUser = getStoredUser();
    if (profileName) profileName.textContent = (currentUser && currentUser.name) ? currentUser.name : 'Du';
    if (profileEmail) profileEmail.textContent = (currentUser && currentUser.email) ? currentUser.email : 'du@exempel.se';
}

updateAuthButton();
window.addEventListener('auth-changed', refreshProfileDisplay);
refreshProfileDisplay();


// Öppnar panelen
if (profileButton) {
    profileButton.addEventListener('click', function () {
        if (!profilePanel) return;

        closeRequestsPanel();

        profilePanel.classList.add('open');
        profilePanel.setAttribute('aria-hidden', 'false');

        if (window.marker && profileCoordinates) {
            var pos = marker.getLatLng();
            profileCoordinates.textContent =
                pos.lat.toFixed(4) + ', ' + pos.lng.toFixed(4);
        }
    });
}

if (profileClose) {
    profileClose.addEventListener('click', function () {
        closeProfilePanel();
    });
}

if (requestsButton) {
    requestsButton.addEventListener('click', function () {
        if (!requestsPanel) return;

        closeProfilePanel();
        requestsPanel.classList.add('open');
        requestsPanel.setAttribute('aria-hidden', 'false');
    });
}

if (requestsClose) {
    requestsClose.addEventListener('click', function () {
        closeRequestsPanel();
    });
}

if (logoutButton) {
    logoutButton.addEventListener('click', function () {
        if (localStorage.getItem('token')) {
            logoutUser();
            return;
        }

        openLoginModal();
    });
}

if (editButton) {
    editButton.addEventListener('click', function () {
        if (!editPanel) return;

        var storedEditUser = getStoredUser();
        if (inputName) inputName.value = (storedEditUser && storedEditUser.name) ? storedEditUser.name : (profileName ? profileName.textContent.trim() : '');
        if (inputEmail) inputEmail.value = (storedEditUser && storedEditUser.email) ? storedEditUser.email : (profileEmail ? profileEmail.textContent.trim() : '');
        if (inputCurrentPassword) inputCurrentPassword.value = '';
        if (inputNewPassword) inputNewPassword.value = '';
        if (inputConfirmPassword) inputConfirmPassword.value = '';

        setEditPanelOpen(true);
    });
}

if (editClose) editClose.addEventListener('click', function () {
    setEditPanelOpen(false);
});

if (editCancel) editCancel.addEventListener('click', function () {
    setEditPanelOpen(false);
});

// Sparar ändringar i profilen
if (editSave) editSave.addEventListener('click', async function () {
    if (!profileName || !profileEmail || !inputName || !inputEmail) return;

    var existingUser = null;
    try {
        existingUser = JSON.parse(localStorage.getItem('user') || 'null');
    } catch (error) {
        existingUser = null;
    }

    var currentEmail = (
        (existingUser && existingUser.email) ||
        (profileEmail && profileEmail.textContent) ||
        ''
    ).trim().toLowerCase();

    var newName = (inputName.value || '').trim();
    var newEmail = (inputEmail.value || '').trim().toLowerCase();
    var currentPassword = (inputCurrentPassword && inputCurrentPassword.value ? inputCurrentPassword.value : '').trim();
    var newPassword = (inputNewPassword && inputNewPassword.value ? inputNewPassword.value : '').trim();
    var confirmPassword = (inputConfirmPassword && inputConfirmPassword.value ? inputConfirmPassword.value : '').trim();

    if (!newEmail) {
        alert('E-post kan inte vara tom.');
        return;
    }

    var wantsPasswordChange = Boolean(currentPassword || newPassword || confirmPassword);

    if (wantsPasswordChange && !currentPassword) {
        alert('Ange nuvarande lösenord för att byta lösenord.');
        return;
    }

    if (wantsPasswordChange && !newPassword) {
        alert('Ange ett nytt lösenord.');
        return;
    }

    // Kolla om nya lösenord matchar
    if (newPassword && newPassword !== confirmPassword) {
        alert('De nya lösenorden matchar inte. Kontrollera och försök igen.');
        return;
    }

    if (wantsPasswordChange) {
        var currentPasswordIsValid = await verifyCurrentPassword(currentEmail || newEmail, currentPassword);
        if (!currentPasswordIsValid) {
            alert('Nuvarande lösenord är felaktigt.');
            return;
        }
    }

    var updateResult = await updateProfileInDatabase({
        name: newName || 'Du',
        email: newEmail,
        currentPassword: currentPassword,
        newPassword: newPassword,
        wantsPasswordChange: wantsPasswordChange,
    });

    if (!updateResult.ok) {
        alert(updateResult.message || 'Kunde inte uppdatera profil.');
        return;
    }

    profileName.textContent = newName || 'Du';
    profileEmail.textContent = newEmail || 'du@exempel.se';

    var responseUser = updateResult.user || {};
    var updatedUser = {
        ...(existingUser || {}),
        ...responseUser,
        name: responseUser.name || newName || 'Du',
        email: (responseUser.email || newEmail || '').trim().toLowerCase(),
    };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    localStorage.removeItem('passwordOverrides');
    window.dispatchEvent(new Event('auth-changed'));

    if (inputCurrentPassword) inputCurrentPassword.value = '';
    if (inputNewPassword) inputNewPassword.value = '';
    if (inputConfirmPassword) inputConfirmPassword.value = '';

    setEditPanelOpen(false);
});

if (window.marker && profileCoordinates) {
    marker.on('dragend', function (e) {
        var pos = e.target.getLatLng();
        profileCoordinates.textContent =
            pos.lat.toFixed(4) + ', ' + pos.lng.toFixed(4);
    });
}

if (window.map && profileCoordinates) {
    map.on('click', function (e) {
        var pos = e.latlng;
        profileCoordinates.textContent =
            pos.lat.toFixed(4) + ', ' + pos.lng.toFixed(4);
    });
}