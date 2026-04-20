const TRADE_API_BASE = "https://webbshop-2026-be-g08.vercel.app";
const myPosts = document.querySelector("#myPosts");
const PLANT_COORD_OVERRIDES_KEY = "plantCoordOverrides";

let plantMarkers = [];
let plantsCache = [];
let userTradesCache = [];

const MAX_IMAGE_DATAURL_BYTES = 58 * 1024;
const MAX_PLANT_PAYLOAD_BYTES = 95 * 1024;
const DEFAULT_MAP_POSITION = {
	lat: 59.3293,
	lng: 18.0686,
};
const PENDING_TRADE_STATUSES = ["pending", "posted"];
const DEFAULT_USER_NAME = "Du";
const DEFAULT_REQUEST_MESSAGE = "Hej! Jag är intresserad av din växt.";

// auth
function getToken() {
	const token = localStorage.getItem("token");
	if (!token) return "";
	if (token.split(".").length !== 3) return "";
	return token;
}

function clearAuthAndPromptLogin(message) {
	localStorage.removeItem("token");
	localStorage.removeItem("user");
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

	if (!userData || typeof userData !== "object") {
		return {
			id: fallback.id,
			name: fallback.name,
			email: fallback.email,
		};
	}

	let normalizedId = fallback.id;
	if (userData._id !== undefined && userData._id !== null) {
		normalizedId = userData._id;
	} else if (userData.id !== undefined && userData.id !== null) {
		normalizedId = userData.id;
	}

	let normalizedName = fallback.name;
	if (userData.name) {
		normalizedName = userData.name;
	}

	let normalizedEmail = fallback.email;
	if (userData.email !== undefined && userData.email !== null) {
		normalizedEmail = userData.email;
	}

	return {
		id: normalizedId,
		name: normalizedName,
		email: String(normalizedEmail).trim().toLowerCase(),
	};
}

function getCurrentUser() {
	try {
		const userData = JSON.parse(localStorage.getItem("user") || "null");
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
}

async function ensureCurrentUserId() {
	const token = getToken();
	const currentUser = getCurrentUser();

	if (!token) return currentUser;
	if (currentUser && currentUser.id) return currentUser;

	try {
		const response = await fetch(`${TRADE_API_BASE}/auth/me`, {
			headers: {
				Authorization: `Bearer ${token}`,
			},
		});

		if (!response.ok) return currentUser;

		const me = await response.json();
		const normalized = normalizeUserData(me, currentUser);
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

function readPlantCoordOverrides() {
	try {
		return JSON.parse(localStorage.getItem(PLANT_COORD_OVERRIDES_KEY) || "{}");
	} catch (error) {
		return {};
	}
}

function savePlantCoordOverrides(overrides) {
	localStorage.setItem(PLANT_COORD_OVERRIDES_KEY, JSON.stringify(overrides));
}

function getPlantCoordOverride(plantId) {
	if (!plantId) return null;
	const overrides = readPlantCoordOverrides();
	const entry = overrides[String(plantId)];
	if (!entry) return null;

	if (!Number.isFinite(Number(entry.lat)) || !Number.isFinite(Number(entry.lng))) {
		return null;
	}

	return {
		lat: Number(entry.lat),
		lng: Number(entry.lng),
	};
}

function setPlantCoordOverride(plantId, lat, lng) {
	if (!plantId) return;
	if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng))) return;

	const overrides = readPlantCoordOverrides();
	overrides[String(plantId)] = {
		lat: Number(lat),
		lng: Number(lng),
		updatedAt: Date.now(),
	};
	savePlantCoordOverrides(overrides);
}

function closeTradePopup() {
	map.closePopup();
}

function isValidObjectId(id) {
	const value = id === null || id === undefined ? "" : id;
	return /^[a-f0-9]{24}$/i.test(String(value));
}

function getPlantId(plant) {
	if (!plant || typeof plant !== "object") return "";

	if (plant._id !== undefined && plant._id !== null) {
		return plant._id;
	}

	if (plant.id !== undefined && plant.id !== null) {
		return plant.id;
	}

	return "";
}

function getLocationCoordinates(plant) {
	if (!plant || !plant.location || !Array.isArray(plant.location.coordinates)) {
		return [];
	}

	return plant.location.coordinates;
}

function toNumberOrNull(value) {
	const parsedValue = Number(value);
	return Number.isFinite(parsedValue) ? parsedValue : null;
}

function getPlantOwnerId(owner) {
	if (typeof owner === "string") return owner;
	if (owner && typeof owner === "object") {
		if (owner._id !== undefined && owner._id !== null) {
			return owner._id;
		}
	}

	return "";
}

function getPlantOwnerName(owner) {
	if (owner && typeof owner === "object" && owner.name) {
		return owner.name;
	}

	return "Användare";
}

function getStoredTradeMessages() {
	try {
		return JSON.parse(localStorage.getItem("tradeMessages") || "{}");
	} catch (error) {
		return {};
	}
}

function saveStoredTradeMessages(messages) {
	localStorage.setItem("tradeMessages", JSON.stringify(messages));
}

function isPendingStatus(status) {
	const value = status === null || status === undefined ? "" : status;
	return PENDING_TRADE_STATUSES.includes(String(value));
}

function getPlantFromCache(plantId) {
	return plantsCache.find((plant) => plant.id === plantId);
}

function getCurrentUserId() {
	const currentUser = getCurrentUser();
	if (!currentUser || currentUser.id === null || currentUser.id === undefined) {
		return "";
	}

	return String(currentUser.id);
}

// plant data
// turn plant data from the API into one simple object shape
function normalizePlant(plant) {
	const plantId = getPlantId(plant);
	const localOverride = getPlantCoordOverride(plantId);
	const locationCoordinates = getLocationCoordinates(plant);
	const lngFromPlant = toNumberOrNull(plant && plant.lng);
	const latFromPlant = toNumberOrNull(plant && plant.lat);
	const lngFromLocation = toNumberOrNull(locationCoordinates[0]);
	const latFromLocation = toNumberOrNull(locationCoordinates[1]);
	const lngFromOverride = localOverride ? toNumberOrNull(localOverride.lng) : null;
	const latFromOverride = localOverride ? toNumberOrNull(localOverride.lat) : null;

	let lng = DEFAULT_MAP_POSITION.lng;
	if (lngFromPlant !== null) {
		lng = lngFromPlant;
	} else if (lngFromLocation !== null) {
		lng = lngFromLocation;
	} else if (lngFromOverride !== null) {
		lng = lngFromOverride;
	}

	let lat = DEFAULT_MAP_POSITION.lat;
	if (latFromPlant !== null) {
		lat = latFromPlant;
	} else if (latFromLocation !== null) {
		lat = latFromLocation;
	} else if (latFromOverride !== null) {
		lat = latFromOverride;
	}

	return {
		id: plantId,
		owner: getPlantOwnerId(plant.owner),
		ownerName: getPlantOwnerName(plant.owner),
		name: plant.name || "Växt",
		species: plant.species || "",
		description: plant.description || "Ingen beskrivning.",
		imageUrl: plant.imageUrl || "",
		lightLevel: String(plant.lightLevel || "2"),
		address: (plant.location && plant.location.address) || "Okänd adress",
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
	const response = await fetch(`${TRADE_API_BASE}/plants`);
	if (!response.ok) {
		throw new Error(`Failed GET /plants: ${response.status}`);
	}
	const plants = await response.json();
	return Array.isArray(plants) ? plants.map(normalizePlant) : [];
}

async function fetchTradesForUser(userId) {
	if (!isValidObjectId(userId)) return [];

	const response = await fetch(`${TRADE_API_BASE}/trades/user/${userId}`);
	if (!response.ok) {
		throw new Error(`Failed GET /trades/user/:id: ${response.status}`);
	}
	const trades = await response.json();
	return Array.isArray(trades) ? trades : [];
}

async function fetchAllTrades() {
	const response = await fetch(`${TRADE_API_BASE}/trades`);
	if (!response.ok) return [];
	const trades = await response.json();
	return Array.isArray(trades) ? trades : [];
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

function getPlantIdsWithPendingRequests(allTrades) {
	const pendingTrades = allTrades.filter((trade) => isPendingStatus(trade.status));

	return new Set(
		pendingTrades.map((trade) => {
			if (trade.requestedPlant === null || trade.requestedPlant === undefined) {
				return "";
			}

			return String(trade.requestedPlant);
		}),
	);
}

function getPlantTradeStatus(plant, allTrades) {
	const matchingTrades = allTrades.filter((trade) => {
		return getIdFromValue(trade.requestedPlant) === String(plant.id);
	});

	if (matchingTrades.some((trade) => isPendingStatus(trade.status))) {
		return "pending";
	}

	if (matchingTrades.some((trade) => trade.status === "accepted")) {
		return "accepted";
	}

	if (matchingTrades.some((trade) => trade.status === "rejected")) {
		return "rejected";
	}

	if (plant.isAvailable) {
		return "available";
	}

	return "pending";
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
	const myPlants = plantsCache.filter((plant) => plant.owner === currentUser.id);
	if (myPlants.length === 0) {
		return `<option value="">Du har inga egna trades att erbjuda</option>`;
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
		alert("Kunde inte skicka förfrågan just nu.");
		return;
	}

	// Cache the message locally in case the backend doesn't return it
	if (message) {
		try {
			const created = await response.clone().json();
			const newTradeId = getIdFromValue(created);
			if (newTradeId) {
				const stored = getStoredTradeMessages();
				stored[newTradeId] = message;
				saveStoredTradeMessages(stored);
			}
		} catch (error) {
			// missing message cache must not block trade creation
		}
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

	plantsCache.forEach((plant) => {
		const status = getPlantTradeStatus(plant, allTrades);

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

		alert("Kunde inte ta bort trade.");
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
	if (trade && trade.requester && typeof trade.requester === "object") {
		const requesterName = String(trade.requester.name || "").trim();
		if (requesterName) {
			return requesterName;
		}
	}

	let offeredPlantId = "";
	if (trade) {
		offeredPlantId = getIdFromValue(trade.offeredPlant);
	}

	if (offeredPlantId) {
		const offeredPlant = getPlantFromCache(offeredPlantId);
		if (offeredPlant && offeredPlant.ownerName) {
			return offeredPlant.ownerName;
		}
	}

	let requesterIdTail = "";
	if (trade) {
		const requesterId = getIdFromValue(trade.requester);
		requesterIdTail = requesterId.slice(-6);
	}

	if (requesterIdTail) {
		return `Användare ${requesterIdTail}`;
	}

	// fallback thats shows Användare if nothing else is available
	return "Användare";
}

function getTradeMessage(trade) {
	const cachedMessages = getStoredTradeMessages();

	let messageFromTrade = "";
	if (trade.message !== null && trade.message !== undefined) {
		messageFromTrade = String(trade.message).trim();
	}

	if (messageFromTrade) {
		return messageFromTrade;
	}

	let cachedMessageValue = "";
	if (cachedMessages[trade._id] !== null && cachedMessages[trade._id] !== undefined) {
		cachedMessageValue = cachedMessages[trade._id];
	}

	const messageFromCache = String(cachedMessageValue).trim();
	if (messageFromCache) {
		return messageFromCache;
	}

	return DEFAULT_REQUEST_MESSAGE;
}

function clearTradeMessageCache(tradeId) {
	const stored = getStoredTradeMessages();
	delete stored[String(tradeId)];
	saveStoredTradeMessages(stored);
}

// incoming request
async function deleteTrade(tradeId) {
	const response = await fetch(`${TRADE_API_BASE}/trades/${tradeId}`, {
		method: "DELETE",
	});

	if (!response.ok) {
		const errText = await readResponseText(response);
		console.error("DELETE /trades/:id failed:", response.status, errText);
		alert("Kunde inte neka förfrågan.");
		return;
	}

	clearTradeMessageCache(tradeId);
	return true;
}

async function rejectTrade(trade) {
	const payload = {
		requester: trade.requester,
		receiver: trade.receiver,
		offeredPlant: trade.offeredPlant,
		requestedPlant: trade.requestedPlant,
		status: "rejected",
		message: trade.message || "",
	};

	const createResponse = await fetch(`${TRADE_API_BASE}/trades`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!createResponse.ok) {
		const errText = await readResponseText(createResponse);
		console.error("POST rejected trade failed:", createResponse.status, errText);
		alert("Kunde inte neka förfrågan.");
		return;
	}

	const wasDeleted = await deleteTrade(trade._id);
	if (!wasDeleted) {
		return;
	}

	await refreshTradeUi();
}

async function acceptTrade(trade) {
	const payload = {
		requester: trade.requester,
		receiver: trade.receiver,
		offeredPlant: trade.offeredPlant,
		requestedPlant: trade.requestedPlant,
		status: "accepted",
	};

	const createResponse = await fetch(`${TRADE_API_BASE}/trades`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!createResponse.ok) {
		const errText = await readResponseText(createResponse);
		console.error("POST accepted trade failed:", createResponse.status, errText);
		alert("Kunde inte godkänna förfrågan.");
		return;
	}

	const wasDeleted = await deleteTrade(trade._id);
	if (!wasDeleted) {
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
function estimateDataUrlBytes(dataUrl) {
	const safeDataUrl = dataUrl ? dataUrl : "";
	const commaIndex = String(safeDataUrl).indexOf(",");
	if (commaIndex < 0) return 0;
	// remove data URL prefix first
	const base64Part = dataUrl.slice(commaIndex + 1);
	return Math.floor((base64Part.length * 3) / 4);
}

function estimateJsonBytes(value) {
	return new Blob([JSON.stringify(value)]).size;
}

function loadImageFromDataUrl(dataUrl) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = dataUrl;
	});
}

function convertFileToBase64(file) {
	if (typeof toBase64 === "function") {
		return toBase64(file);
	}

	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(reader.result);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

async function toOptimizedBase64(file) {
	const originalDataUrl = await convertFileToBase64(file);
	if (estimateDataUrlBytes(originalDataUrl) <= MAX_IMAGE_DATAURL_BYTES) {
		return originalDataUrl;
	}

	const img = await loadImageFromDataUrl(originalDataUrl);
	let width = img.naturalWidth || img.width;
	let height = img.naturalHeight || img.height;

	const maxSide = 1280;
	if (Math.max(width, height) > maxSide) {
		const scale = maxSide / Math.max(width, height);
		width = Math.max(1, Math.round(width * scale));
		height = Math.max(1, Math.round(height * scale));
	}

	const canvas = document.createElement("canvas");
	const ctx = canvas.getContext("2d");
	if (!ctx) return originalDataUrl;

	const MIN_QUALITY = 0.38;
	const MIN_SIDE = 420;
	let quality = 0.82;
	let resultDataUrl = originalDataUrl;

	// lower quality and size until it fits
	while (true) {
		canvas.width = width;
		canvas.height = height;
		ctx.clearRect(0, 0, width, height);
		ctx.drawImage(img, 0, 0, width, height);
		resultDataUrl = canvas.toDataURL("image/jpeg", quality);

		if (estimateDataUrlBytes(resultDataUrl) <= MAX_IMAGE_DATAURL_BYTES) {
			return resultDataUrl;
		}

		if (quality > MIN_QUALITY) {
			quality = Math.max(MIN_QUALITY, quality - 0.08);
			continue;
		}

		if (Math.max(width, height) > MIN_SIDE) {
			width = Math.max(1, Math.round(width * 0.8));
			height = Math.max(1, Math.round(height * 0.8));
			quality = 0.58;
			continue;
		}

		return resultDataUrl;
	}
}

// create plant trade
function shrinkPlantPayload(payload) {
	return {
		name: payload.name,
		species: payload.species,
		description: payload.description.slice(0, 80),
		imageUrl: "",
		lightLevel: payload.lightLevel,
		lat: payload.lat,
		lng: payload.lng,
		location: {
			address: String(payload.location.address ? payload.location.address : "").slice(0, 90),
			coordinates: payload.location.coordinates,
		},
	};
}

function closeAddPlantPanel() {
	const addPlantPanel = document.querySelector(".addPlant-panel");
	if (!addPlantPanel) return;

	addPlantPanel.classList.remove("open");
	addPlantPanel.setAttribute("aria-hidden", "true");
}

async function createPlantFromPanel() {
	const token = getToken();
	if (!token) {
		alert("Du måste vara inloggad för att lägga upp trade.");
		return;
	}

	const nameInput = document.querySelector("#plantTypeInput");
	const lightInput = document.querySelector("#LightLevelInput");
	const imageInput = document.getElementById("imageUpload");

	let plantName = "";
	if (nameInput) {
		plantName = String(nameInput.value).trim();
	}

	let lightLevelValue = "";
	if (lightInput) {
		lightLevelValue = String(lightInput.value).trim();
	}

	const lightLevel = Number(lightLevelValue || 2);

	let imageFile = null;
	if (imageInput && imageInput.files && imageInput.files[0]) {
		imageFile = imageInput.files[0];
	}

	if (!plantName) {
		alert("Välj växttyp.");
		return;
	}

	let imageBase64 = "";
	if (imageFile) {
		imageBase64 = await toOptimizedBase64(imageFile);
		if (estimateDataUrlBytes(imageBase64) > MAX_IMAGE_DATAURL_BYTES) {
			imageBase64 = "";
			alert("Bilden var för stor och togs bort för att kunna skapa trade.");
		}
	}

	const selectedPosition = getSelectedMarkerLatLng();
	let currentAddress = "Stockholm";

	try {
		const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${selectedPosition.lat}&lon=${selectedPosition.lng}&format=json`);
		const geoData = await geoRes.json();
		if (geoData && geoData.display_name) {
			currentAddress = String(geoData.display_name).slice(0, 160);
		}
	} catch (error) {
		console.error("Address lookup failed:", error);
	}

	let payload = {
		name: plantName,
		species: plantName,
		description: `Byter gärna mot annan växt i bra skick. Ljusnivå: ${lightLevelLabel(String(lightLevel))}.`,
		imageUrl: imageBase64,
		lightLevel,
		lat: selectedPosition.lat,
		lng: selectedPosition.lng,
		location: {
			address: currentAddress,
			coordinates: [selectedPosition.lng, selectedPosition.lat],
		},
	};

	// if too big use lighter payload data
	if (estimateJsonBytes(payload) > MAX_PLANT_PAYLOAD_BYTES) {
		payload = shrinkPlantPayload(payload);
	}

	if (estimateJsonBytes(payload) > MAX_PLANT_PAYLOAD_BYTES) {
		alert("Payload är fortfarande för stor. Testa en mindre bild.");
		return;
	}

	const response = await fetch(`${TRADE_API_BASE}/plants`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const errText = await readResponseText(response);
		console.error("POST /plants failed:", response.status, errText);

		if (handleUnauthorizedResponse(response, "Din session är ogiltig. Logga in igen.")) {
			return;
		}

		alert("Kunde inte skapa trade.");
		return;
	}

	let createdPlant = null;
	try {
		createdPlant = await response.json();
	} catch (error) {
		createdPlant = null;
	}

	const createdPlantId = getIdFromValue(createdPlant);
	if (createdPlantId) {
		setPlantCoordOverride(createdPlantId, selectedPosition.lat, selectedPosition.lng);
	}

	closeAddPlantPanel();

	await refreshTradeUi();
}

// refresh ui
async function refreshTradeUi() {
	const currentUser = await ensureCurrentUserId();

	plantsCache = await fetchAllPlants();
	const allTrades = await fetchAllTrades();

	if (currentUser && currentUser.id) {
		userTradesCache = await fetchTradesForUser(currentUser.id);
	} else {
		userTradesCache = [];
	}

	// redraw every traderelated part of the page
	renderPlantMarkers(allTrades);
	renderMyPosts();
	renderRequestsPanel();
}

// init
function initTradeModule() {
	window.addEventListener("auth-changed", () => {
		refreshTradeUi().catch((error) => {
			console.error("refreshTradeUi error:", error);
		});
	});

	refreshTradeUi().catch((error) => {
		console.error("Initial trade UI refresh failed:", error);
	});
}

initTradeModule();
