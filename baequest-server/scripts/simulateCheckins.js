// Simulates N real users checking into a live event via the actual public API
// (signup -> create profile -> check in), paced with a delay so you can watch
// the event's live count update in real time on the site while it runs.
//
// Side effects this causes for real:
//   - Sends a real verification + welcome email per fake account (signup flow)
//   - May send real SMS check-in notifications between compatible fake users
//     and any other compatible user already checked in at the event
//
// Usage: node scripts/simulateCheckins.js

const API_BASE = "https://api.baequests.com";

// ── Fill these in before running ────────────────────────────────────────────
const EVENT_ID = "6a4ae37e3090c03727d6d020"; // "Real test", free, 2026-07-05 23:09-23:15 UTC
const EVENT_LAT = 38.9871349;
const EVENT_LNG = -76.9771568;
const MY_EMAIL_LOCAL = "simuser";       // any unique-per-run string works, e.g. "simuser"
const MY_EMAIL_DOMAIN = "example.com";  // reserved test domain — never delivers anywhere, no clutter
const MY_PHONE = "+12272654836";          // E.164, e.g. +12025551234 — every fake profile uses this number
// ─────────────────────────────────────────────────────────────────────────────

const NUM_USERS = 20;
const DELAY_MS = 3000; // gap between each check-in, so you can watch it live

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractJwtCookie(res) {
  const cookies = res.headers.getSetCookie?.() || [res.headers.get("set-cookie")].filter(Boolean);
  const jwtCookie = cookies.find((c) => c.startsWith("jwt="));
  if (!jwtCookie) throw new Error("No jwt cookie returned");
  return jwtCookie.split(";")[0]; // "jwt=<token>"
}

const RUN_TAG = Date.now();

async function createUser(index) {
  const email = `${MY_EMAIL_LOCAL}+simtest${RUN_TAG}-${index}@${MY_EMAIL_DOMAIN}`;
  const res = await fetch(`${API_BASE}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "SimTest1!" }),
  });
  if (!res.ok) throw new Error(`signup failed (${res.status}): ${await res.text()}`);
  return extractJwtCookie(res);
}

async function createProfile(cookie, index) {
  // Alternate male/female, all straight, so every user is compatible with
  // roughly half the others -- exercises the real matching logic.
  const gender = index % 2 === 0 ? "male" : "female";

  const res = await fetch(`${API_BASE}/users/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      name: "Sim Tester",
      age: 25,
      gender,
      sexualOrientation: "straight",
      profession: "Tester",
      bio: "Simulated check-in test profile.",
      interests: ["music", "travel", "fitness"],
      convoStarter: "Hey, this is a test profile!",
      phoneNumber: MY_PHONE,
    }),
  });
  if (!res.ok) throw new Error(`profile creation failed (${res.status}): ${await res.text()}`);
}

async function uploadPhoto(cookie, index) {
  try {
    // Each index gets a unique photo from picsum.photos
    const photoRes = await fetch(`https://picsum.photos/seed/${RUN_TAG + index}/400/400`);
    if (!photoRes.ok) return;
    const blob = await photoRes.blob();
    const formData = new FormData();
    formData.append("profilePicture", blob, `photo${index}.jpg`);
    await fetch(`${API_BASE}/users/profile/picture`, {
      method: "POST",
      headers: { Cookie: cookie },
      body: formData,
    });
  } catch {
    // Photo upload is best-effort — profile still works without it
  }
}

async function checkin(cookie, index) {
  const res = await fetch(`${API_BASE}/events/${EVENT_ID}/checkin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ lat: EVENT_LAT, lng: EVENT_LNG }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`check-in failed (${res.status}): ${JSON.stringify(body)}`);
  return body;
}

async function run() {
  if (MY_EMAIL_LOCAL === "REPLACE_ME" || MY_PHONE === "REPLACE_ME") {
    console.error("Fill in MY_EMAIL_LOCAL and MY_PHONE at the top of this script first.");
    process.exit(1);
  }

  for (let i = 1; i <= NUM_USERS; i++) {
    process.stdout.write(`[${i}/${NUM_USERS}] signing up... `);
    const cookie = await createUser(i);

    process.stdout.write("profile... ");
    await createProfile(cookie, i);

    process.stdout.write("photo... ");
    await uploadPhoto(cookie, i);

    process.stdout.write("checking in... ");
    const result = await checkin(cookie, i);

    console.log(`done (${result.users?.length ?? 0} compatible users matched)`);

    if (i < NUM_USERS) await sleep(DELAY_MS);
  }

  console.log("\nAll 20 simulated check-ins complete.");
}

run().catch((err) => {
  console.error("\nSimulation failed:", err.message);
  process.exit(1);
});
