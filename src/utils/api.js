export function getBaseUrl() {
  if (window.location.hostname.includes("localhost") && false) { // Kommentera ut för att komma åt lokal server igen
    return "http://localhost:3000/";
  }
  return "https://webbshop-2026-be-g08.vercel.app"; // Er backend-rotadress
}
