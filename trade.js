const TRADE_API_BASE = "https://webbshop-2026-be-g08.vercel.app";
const myPosts = document.querySelector("#myPosts");
const LEGACY_SESSION_TOKEN_KEY = "token";
const LEGACY_SESSION_USER_KEY = "user";

let plantMarkers = [];
let plantsCache = [];
let userTradesCache = [];
let allTradesCache = [];
let filteredPlantIds = null;
const knownUserNamesById = new Map();
let authSnapshot = "";

const MAX_PLANT_PAYLOAD_BYTES = 95 * 1024;
const DEFAULT_MAP_POSITION = {
	lat: 59.3293,
	lng: 18.0686,
};
const PENDING_TRADE_STATUSES = ["pending", "posted"];
const DEFAULT_USER_NAME = "Du";
const DEFAULT_REQUEST_MESSAGE = "Hej! Jag är intresserad av din växt.";
const DEFAULT_PLANT_IMAGE_URL = "https://placehold.co/600x400?text=Plant";
const IMGBB_API_KEY = "331073604ea81cda0e079535d9847ea5";

// auth
function getToken() {
	const localToken = localStorage.getItem("token");
	if (localToken && localToken.split(".").length === 3) {
		return localToken;
	}

	const sessionToken = sessionStorage.getItem(LEGACY_SESSION_TOKEN_KEY);
	if (sessionToken && sessionToken.split(".").length === 3) {
		// Keep legacy login scripts compatible with the current trade module.
		localStorage.setItem("token", sessionToken);
		return sessionToken;
	}

	return "";
}

function clearAuthAndPromptLogin(message) {
	localStorage.removeItem("token");
	localStorage.removeItem("user");
	sessionStorage.removeItem(LEGACY_SESSION_TOKEN_KEY);
	sessionStorage.removeItem(LEGACY_SESSION_USER_KEY);
	window.dispatchEvent(new Event("auth-changed"));

	if (message) {
		alert(message);
	}

	const loginModal = document.getElementById("login-modal");
	if (loginModal) {
		loginModal.style.display = "flex";
	}
}

// user 
function normalizeUserData(userData, fallbackUser) {
	const fallback = fallbackUser || {
		id: null,
		name: DEFAULT_USER_NAME,
		email: "",
	};
	const data = userData || {};

	// The backend can name the user id in different ways
	const normalizedId = data._id ?? data.id ?? data.userId ?? fallback.id;
	const normalizedName = data.name ? String(data.name).trim() : fallback.name;
	const normalizedEmail = data.email ?? fallback.email;

	return {
		id: normalizedId,
		name: normalizedName,
		email: String(normalizedEmail).trim().toLowerCase(),
	};
}

function getCurrentUser() {
	try {
		let userData = JSON.parse(localStorage.getItem("user") || sessionStorage.getItem(LEGACY_SESSION_USER_KEY) || "null");
		if (userData && !localStorage.getItem("user")) {
			localStorage.setItem("user", JSON.stringify(userData));
		}
		if (!userData) return null;
		return normalizeUserData(userData);
	} catch (error) {
		return null;
	}
}

function setCurrentUser(userData) {
	const existing = getCurrentUser();
	const updated = normalizeUserData(userData, existing);
	localStorage.setItem("user", JSON.stringify(updated));
	sessionStorage.setItem(LEGACY_SESSION_USER_KEY, JSON.stringify(updated));
}

function rememberUserName(userId, userName) {
	const id = String(userId || "").trim();
	const name = String(userName || "").trim();
	if (!id || !name) return;
	knownUserNamesById.set(id, name);
}

function getKnownUserName(userId) {
	return String(knownUserNamesById.get(String(userId || "").trim()) || "").trim();
}

function syncKnownUserNameFromCurrentUser() {
	const currentUser = getCurrentUser();
	if (!currentUser || !currentUser.id) return;
	rememberUserName(currentUser.id, currentUser.name);
}

function updateKnownUserNamesFromPlants(plants) {
	if (!Array.isArray(plants)) return;
	plants.forEach((plant) => {
		if (!plant) return;
		const ownerId = getPlantOwnerId(plant.owner);
		const ownerName = getPlantOwnerName(plant.owner);
		if (ownerId && ownerName && ownerName !== "Användare") {
			rememberUserName(ownerId, ownerName);
		}
	});
}

function updateKnownUserNamesFromTrades(trades) {
	if (!Array.isArray(trades)) return;
	trades.forEach((trade) => {
		if (!trade) return;

		if (trade.requester && trade.requester.name) {
			const requesterId = getIdFromValue(trade.requester);
			const requesterName = String(trade.requester.name || "").trim();
			rememberUserName(requesterId, requesterName);
		}

		if (trade.receiver && trade.receiver.name) {
			const receiverId = getIdFromValue(trade.receiver);
			const receiverName = String(trade.receiver.name || "").trim();
			rememberUserName(receiverId, receiverName);
		}
	});
}

function getAuthSnapshot() {
	const token = getToken();
	const currentUser = getCurrentUser();
	const currentUserId = currentUser && currentUser.id ? String(currentUser.id) : "";
	return `${token ? "1" : "0"}:${currentUserId}`;
}

function hasRealUserName(user) {
	const name = String((user && user.name) || "").trim();
	return Boolean(name && name !== DEFAULT_USER_NAME);
}

async function ensureCurrentUserId() {
	const token = getToken();
	const currentUser = getCurrentUser();

	if (!token) return currentUser;
	// No need to call /auth/me if we already have a user saved
	if (currentUser && currentUser.id && hasRealUserName(currentUser)) return currentUser;

	try {
		const response = await fetch(`${TRADE_API_BASE}/auth/me`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (!response.ok) return currentUser;

		const mePayload = await response.json();
		const meUser = mePayload.user;
		const normalized = normalizeUserData(meUser, currentUser);
		setCurrentUser(normalized);
		return normalized;
	} catch (error) {
		console.error("Failed to fetch /auth/me:", error);
		return currentUser;
	}
}
// utilities
function safeText(value) {
	const safeValue = value === null || value === undefined ? "" : value;

	return String(safeValue)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&#39;");
}

async function readResponseText(response) {
	try {
		return await response.text();
	} catch (error) {
		return "";
	}
}

function handleUnauthorizedResponse(response, message) {
	if (response.status === 401) {
		clearAuthAndPromptLogin(message);
		return true;
	}

	return false;
}

function closeTradePopup() {
	map.closePopup();
}

function isValidObjectId(id) {
	return /^[a-f0-9]{24}$/i.test(String(id || ""));
}

function getPlantId(plant) {
	if (!plant) return "";
	return plant._id || plant.id || "";
}

function getLocationCoordinates(plant) {
	const coords = plant && plant.location && plant.location.coordinates;
	if (!coords) return [];
	if (Array.isArray(coords)) {
		return coords;
	}

	if (coords) {
		const latValue = toNumberOrNull(coords.lat);
		const lngValue = toNumberOrNull(coords.lng);
		if (latValue !== null && lngValue !== null) {
			return [lngValue, latValue];
		}
	}

	return [];
}

function toNumberOrNull(value) {
	const parsedValue = Number(value);
	return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getPlantOwnerId(owner) {
	if (typeof owner === "string") return owner;
	if (!owner) return "";
	return owner._id || owner.id || "";
}

function getPlantOwnerName(owner) {
	if (typeof owner === "string") {
		const knownName = getKnownUserName(owner);
		if (knownName) {
			return knownName;
		}
	}

	if (owner && owner.name) {
		return owner.name;
	}

	if (owner) {
		const ownerId = getPlantOwnerId(owner);
		const knownName = getKnownUserName(ownerId);
		if (knownName) {
			return knownName;
		}
	}

	return "Användare";
}

function getPlantAddress(plant) {
	if (plant && plant.location && plant.location.address && plant.location.address.trim()) {
		return plant.location.address.trim();
	}

	if (plant && plant.address && plant.address.trim()) {
		return plant.address.trim();
	}

	if (plant && plant.display_name && plant.display_name.trim()) {
		return plant.display_name.trim();
	}

	return "Okänd adress";
}

function isPendingStatus(status) {
	return PENDING_TRADE_STATUSES.includes(String(status || ""));
}

function isPlantClosedForRequests(plant) {
	if (!plant || typeof plant !== "object") return false;

	const statusValue = String(plant.status || "").trim().toLowerCase();
	const statusMeansClosed =
		statusValue === "accepted" ||
		statusValue === "godkand" ||
		statusValue === "godkänd" ||
		statusValue === "traded" ||
		statusValue === "closed" ||
		statusValue === "sold" ||
		statusValue === "unavailable";

	return statusMeansClosed || plant.isAvailable === false;
}

function getPlantFromCache(plantId) {
	return plantsCache.find((plant) => plant.id === plantId);
}

function setFilteredPlantIdsFromPlants(plants) {
	if (!Array.isArray(plants)) {
		filteredPlantIds = null;
		return;
	}

	const ids = new Set();
	plants.forEach((plant) => {
		const plantId = getPlantId(plant);
		if (!plantId) return;
		ids.add(String(plantId));
	});

	filteredPlantIds = ids;
}

function getVisiblePlants() {
	if (!filteredPlantIds) return plantsCache;
	return plantsCache.filter((plant) => filteredPlantIds.has(String(plant.id)));
}

function getCurrentUserId() {
	const currentUser = getCurrentUser();
	if (!currentUser || !currentUser.id) {
		return "";
	}

	return String(currentUser.id);
}

// plant data
// turn plant data from the API into one simple object shape
function normalizePlant(plant) {
	const plantId = getPlantId(plant);
	const ownerId = getPlantOwnerId(plant.owner);
	const ownerNameFromTrade = getKnownUserName(ownerId);
	const locationCoordinates = getLocationCoordinates(plant);
	const lngFromPlant = toNumberOrNull(plant && plant.lng);
	const latFromPlant = toNumberOrNull(plant && plant.lat);
	const lngFromLocation = toNumberOrNull(locationCoordinates[0]);
	const latFromLocation = toNumberOrNull(locationCoordinates[1]);

	let lng = DEFAULT_MAP_POSITION.lng;
	if (lngFromPlant !== null) {
		lng = lngFromPlant;
	} else if (lngFromLocation !== null) {
		lng = lngFromLocation;
	}

	let lat = DEFAULT_MAP_POSITION.lat;
	if (latFromPlant !== null) {
		lat = latFromPlant;
	} else if (latFromLocation !== null) {
		lat = latFromLocation;
	}

	return {
		id: plantId,
		owner: ownerId,
		ownerName: ownerNameFromTrade || getPlantOwnerName(plant.owner),
		name: plant.name || "Växt",
		species: plant.species || "",
		description: plant.description || "Ingen beskrivning.",
		imageUrl: plant.imageUrl || "",
		lightLevel: String(plant.lightLevel || "2"),
		status: String(plant.status || "").trim().toLowerCase(),
		address: getPlantAddress(plant),
		lat,
		lng,
		isAvailable: plant.isAvailable !== false,
	};
}

// map
function getSelectedMarkerLatLng() {
	if (window.marker && typeof window.marker.getLatLng === "function") {
		const markerPosition = window.marker.getLatLng();
		if (markerPosition && Number.isFinite(markerPosition.lat) && Number.isFinite(markerPosition.lng)) {
			return {
				lat: markerPosition.lat,
				lng: markerPosition.lng,
			};
		}
	}

	if (window.map && typeof window.map.getCenter === "function") {
		const center = window.map.getCenter();
		return {
			lat: center.lat,
			lng: center.lng,
		};
	}

	return DEFAULT_MAP_POSITION;
}

// api
async function fetchAllPlants() {
	const token = getToken();
	const headers = token
		? {
				Authorization: `Bearer ${token}`,
		  }
		: {};

	const response = await fetch(`${TRADE_API_BASE}/plants`, { headers });
	if (!response.ok) {
		throw new Error(`Failed GET /plants: ${response.status}`);
	}

	const payload = await response.json();
	const plants = Array.isArray(payload)
		? payload
		: Array.isArray(payload && payload.plants)
			? payload.plants
			: [];

	const validPlants = plants.filter((plant) => plant && typeof plant === "object");
	updateKnownUserNamesFromPlants(validPlants);
	return validPlants.map(normalizePlant);
}

async function fetchTradesForUser() {
	const token = getToken();
	if (!token) return [];

	const headers = token
		? {
				Authorization: `Bearer ${token}`,
		  }
		: {};

	const mineResponse = await fetch(`${TRADE_API_BASE}/trades/mine`, { headers });
	if (mineResponse.ok) {
		const mineTrades = await mineResponse.json();
		return Array.isArray(mineTrades) ? mineTrades : [];
	}

	if (handleUnauthorizedResponse(mineResponse, "Din session har gått ut. Logga in igen.")) {
		return [];
	}

	throw new Error(`Failed GET /trades/mine: ${mineResponse.status}`);
}

async function fetchAllTrades() {
	const token = getToken();
	if (!token) return [];

	const headers = {
		Authorization: `Bearer ${token}`,
	};

	const currentUser = getCurrentUser();
	const isAdmin = currentUser?.role === "admin";

	try {
		// ADMIN → alla trades
		if (isAdmin) {
			const res = await fetch(`${TRADE_API_BASE}/trades`, { headers });

			if (!res.ok) return [];

			const data = await res.json();
			return Array.isArray(data) ? data : [];
		}

		// USER → egna trades
		const res = await fetch(`${TRADE_API_BASE}/trades/mine`, { headers });

		if (!res.ok) return [];

		const data = await res.json();
		return Array.isArray(data) ? data : [];
	} catch (err) {
		console.error("fetchAllTrades error:", err);
		return [];
	}
}

function lightLevelLabel(value) {
	if (String(value) === "1") return "Low Light";
	if (String(value) === "2") return "Day Light";
	return "Extreme Light";
}

function getTradeStatusLabel(status) {
	if (isPendingStatus(status)) return "Väntande";
	if (status === "accepted") return "Godkänd";
	if (status === "rejected") return "nekad";
	return "Tillgänglig";
}

function getPlantIdsLockedByAcceptedTrades(allTrades) {
	const acceptedTrades = Array.isArray(allTrades)
		? allTrades.filter((trade) => String(trade && trade.status ? trade.status : "") === "accepted")
		: [];

	const lockedPlantIds = new Set();
	acceptedTrades.forEach((trade) => {
		const requestedPlantId = getIdFromValue(trade && trade.requestedPlant);
		const offeredPlantId = getIdFromValue(trade && trade.offeredPlant);

		if (requestedPlantId) lockedPlantIds.add(String(requestedPlantId));
		if (offeredPlantId) lockedPlantIds.add(String(offeredPlantId));
	});

	return lockedPlantIds;
}

function getPlantTradeStatus(plant, allTrades, currentUserId) {
	const plantId = String(plant.id);
	const userId = String(currentUserId || "");
	const acceptedLockedPlantIds = getPlantIdsLockedByAcceptedTrades(allTrades);
	const matchingTrades = allTrades.filter((trade) => {
		return getIdFromValue(trade.requestedPlant) === String(plant.id);
	});

	// checking in this order so we always return one clear status
	const hasAcceptedTrade = matchingTrades.some((trade) => trade.status === "accepted");
	if (acceptedLockedPlantIds.has(plantId) || hasAcceptedTrade) {
		return "accepted";
	}

	const myPending = matchingTrades.some((trade) => {
		if (!isPendingStatus(trade.status)) return false;
		return getIdFromValue(trade.requester) === userId;
	});

	if (myPending) {
		return "pending";
	}

	const myRejected = matchingTrades.some((trade) => {
		if (String(trade && trade.status ? trade.status : "") !== "rejected") return false;
		return getIdFromValue(trade.requester) === userId;
	});

	if (myRejected) {
		return "rejected";
	}

	if (isPlantClosedForRequests(plant)) {
		return "accepted";
	}

	if (plant.isAvailable) {
		return "available";
	}

	return "available";
}

function createPlantIcon(plant) {
	const image = plant.imageUrl || "public/user_icon.png";
	return L.divIcon({
		className: "trade-map-icon-wrapper",
		html: `<img src="${safeText(image)}" alt="${safeText(plant.name)}" class="divIcon"/>`,
		iconSize: [44, 44],
		iconAnchor: [22, 40],
		popupAnchor: [0, -28],
	});
}

// popup ui
function buildOfferSelectOptions(currentUser) {
	const acceptedLockedPlantIds = getPlantIdsLockedByAcceptedTrades(allTradesCache);
	const myPlants = plantsCache.filter((plant) => {
		const isMine = String(plant.owner) === String(currentUser.id);
		const hasDbId = isValidObjectId(plant.id);
		const isLockedByAcceptedTrade = acceptedLockedPlantIds.has(String(plant.id));
		const isClosedAtPlantLevel = isPlantClosedForRequests(plant);
		return isMine && hasDbId && !isLockedByAcceptedTrade && !isClosedAtPlantLevel;
	});
	if (myPlants.length === 0) {
		return `<option value="">Du har inga tillgängliga trades att erbjuda</option>`;
	}

	return [
		`<option value="">Välj en av dina trades</option>`,
		...myPlants.map((plant) => `<option value="${safeText(plant.id)}">${safeText(plant.name)} (${safeText(lightLevelLabel(plant.lightLevel))})</option>`),
	].join("");
}

function buildRequestButtonText(currentUser, status) {
	if (!currentUser) return "Logga in för att skicka";
	if (status === "pending") return "Trade är väntande";
	if (status === "accepted") return "Trade är godkänd";
	return "Skicka förfrågan";
}

function buildTradeRequestSection(plant, currentUser, isOwner, status) {
	if (isOwner) {
		return `<p class="trade-owner-note">Detta är din trade. Du kan redigera eller ta bort den i Min profil.</p>`;
	}

	let offerOptions = `<option value="">Logga in för att skicka förfrågan</option>`;
	if (currentUser) {
		offerOptions = buildOfferSelectOptions(currentUser);
	}

	const buttonText = buildRequestButtonText(currentUser, status);
	const isDisabled = !currentUser || status === "pending" || status === "accepted";

	return `
		<div class="trade-popup__counter">
		  <p class="trade-popup__section-title">Skicka bytesförfrågan</p>
		  <div class="trade-popup__counter-grid">
			<select data-offered-plant="${safeText(plant.id)}" class="trade-counter-field">
			  ${offerOptions}
			</select>
			<input data-counter-message="${safeText(plant.id)}" class="trade-counter-field" type="text" placeholder="Hej! Jag är intresserad av din växt." />
		  </div>
		  <button data-send-request="${safeText(plant.id)}" class="trade-request-btn" ${isDisabled ? "disabled" : ""}>
			${buttonText}
		  </button>
		</div>`;
}

function buildPlantPopup(plant, currentUser, status) {
	const isOwner = currentUser && plant.owner === currentUser.id;
	const statusClass = `trade-status--${safeText(status)}`;
	const requestSection = buildTradeRequestSection(plant, currentUser, isOwner, status);

	return `
	  <article class="trade-popup" data-plant-card="${safeText(plant.id)}">
		<h3 class="trade-popup__title">${safeText(plant.name)}</h3>
		<p class="trade-popup__owner">Delad av ${safeText(plant.ownerName)}</p>
		${plant.imageUrl ? `<img src="${safeText(plant.imageUrl)}" alt="${safeText(plant.name)}" class="trade-popup__image" />` : ""}

		<div class="trade-popup__meta">
		  <p><strong>Plats</strong></p>
		  <p>${safeText(plant.lat.toFixed(4))}, ${safeText(plant.lng.toFixed(4))}</p>
		  <p class="trade-popup__address">${safeText(plant.address)}</p>
		</div>

		<div class="trade-popup__meta">
		  <p><strong>Status</strong> <span class="trade-status ${statusClass}">${safeText(getTradeStatusLabel(status))}</span></p>
		  <p><strong>Beskrivning</strong></p>
		  <p>${safeText(plant.description)}</p>
		</div>

		${requestSection}
	  </article>
	`;
}

//trade requests
async function sendTradeRequest(requestedPlantId) {
	const currentUser = await ensureCurrentUserId();
	const token = getToken();

	if (!currentUser || !currentUser.id || !token) {
		alert("Du måste vara inloggad för att skicka förfrågan.");
		return;
	}

	const requestedPlant = getPlantFromCache(requestedPlantId);
	if (!requestedPlant) {
		alert("Kunde inte hitta vald trade.");
		return;
	}

	if (requestedPlant.owner === currentUser.id) {
		alert("Du kan inte skicka förfrågan på din egen trade.");
		return;
	}

	if (isPlantClosedForRequests(requestedPlant)) {
		alert("Denna trade är redan godkänd och tar inte emot fler förfrågningar.");
		await refreshTradeUi();
		return;
	}

	// Recheck with latest plant state from the server
	try {
		const latestPlants = await fetchAllPlants();
		const latestRequestedPlant = latestPlants.find((plant) => String(plant.id) === String(requestedPlantId));
		if (!latestRequestedPlant) {
			alert("Kunde inte hitta vald trade.");
			await refreshTradeUi();
			return;
		}

		if (isPlantClosedForRequests(latestRequestedPlant)) {
			alert("Denna trade är redan godkänd och tar inte emot fler förfrågningar.");
			await refreshTradeUi();
			return;
		}
	} catch (error) {
		console.error("Failed to validate latest plant status before request:", error);
	}

	const offerSelect = document.querySelector(`[data-offered-plant="${requestedPlantId}"]`);
	const messageInput = document.querySelector(`[data-counter-message="${requestedPlantId}"]`);

	let offeredPlantId = "";
	if (offerSelect) {
		offeredPlantId = String(offerSelect.value).trim();
	}

	let message = "";
	if (messageInput) {
		message = String(messageInput.value).trim();
	}

	if (!isValidObjectId(offeredPlantId)) {
		alert("Välj en av dina egna trades som motbud.");
		return;
	}

	const offeredPlant = getPlantFromCache(offeredPlantId);
	if (!offeredPlant || String(offeredPlant.owner) !== String(currentUser.id)) {
		alert("Du kan bara använda dina egna tillgängliga trades som motbud.");
		return;
	}

	if (isPlantClosedForRequests(offeredPlant)) {
		alert("Den valda motbudsväxten är redan godkänd och kan inte användas igen.");
		await refreshTradeUi();
		return;
	}

	try {
		const latestTrades = await fetchAllTrades();
		const acceptedLockedPlantIds = getPlantIdsLockedByAcceptedTrades(latestTrades);
		if (acceptedLockedPlantIds.has(String(offeredPlantId))) {
			alert("Den valda motbudsväxten är redan godkänd och kan inte användas igen.");
			await refreshTradeUi();
			return;
		}
	} catch (error) {
		console.error("Failed to validate latest trade status before request:", error);
	}

	if (!isValidObjectId(requestedPlant.owner) || !isValidObjectId(currentUser.id)) {
		alert("Kunde inte identifiera användare för trade-request.");
		return;
	}

	const payload = {
		requester: currentUser.id,
		receiver: requestedPlant.owner,
		offeredPlant: offeredPlantId,
		requestedPlant: requestedPlantId,
		status: "pending",
		message,
	};

	const response = await fetch(`${TRADE_API_BASE}/trades`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errText = await readResponseText(response);
		console.error("POST /trades failed:", response.status, errText);

		if (response.status === 409 || response.status === 422) {
			alert("Denna trade är inte längre tillgänglig för nya förfrågningar.");
			await refreshTradeUi();
			return;
		}

		alert("Kunde inte skicka förfrågan just nu.");
		return;
	}

	closeTradePopup();
	await refreshTradeUi();
}

// map marker 
function bindPopupActions(plantId) {
	const requestButton = document.querySelector(`[data-send-request="${plantId}"]`);
	if (requestButton) {
		requestButton.addEventListener("click", () => {
			sendTradeRequest(plantId);
		});
	}
}

function renderPlantMarkers(allTrades) {
	plantMarkers.forEach((markerInstance) => map.removeLayer(markerInstance));
	plantMarkers = [];

	const currentUser = getCurrentUser();
	const visiblePlants = getVisiblePlants();

	visiblePlants.forEach((plant) => {
		const currentUserId = currentUser && currentUser.id ? String(currentUser.id) : "";
		const status = getPlantTradeStatus(plant, allTrades, currentUserId);

		const plantMarker = L.marker([plant.lat, plant.lng], {
			icon: createPlantIcon(plant),
		}).addTo(map);

		plantMarker.bindPopup(buildPlantPopup(plant, currentUser, status), {
			className: "trade-popup-shell",
			maxWidth: 440,
		});

		plantMarker.on("popupopen", () => {
			bindPopupActions(plant.id);
		});

		plantMarkers.push(plantMarker);
	});
}

// own plant 
async function deleteOwnPlant(plantId) {
	const token = getToken();
	if (!token) {
		alert("Du måste vara inloggad.");
		return;
	}

	const response = await fetch(`${TRADE_API_BASE}/plants/${plantId}`, {
		method: "DELETE",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!response.ok) {
		const errText = await readResponseText(response);
		console.error("DELETE /plants/:id failed:", response.status, errText);

		if (handleUnauthorizedResponse(response, "Din session har gått ut. Logga in igen.")) {
			return;
		}

		alert("Något gick fel, uppdaterar listan ändå.");
		return;
	}

	await refreshTradeUi();
}

async function editOwnPlant(plantId) {
	const token = getToken();
	if (!token) {
		alert("Du måste vara inloggad.");
		return;
	}

	const targetPlant = getPlantFromCache(plantId);
	if (!targetPlant) return;

	const nextDescription = prompt("Ny beskrivning:", targetPlant.description || "");
	if (nextDescription === null) return;

	const payload = {
		description: String(nextDescription || "").trim(),
	};

	const response = await fetch(`${TRADE_API_BASE}/plants/${plantId}`, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errText = await readResponseText(response);
		console.error("PUT /plants/:id failed:", response.status, errText);

		if (handleUnauthorizedResponse(response, "Din session har gått ut. Logga in igen.")) {
			return;
		}

		alert("Kunde inte redigera trade.");
		return;
	}

	await refreshTradeUi();
}

function renderMyPosts() {
	if (!myPosts) return;

	const currentUser = getCurrentUser();
	if (!currentUser || !currentUser.id) {
		myPosts.innerHTML = `<li class="profile-post-item"><span>Logga in för att se dina trades.</span></li>`;
		return;
	}

	const ownPlants = plantsCache.filter((plant) => plant.owner === currentUser.id);
	myPosts.innerHTML = "";

	if (ownPlants.length === 0) {
		myPosts.innerHTML = `<li class="profile-post-item"><span>Du har inga egna trades än.</span></li>`;
		return;
	}

	ownPlants.forEach((plant) => {
		const item = document.createElement("li");
		item.className = "profile-post-item";
		item.innerHTML = `
			<div class="postDiv-profile">
				${plant.imageUrl ? `<img src="${safeText(plant.imageUrl)}" alt="${safeText(plant.name)}"/>` : ""}
				<div>
					<p>${safeText(plant.name)}</p>
					<small>${safeText(lightLevelLabel(plant.lightLevel))}</small>
				</div>
			</div>
			<div class="profile-post-actions">
				<button class="profile-post-edit" data-edit-plant="${safeText(plant.id)}">Redigera</button>
				<button class="profile-post-delete" data-delete-plant="${safeText(plant.id)}">Ta bort</button>
			</div>
		`;
		myPosts.append(item);
	});

	myPosts.querySelectorAll("[data-edit-plant]").forEach((button) => {
		button.addEventListener("click", () => {
			editOwnPlant(button.getAttribute("data-edit-plant"));
		});
	});

	myPosts.querySelectorAll("[data-delete-plant]").forEach((button) => {
		button.addEventListener("click", () => {
			deleteOwnPlant(button.getAttribute("data-delete-plant"));
		});
	});
}

// trade data
// the trade API sometimes returns just ids and sometimes full objects
function getIdFromValue(value) {
	if (value === null || value === undefined) {
		return "";
	}

	if (value && typeof value === "object") {
		if (value._id !== undefined && value._id !== null) {
			return String(value._id);
		}

		if (value.id !== undefined && value.id !== null) {
			return String(value.id);
		}

		return "";
	}

	return String(value);
}

function resolveTradePlantName(plantId) {
	const normalizedPlantId = getIdFromValue(plantId);
	const plant = getPlantFromCache(normalizedPlantId);
	return plant ? plant.name : "okänd växt";
}

// not working yet
function resolveTradeRequesterName(trade) {
	if (trade && trade.requester && trade.requester.name) {
		const requesterName = String(trade.requester.name || "").trim();
		if (requesterName) {
			return requesterName;
		}
	}

	if (trade) {
		const requesterId = getIdFromValue(trade.requester);
		const knownRequesterName = getKnownUserName(requesterId);
		if (knownRequesterName) {
			return knownRequesterName;
		}
	}

	const offeredPlantId = trade ? getIdFromValue(trade.offeredPlant) : "";

	if (offeredPlantId) {
		const offeredPlant = getPlantFromCache(offeredPlantId);
		if (offeredPlant && offeredPlant.ownerName) {
			return offeredPlant.ownerName;
		}
	}

	const requesterIdTail = trade ? getIdFromValue(trade.requester).slice(-6) : "";

	if (requesterIdTail) {
		return `Användare ${requesterIdTail}`;
	}

	// fallback thats shows Användare if nothing else is available
	return "Användare";
}

function getTradeMessage(trade) {
	let messageFromTrade = "";
	if (trade.message !== null && trade.message !== undefined) {
		messageFromTrade = String(trade.message).trim();
	}

	if (messageFromTrade) {
		return messageFromTrade;
	}

	return DEFAULT_REQUEST_MESSAGE;
}
function tradeHistoryCard(trade, currentUserId) {
  const offeredName   = resolveTradePlantName(trade.offeredPlant);
  const requestedName = resolveTradePlantName(trade.requestedPlant);
  const statusLabel   = getTradeStatusLabel(trade.status);
  const isRequester   = getIdFromValue(trade.requester) === currentUserId;
  const roleLabel     = isRequester ? "Du skickade" : "Du tog emot";
  const tradeId       = trade._id || trade.id; // Säkerställ att vi får ut ett ID

  let statusClass = "trade-history-status--other";
  if (trade.status === "accepted") statusClass = "trade-history-status--accepted";
  if (trade.status === "rejected") statusClass = "trade-history-status--rejected";
  if (isPendingStatus(trade.status)) statusClass = "trade-history-status--pending";

  // Endast den som skickat förfrågan kan ta bort/ångra den
  const deleteButton = isRequester
    ? `<button class="panel-cancel" style="padding: 5px 10px; font-size: 11px; margin-top: 8px;" 
               data-delete-trade="${tradeId}">
          Ångra förfrågan
       </button>`
    : "";

  return `
    <article class="trade-history-card">
      <div class="trade-history-card__plants">
        <span>${safeText(offeredName)}</span>
        <span class="trade-history-card__arrow">↔</span>
        <span>${safeText(requestedName)}</span>
      </div>
      <div class="trade-history-card__meta">
        <span class="trade-history-status ${statusClass}">${safeText(statusLabel)}</span>
        <span class="trade-history-card__role">${safeText(roleLabel)}</span>
      </div>
      ${deleteButton}
    </article>
  `;
}

function renderTradeHistory() {
  const container = document.getElementById("trade-history");
  const section = document.getElementById("trade-history-section");
  if (!container || !section) return;

  const currentUserId = getCurrentUserId();
  if (!currentUserId) {
    section.style.display = "none";
    return;
  }

  const myTrades = userTradesCache.filter((trade) => {
    const isRequester = getIdFromValue(trade.requester) === currentUserId;
    const isReceiver = getIdFromValue(trade.receiver) === currentUserId;
    return isRequester || isReceiver;
  });

  if (myTrades.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";

  const ongoing = myTrades.filter((t) => isPendingStatus(t.status));
  const finished = myTrades.filter((t) => !isPendingStatus(t.status));

  container.innerHTML = `
    <div class="trade-history__group">
      <p class="trade-history__group-title">
        Pågående <span class="trade-history__count">${ongoing.length}</span>
      </p>
      ${ongoing.length ? ongoing.map((t) => tradeHistoryCard(t, currentUserId)).join("") : `<p class="trade-history__empty">Inga pågående byten.</p>`}
    </div>

    <div class="trade-history__group">
      <p class="trade-history__group-title">
        Avslutade <span class="trade-history__count">${finished.length}</span>
      </p>
      ${finished.length ? finished.map((t) => tradeHistoryCard(t, currentUserId)).join("") : `<p class="trade-history__empty">Inga avslutade byten.</p>`}
    </div>
  `;

  container.querySelectorAll("[data-delete-trade]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tradeId = btn.getAttribute("data-delete-trade");
      deleteTrade(tradeId);
    });
  });
}

async function rejectTrade(trade) {
	const token = getToken();
	if (!token) {
		alert("Du måste vara inloggad.");
		return;
	}

	const updateResponse = await fetch(`${TRADE_API_BASE}/trades/${trade._id}/reject`, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (updateResponse.ok) {
		await refreshTradeUi();
		return;
	}

	const errText = await readResponseText(updateResponse);
	console.error("Reject trade failed:", updateResponse.status, errText);
	alert("Kunde inte neka förfrågan.");
}

async function acceptTrade(trade) {
	const token = getToken();
	if (!token) {
		alert("Du måste vara inloggad.");
		return;
	}

	const markPlantsAsAccepted = async () => {
		const requestedPlantId = getIdFromValue(trade && trade.requestedPlant);
		const offeredPlantId = getIdFromValue(trade && trade.offeredPlant);
		const plantIds = [requestedPlantId, offeredPlantId].filter((plantId) => isValidObjectId(plantId));

		if (plantIds.length === 0) return;

		await Promise.all(
			plantIds.map(async (plantId) => {
				try {
					await fetch(`${TRADE_API_BASE}/plants/${plantId}`, {
						method: "PUT",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${token}`,
						},
						body: JSON.stringify({
							status: "accepted",
							isAvailable: false,
						}),
					});
				} catch (error) {
					console.error("Failed to mark accepted plant unavailable:", error);
				}
			}),
		);
	};

	const updateResponse = await fetch(`${TRADE_API_BASE}/trades/${trade._id}/accept`, {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (updateResponse.ok) {
		await markPlantsAsAccepted();
		await refreshTradeUi();
		return;
	}

	const errText = await readResponseText(updateResponse);
	console.error("Accept trade failed:", updateResponse.status, errText);
	alert("Kunde inte godkänna förfrågan.");
}
async function deleteTrade(tradeId) {
	const token = getToken();
	if (!token) {
		alert("Du måste vara inloggad.");
		return;
	}

	const response = await fetch(`${TRADE_API_BASE}/trades/${tradeId}`, {
		method: "DELETE",
		headers: {
			Authorization: `Bearer ${token}`,
		},
	});

	if (!response.ok) {
		const errText = await readResponseText(response);
		console.error("DELETE trade failed:", response.status, errText);

		if (handleUnauthorizedResponse(response, "Din session har gått ut. Logga in igen.")) {
			return;
		}

		alert("Kunde inte ta bort trade.");
		return;
	}

	await refreshTradeUi();
}
function renderRequestsPanel() {
	const requestsPanel = document.querySelector(".requests-panel");
	if (!requestsPanel) return;

	const subtitle = requestsPanel.querySelector(".panel-subtitle");
	const emptyState = requestsPanel.querySelector(".requests-panel__empty-state");
	let listContainer = document.getElementById("requests-list");

	if (!listContainer) {
		listContainer = document.createElement("div");
		listContainer.id = "requests-list";
		listContainer.className = "requests-list";
		requestsPanel.appendChild(listContainer);
	}

	const currentUserId = getCurrentUserId();
	// show only incoming pending requests
	const pendingIncomingRequests = userTradesCache.filter((trade) => {
		const isReceiver = getIdFromValue(trade.receiver) === currentUserId;
		const isPending = isPendingStatus(trade.status);
		return isReceiver && isPending;
	});

	if (subtitle) {
		subtitle.textContent = `${pendingIncomingRequests.length} väntande förfrågningar`;
	}

	if (pendingIncomingRequests.length === 0) {
		if (emptyState) emptyState.style.display = "grid";
		listContainer.innerHTML = "";
		return;
	}

	if (emptyState) emptyState.style.display = "none";

	listContainer.innerHTML = pendingIncomingRequests
		.map((trade) => {
			const offeredName = resolveTradePlantName(trade.offeredPlant);
			const requestedName = resolveTradePlantName(trade.requestedPlant);
			const requesterName = resolveTradeRequesterName(trade);
			const tradeMessage = getTradeMessage(trade);

			return `
				<div class="request-card-wrapper">
					<p class="request-card__status-label">Väntande</p>
					<article class="request-card" data-trade-id="${safeText(trade._id)}">
						<div class="request-card__top">
							<p class="request-card__name">${safeText(requesterName)}</p>
							<p class="request-card__intent">vill byta ${safeText(offeredName)} mot ${safeText(requestedName)}</p>
							<p class="request-card__message">${safeText(tradeMessage)}</p>
						</div>
					<div class="request-card__actions">
						<button class="request-reject" data-reject-trade="${safeText(trade._id)}">Neka</button>
						<button class="request-accept" data-accept-trade="${safeText(trade._id)}">Godkänn</button>
					</div>
					</article>
				</div>
			`;
		})
		.join("");

	listContainer.querySelectorAll("[data-reject-trade]").forEach((button) => {
		button.addEventListener("click", () => {
			const tradeId = button.getAttribute("data-reject-trade");
			const trade = userTradesCache.find((entry) => entry._id === tradeId);
			if (!trade) return;
			rejectTrade(trade);
		});
	});

	listContainer.querySelectorAll("[data-accept-trade]").forEach((button) => {
		button.addEventListener("click", () => {
			const tradeId = button.getAttribute("data-accept-trade");
			const trade = userTradesCache.find((entry) => entry._id === tradeId);
			if (!trade) return;
			acceptTrade(trade);
		});
	});
}

// image handling
function estimateJsonBytes(value) {
	// simple size check
	return new Blob([JSON.stringify(value)]).size;
}

async function uploadImageToImgBB(file) {
	// Upload to ImgBB first then store only the URL in our own database
	const formData = new FormData();
	formData.append("image", file);

	const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
		method: "POST",
		body: formData,
	});

	if (!response.ok) {
		const errText = await readResponseText(response);
		throw new Error(`ImgBB upload failed: ${response.status} ${errText}`);
	}

	const data = await response.json();
	if (data && data.success && data.data && data.data.url) {
		return String(data.data.url);
	}

	throw new Error("ImgBB upload failed: invalid response payload");
}

// create plant trade
function shrinkPlantPayload(payload) {
	return {
		name: payload.name,
		species: payload.species,
		description: payload.description.slice(0, 80),
		imageUrl: payload.imageUrl || DEFAULT_PLANT_IMAGE_URL,
		lightLevel: payload.lightLevel,
		lat: payload.lat,
		lng: payload.lng,
		location: {
			address: String(payload.location.address ? payload.location.address : "").slice(0, 90),
			coordinates: payload.location.coordinates,
		},
	};
}

function buildPlantPayloadVariants(payload) {
	const variants = [];

	variants.push(payload);

	variants.push({
		...payload,
		location: {
			...payload.location,
			coordinates: [payload.lng, payload.lat],
		},
	});

	variants.push({
		...payload,
		lat: undefined,
		lng: undefined,
		location: {
			...payload.location,
			coordinates: [payload.lng, payload.lat],
		},
	});

	const uniqueVariants = [];
	const seen = new Set();
	variants.forEach((variant) => {
		const key = JSON.stringify(variant);
		if (seen.has(key)) return;
		seen.add(key);
		uniqueVariants.push(variant);
	});

	return uniqueVariants;
}

function closeAddPlantPanel() {
	const addPlantPanel = document.querySelector(".addPlant-panel");
	if (!addPlantPanel) return;

	if (document.activeElement) {
        document.activeElement.blur();
    }

	addPlantPanel.classList.remove("open");
	addPlantPanel.setAttribute("aria-hidden", "true");
}

function bindAddPlantUploadAction() {
	const uploadBtn = document.querySelector("#upload");
	if (!uploadBtn) return;
	if (uploadBtn.dataset.tradeBound === "1") return;

	uploadBtn.dataset.tradeBound = "1";
	uploadBtn.addEventListener("click", (event) => {
		event.preventDefault();
		createPlantFromPanel().catch((error) => {
			console.error("createPlantFromPanel failed:", error);
			alert("Kunde inte skapa trade.");
		});
	});
}

function getPlantFormInput() {
	const nameInput = document.querySelector("#plantTypeInput");
	const lightInput = document.querySelector("#LightLevelInput");
	const imageInput = document.getElementById("imageUpload");

	const plantName = String((nameInput && nameInput.value) || "").trim();
	const lightLevel = Number(String((lightInput && lightInput.value) || "2").trim() || 2);
	const imageFile = imageInput && imageInput.files ? imageInput.files[0] || null : null;

	return { plantName, lightLevel, imageFile };
}

async function tryUploadPlantImage(imageFile) {
	if (!imageFile) return DEFAULT_PLANT_IMAGE_URL;

	try {
		return await uploadImageToImgBB(imageFile);
	} catch (error) {
		console.error("Image upload failed:", error);
		alert("Kunde inte ladda upp bilden. Traden skapas med standardbild.");
		return DEFAULT_PLANT_IMAGE_URL;
	}
}

async function resolvePlantAddress(selectedPosition) {
	let address = String(window.currentAddress || "").trim() || "Stockholm";
	if (address !== "Stockholm") return address;

	try {
		const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${selectedPosition.lat}&lon=${selectedPosition.lng}&format=json`);
		const geoData = await geoRes.json();
		if (geoData && geoData.display_name) {
			address = String(geoData.display_name).slice(0, 160);
		}
	} catch (error) {
		console.error("Address lookup failed:", error);
	}

	return address;
}

function buildNewPlantPayload(plantName, lightLevel, imageUrl, selectedPosition, address) {
	return {
		name: plantName,
		species: plantName,
		description: `Byter gärna mot annan växt i bra skick. Ljusnivå: ${lightLevelLabel(String(lightLevel))}.`,
		imageUrl,
		lightLevel,
		status: "posted",
		isAvailable: true,
		lat: selectedPosition.lat,
		lng: selectedPosition.lng,
		location: {
			address,
			coordinates: {
				lat: selectedPosition.lat,
				lng: selectedPosition.lng,
			},
		},
	};
}

async function postPlantPayloadVariants(payloadVariants, token) {
	let finalResponse = null;

	for (let index = 0; index < payloadVariants.length; index += 1) {
		const currentPayload = payloadVariants[index];
		// try each payload version until one is accepted
		const response = await fetch(`${TRADE_API_BASE}/plants`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(currentPayload),
		});

		if (response.ok) return response;

		const errText = await readResponseText(response);
		console.error(`POST /plants failed (variant ${index + 1}/${payloadVariants.length}):`, response.status, errText);

		if (handleUnauthorizedResponse(response, "Din session är ogiltig. Logga in igen.")) {
			return null;
		}

		finalResponse = response;
	}

	return finalResponse;
}

async function createPlantFromPanel() {
	const token = getToken();
	if (!token) {
		alert("Du måste vara inloggad för att lägga upp trade.");
		return;
	}

	const { plantName, lightLevel, imageFile } = getPlantFormInput();

	if (!plantName) {
		alert("Välj växttyp.");
		return;
	}

	const selectedPosition = getSelectedMarkerLatLng();
	const imageUrl = await tryUploadPlantImage(imageFile);
	const currentAddress = await resolvePlantAddress(selectedPosition);

	let payload = buildNewPlantPayload(plantName, lightLevel, imageUrl, selectedPosition, currentAddress);

	// if too big use lighter payload data
	if (estimateJsonBytes(payload) > MAX_PLANT_PAYLOAD_BYTES) {
		payload = shrinkPlantPayload(payload);
	}

	if (estimateJsonBytes(payload) > MAX_PLANT_PAYLOAD_BYTES) {
		alert("Payload är fortfarande för stor. Testa en mindre bild.");
		return;
	}

	const payloadVariants = buildPlantPayloadVariants(payload);
	const finalResponse = await postPlantPayloadVariants(payloadVariants, token);

	if (!finalResponse) {
		alert("Kunde inte skapa trade.");
		return;
	}

	if (!finalResponse.ok) {
		if (finalResponse.status >= 500) {
			alert("Backend svarade med serverfel. Traden sparades inte i databasen. Försök igen om en stund.");
			return;
		}

		alert("Kunde inte skapa trade.");
		return;
	}

	let createdPlant = null;
	try {
		createdPlant = await finalResponse.json();
	} catch (error) {
		createdPlant = null;
	}

	closeAddPlantPanel();

	await refreshTradeUi();
}

// refresh ui
async function refreshTradeUi() {
	const currentUser = await ensureCurrentUserId();
	syncKnownUserNameFromCurrentUser();
	filteredPlantIds = null;

	// First fetch fresh data, then redraw the UI.
	plantsCache = await fetchAllPlants();
	const allTrades = await fetchAllTrades();
	allTradesCache = allTrades;
	updateKnownUserNamesFromTrades(allTrades);
	plantsCache = plantsCache.map(normalizePlant);

	if (currentUser && currentUser.id) {
		userTradesCache = await fetchTradesForUser();
		updateKnownUserNamesFromTrades(userTradesCache);
	} else {
		userTradesCache = [];
	}

	// redraw every traderelated part of the page
	renderPlantMarkers(allTrades);
	renderMyPosts();
	renderRequestsPanel();
	renderTradeHistory();
}

// init
function initTradeModule() {
	authSnapshot = getAuthSnapshot();
	bindAddPlantUploadAction();

	window.addEventListener("plantsFiltered", (event) => {
		setFilteredPlantIdsFromPlants(event.detail);
		renderPlantMarkers(allTradesCache);
	});

	window.addEventListener("auth-changed", () => {
		refreshTradeUi().catch((error) => {
			console.error("refreshTradeUi error:", error);
		});
	});

	// Legacy scripts still update sessionStorage without emitting auth changed
	setInterval(() => {
		const nextSnapshot = getAuthSnapshot();
		if (nextSnapshot === authSnapshot) return;
		authSnapshot = nextSnapshot;
		refreshTradeUi().catch((error) => {
			console.error("refreshTradeUi error:", error);
		});
	}, 1200);

	refreshTradeUi().catch((error) => {
		console.error("Initial trade UI refresh failed:", error);
	});
}

initTradeModule();