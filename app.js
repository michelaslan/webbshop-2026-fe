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

const profileButton = document.querySelector('.icon-button');
const profilePanel = document.getElementById('profilePanel');
const closePanel = document.getElementById('closePanel');
const profileLocation = document.getElementById('profileLocation');
const panelEditButton = document.querySelector('.panel-edit');
const panelView = document.querySelector('.panel-view');
const profileEditForm = document.getElementById('profileEditForm');
const panelAddButton = document.querySelector('.panel-add');
const panelAddForm = document.getElementById('addPlantForm');
const plantNameInput = document.getElementById('plantName');
const plantKindInput = document.getElementById('plantKind');
const plantImageUpload = document.getElementById('plantImageUpload');
const imagePreview = document.getElementById('imagePreview');
const previewImage = imagePreview.querySelector('img');
const imageRemoveButton = imagePreview.querySelector('.image-remove');
const plantFormWarning = document.getElementById('plantFormWarning');
const profileLabel = document.getElementById('panelLabel');
const profileNameInput = document.getElementById('profileName');
const profileEmailInput = document.getElementById('profileEmail');
const profileNameDisplay = document.querySelector('.panel-name');
const panelCancelButton = document.querySelector('.panel-cancel');
const panelCancelAddButton = document.querySelector('.panel-cancel-add');
const plantList = document.getElementById('plantList');
const panelEmptyState = document.getElementById('panelEmptyState');

let selectedPlantImage = '';

function updateProfileLocation(latlng) {
  profileLocation.textContent = `${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}`;
}

function openProfilePanel() {
  profilePanel.classList.remove('hidden');
  profilePanel.setAttribute('aria-hidden', 'false');
}

function closeProfilePanel() {
  profilePanel.classList.add('hidden');
  profilePanel.setAttribute('aria-hidden', 'true');
  exitEditMode();
  exitAddMode();
}

function enterEditMode() {
  panelView.classList.add('hidden');
  profileEditForm.classList.remove('hidden');
  panelAddForm.classList.add('hidden');
  panelEditButton.classList.add('hidden');
  panelAddButton.classList.add('hidden');
  profileLabel.textContent = 'Redigera profil';
}

function exitEditMode() {
  panelView.classList.remove('hidden');
  profileEditForm.classList.add('hidden');
  panelEditButton.classList.remove('hidden');
  panelAddButton.classList.remove('hidden');
  profileLabel.textContent = 'Min profil';
}

function enterAddMode() {
  panelView.classList.add('hidden');
  profileEditForm.classList.add('hidden');
  panelAddForm.classList.remove('hidden');
  panelEditButton.classList.add('hidden');
  panelAddButton.classList.add('hidden');
  profileLabel.textContent = 'Lägg till växt';
}

function exitAddMode() {
  panelView.classList.remove('hidden');
  panelAddForm.classList.add('hidden');
  panelEditButton.classList.remove('hidden');
  profileLabel.textContent = 'Min profil';
  resetAddPlantForm();
}

function resetAddPlantForm() {
  plantNameInput.value = '';
  plantKindInput.value = '';
  plantImageUpload.value = '';
  selectedPlantImage = '';
  previewImage.src = '';
  imagePreview.classList.add('hidden');
  plantFormWarning.classList.add('hidden');
}

function renderPlantItem(name, kind, imageSrc) {
  const plantItem = document.createElement('div');
  plantItem.className = 'plant-item';

  const img = document.createElement('img');
  img.src = imageSrc || 'https://images.unsplash.com/photo-1523413651479-597eb2da0ad6?auto=format&fit=crop&w=500&q=60';
  img.alt = name;

  const info = document.createElement('div');
  info.className = 'plant-item-info';

  const title = document.createElement('p');
  title.className = 'plant-item-title';
  title.textContent = name;

  const kindText = document.createElement('p');
  kindText.className = 'plant-item-kind';
  kindText.textContent = kind;

  const removeButton = document.createElement('button');
  removeButton.type = 'button';
  removeButton.className = 'plant-remove';
  removeButton.textContent = 'Ta bort';
  removeButton.addEventListener('click', () => {
    plantItem.remove();
    updatePlantSection();
  });

  info.append(title, kindText);
  plantItem.append(img, info, removeButton);
  plantList.appendChild(plantItem);
}

function updatePlantSection() {
  if (plantList.children.length > 0) {
    panelEmptyState.classList.add('hidden');
    plantList.classList.remove('hidden');
  } else {
    panelEmptyState.classList.remove('hidden');
    plantList.classList.add('hidden');
  }
}

profileButton.addEventListener('click', openProfilePanel);
closePanel.addEventListener('click', closeProfilePanel);
panelEditButton.addEventListener('click', enterEditMode);
panelCancelButton.addEventListener('click', exitEditMode);
panelAddButton.addEventListener('click', enterAddMode);
panelCancelAddButton.addEventListener('click', exitAddMode);

imageRemoveButton.addEventListener('click', () => {
  selectedPlantImage = '';
  plantImageUpload.value = '';
  previewImage.src = '';
  imagePreview.classList.add('hidden');
});

plantImageUpload.addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  selectedPlantImage = objectUrl;
  previewImage.src = objectUrl;
  imagePreview.classList.remove('hidden');
  plantFormWarning.classList.add('hidden');
});

[plantNameInput, plantKindInput].forEach((input) => {
  input.addEventListener('input', () => plantFormWarning.classList.add('hidden'));
});

profileEditForm.addEventListener('submit', (event) => {
  event.preventDefault();
  profileNameDisplay.textContent = profileNameInput.value || 'Du';
  exitEditMode();
});

panelAddForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = plantNameInput.value.trim();
  const kind = plantKindInput.value.trim();

  if (!name || !kind || !selectedPlantImage) {
    plantFormWarning.textContent = 'Vänligen fyll i namn, sort och välj en bild innan du lägger till växt.';
    plantFormWarning.classList.remove('hidden');
    return;
  }

  renderPlantItem(name, kind, selectedPlantImage);
  updatePlantSection();
  exitAddMode();
  openProfilePanel();
});

updateProfileLocation(marker.getLatLng());
marker.on('dragend', () => updateProfileLocation(marker.getLatLng()));
marker.on('moveend', () => updateProfileLocation(marker.getLatLng()));

updatePlantSection();
