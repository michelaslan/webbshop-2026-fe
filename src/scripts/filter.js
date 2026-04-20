const filterBtn = document.getElementById("filterBtn");
const filterPanel = document.querySelector(".filter-panel");
const filterClose = document.querySelector(".filter-panel-close");
const applyFilter = document.getElementById("applyFilter");
const clearFilter = document.getElementById("clearFilter");

// Open/close filter panel
filterBtn.addEventListener("click", () => {
  filterPanel.classList.toggle("open");
});

filterClose.addEventListener("click", () => {
  filterPanel.classList.remove("open");
});

// Apply filter — fetches plants from backend with filters and triggers map update
applyFilter.addEventListener("click", async () => {
  // Get all checked plant names
  const checkedBoxes = document.querySelectorAll(".filter-checkbox-item input:checked");
  const selectedNames = Array.from(checkedBoxes).map(cb => cb.value);
  const lightLevel = document.getElementById("filterLightLevel").value;

  const params = new URLSearchParams();
  // Add each selected name as a separate param
  selectedNames.forEach(name => params.append("name", name));
  if (lightLevel) params.append("lightLevel", lightLevel);

  try {
    const res = await fetch(`/plants?${params.toString()}`);
    const plants = await res.json();
    window.dispatchEvent(new CustomEvent("plantsFiltered", { detail: plants }));
    filterPanel.classList.remove("open");
  } catch (error) {
    console.error("Filter error:", error);
  }
});

// Clear filter — fetches all plants and resets the dropdowns
clearFilter.addEventListener("click", async () => {
  document.querySelectorAll(".filter-checkbox-item input").forEach(cb => cb.checked = false);
  document.getElementById("filterLightLevel").value = "";

  try {
    const res = await fetch("/plants");
    const plants = await res.json();
    window.dispatchEvent(new CustomEvent("plantsFiltered", { detail: plants }));
    filterPanel.classList.remove("open");
  } catch (error) {
    console.error("Clear filter error:", error);
  }
});