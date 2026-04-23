const ADMIN_API_BASE = "https://webbshop-2026-be-g08.vercel.app";

let adminRefreshTimer = null;

// grab token from browser storage
function getAdminToken() {
  return localStorage.getItem("token") || "";
}

function getCurrentStoredUserRaw() {
  try {
    return JSON.parse(localStorage.getItem("user") || sessionStorage.getItem("user") || "null");
  } catch (error) {
    return null;
  }
}

function safeAdminText(value) {
  const safeValue = value === null || value === undefined ? "" : value;
  return String(safeValue)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function lightLabel(value) {
  const normalized = String(value || "2").trim();
  if (normalized === "1") return "Low Light";
  if (normalized === "3") return "Extreme Light";
  return "Normal Light";
}

function normalizeOwnerId(owner) {
  if (!owner) return "";
  if (typeof owner === "string" || typeof owner === "number") return String(owner);
  if (typeof owner === "object") {
    if (owner._id !== undefined && owner._id !== null) return String(owner._id);
    if (owner.id !== undefined && owner.id !== null) return String(owner.id);
    if (owner.userId !== undefined && owner.userId !== null) return String(owner.userId);
  }
  return "";
}

function normalizeOwnerName(owner) {
  if (owner && typeof owner === "object" && owner.name) {
    return String(owner.name).trim();
  }
  return "";
}

// make plant data easy to use
function normalizePlantForAdmin(plant) {
  const id = String((plant && (plant._id || plant.id)) || "");
  const ownerId = normalizeOwnerId(plant && plant.owner);
  const ownerName = normalizeOwnerName(plant && plant.owner);
  return {
    id,
    ownerId,
    ownerName,
    name: String((plant && plant.name) || "Växt"),
    imageUrl: String((plant && plant.imageUrl) || ""),
    lightLevel: String((plant && plant.lightLevel) || "2"),
    description: String((plant && plant.description) || ""),
  };
}

async function fetchRoleFromDatabase(token) {
  if (!token) return "";
  try {
    const response = await fetch(`${ADMIN_API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return "";
    const data = await response.json();
    const user = (data && data.user) || (data && data.data && data.data.user) || null;
    const role = user && user.role ? String(user.role).trim().toLowerCase() : "";

    const storedUser = getCurrentStoredUserRaw() || {};
    if (role) {
      localStorage.setItem("user", JSON.stringify({ ...storedUser, role }));
      sessionStorage.setItem("user", JSON.stringify({ ...storedUser, role }));
    }

    return role;
  } catch (error) {
    return "";
  }
}

async function isCurrentUserAdminFromDatabase() {
  const token = getAdminToken();
  if (!token) return false;

  const storedUser = getCurrentStoredUserRaw();
  const storedRole = storedUser && storedUser.role ? String(storedUser.role).trim().toLowerCase() : "";
  if (storedRole === "admin") return true;

  const roleFromDb = await fetchRoleFromDatabase(token);
  return roleFromDb === "admin";
}

async function fetchAllPlantsForAdmin() {
  const response = await fetch(`${ADMIN_API_BASE}/plants`);
  if (!response.ok) return [];
  const payload = await response.json();
  if (!Array.isArray(payload)) return [];
  return payload.map(normalizePlantForAdmin).filter((plant) => plant.id);
}

function ensureAdminListContainer() {
  const profilePanel = document.querySelector(".profile-panel");
  if (!profilePanel) return null;

  const baseList = profilePanel.querySelector("#myPosts");
  if (!baseList) return null;
  return baseList;
}

function clearAdminOverview() {
  // Non admin view is rendered by the regular trade module in #myPosts
}

function renderAdminOverview(plants) {
  const postsList = ensureAdminListContainer();
  if (!postsList) return;

  postsList.innerHTML = "";

  if (!Array.isArray(plants) || plants.length === 0) {
    postsList.innerHTML = `<li class="profile-post-item"><span>Det finns inga posts att visa.</span></li>`;
    return;
  }

  // put plants by owner
  const groups = new Map();
  plants.forEach((plant) => {
    const ownerId = String(plant.ownerId || "");
    if (!groups.has(ownerId)) groups.set(ownerId, []);
    groups.get(ownerId).push(plant);
  });

  const currentUser = getCurrentStoredUserRaw() || {};
  const currentUserId = String(currentUser.id || currentUser._id || currentUser.userId || "");

  const groupEntries = Array.from(groups.entries());
  groupEntries.sort((a, b) => {
    const aIsMine = a[0] && a[0] === currentUserId;
    const bIsMine = b[0] && b[0] === currentUserId;
    if (aIsMine && !bIsMine) return -1;
    if (!aIsMine && bIsMine) return 1;
    return 0;
  });

  groupEntries.forEach(([ownerId, ownerPlants]) => {
    const first = ownerPlants[0] || {};
    const fallbackName = ownerId ? `Användare ${ownerId.slice(-6)}` : "Användare";
    const ownerLabel = String(first.ownerName || fallbackName).trim();
    const ownerTitle = ownerId && ownerId === currentUserId ? "My Posts" : `${ownerLabel}'s Posts`;

    if (ownerId !== currentUserId) {
      const titleItem = document.createElement("li");
      titleItem.className = "profile-post-item";
      titleItem.innerHTML = `<span>${safeAdminText(ownerTitle)}</span>`;
      postsList.append(titleItem);
    }

    ownerPlants.forEach((plant) => {
      const item = document.createElement("li");
      item.className = "profile-post-item";
      item.innerHTML = `
        <div class="postDiv-profile">
          ${plant.imageUrl ? `<img src="${safeAdminText(plant.imageUrl)}" alt="${safeAdminText(plant.name)}"/>` : ""}
          <div>
            <p>${safeAdminText(plant.name)}</p>
            <small>${safeAdminText(lightLabel(plant.lightLevel))}</small>
          </div>
        </div>
        <div class="profile-post-actions">
          <button class="profile-post-edit" data-admin-edit-plant="${safeAdminText(plant.id)}">Redigera</button>
          <button class="profile-post-delete" data-admin-delete-plant="${safeAdminText(plant.id)}">Ta bort</button>
        </div>
      `;
      postsList.append(item);
    });
  });

  bindAdminButtons(plants);
}

async function editPlantAsAdmin(plantId, plants) {
  const token = getAdminToken();
  if (!token) {
    alert("Du måste vara inloggad.");
    return;
  }

  const target = plants.find((plant) => plant.id === plantId);
  if (!target) return;

  const nextDescription = prompt("Ny beskrivning:", target.description || "");
  if (nextDescription === null) return;

  const response = await fetch(`${ADMIN_API_BASE}/plants/${plantId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ description: String(nextDescription || "").trim() }),
  });

  if (!response.ok) {
    alert("Kunde inte redigera post.");
    return;
  }

  window.dispatchEvent(new Event("auth-changed"));
  await refreshAdminOverview();
}

async function deletePlantAsAdmin(plantId) {
  const token = getAdminToken();
  if (!token) {
    alert("Du måste vara inloggad.");
    return;
  }

  const shouldDelete = confirm("Är du säker på att du vill ta bort posten?");
  if (!shouldDelete) return;

  const response = await fetch(`${ADMIN_API_BASE}/plants/${plantId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    alert("Kunde inte ta bort post.");
    return;
  }

  window.dispatchEvent(new Event("auth-changed"));
  await refreshAdminOverview();
}

function bindAdminButtons(plants) {
  const postsList = ensureAdminListContainer();
  if (!postsList) return;

  // hook up buttons again
  postsList.querySelectorAll("[data-admin-edit-plant]").forEach((button) => {
    button.addEventListener("click", async () => {
      await editPlantAsAdmin(button.getAttribute("data-admin-edit-plant"), plants);
    });
  });

  postsList.querySelectorAll("[data-admin-delete-plant]").forEach((button) => {
    button.addEventListener("click", async () => {
      await deletePlantAsAdmin(button.getAttribute("data-admin-delete-plant"));
    });
  });
}

async function refreshAdminOverview() {
  const isAdmin = await isCurrentUserAdminFromDatabase();
  if (!isAdmin) {
    clearAdminOverview();
    return;
  }

  const allPlants = await fetchAllPlantsForAdmin();
  renderAdminOverview(allPlants);
}

function initAdminOverview() {
  window.addEventListener("auth-changed", () => {
    refreshAdminOverview();
  });

  if (adminRefreshTimer) {
    clearInterval(adminRefreshTimer);
  }

  // keep list fresh 
  adminRefreshTimer = setInterval(() => {
    refreshAdminOverview();
  }, 3000);

  refreshAdminOverview();
}

initAdminOverview();
