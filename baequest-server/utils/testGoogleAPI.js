require("dotenv").config();
const { fetchGooglePlaces } = require("./fetchGooglePlaces");

async function testAPI() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  console.log("API Key loaded:", apiKey ? "Yes" : "No");
  console.log("API Key (first 10 chars):", apiKey ? apiKey.substring(0, 10) + "..." : "MISSING");

  const location = { lat: 38.9072, lng: -77.0369 }; // Washington DC
  const radius = 10000;

  console.log("\nFetching places...");
  console.log("Location:", location);
  console.log("Radius:", radius);

  const places = await fetchGooglePlaces(apiKey, location, radius);

  console.log("\n=== RESULTS ===");
  console.log(`Found ${places.length} places`);

  if (places.length > 0) {
    console.log("\nFirst place:");
    console.log(JSON.stringify(places[0], null, 2));
  }

  process.exit(0);
}

testAPI().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
