# State-Based Event Filtering - Backend Changes

## Summary
Backend implementation complete for state-based event filtering. Users can now select a state from the frontend, and events will be fetched from that state's major city.

## Changes Made

### 1. Event Model Updated ✅
**File**: `baequest-server/models/event.js`

Added `state` field to store US state name:
```javascript
state: { type: String }, // US state name for filtering
```

### 2. Event Controller Updated ✅
**File**: `baequest-server/controllers/event.js`

**Added:**
- `getStateFromCoordinates()` - Geocoding function using Google Geocoding API
- State filtering in `events()` endpoint - Accepts `?state=California` query parameter
- State coordinates lookup in `fetchAndCreateEvents()` - Uses state coordinates instead of user location
- Automatic state detection - Geocodes each event to detect its state

**Key Changes:**
- Events endpoint now filters by state: `GET /events?state=California`
- Fetch events endpoint accepts state: `POST /fetch-google-events { "state": "California" }`
- Each created event is geocoded to determine its state

### 3. State Coordinates Mapping ✅
**File**: `baequest-server/constants/stateCoordinates.js`

Maps all 50 US states to their major city coordinates for Google Places API searches.

Examples:
- California → Los Angeles (34.0522, -118.2437)
- New York → New York City (40.7128, -74.0060)
- Texas → Houston (29.7604, -95.3698)

### 4. Migration Script ✅
**File**: `baequest-server/utils/addStateToEvents.js`

Script to add state information to existing events:
- Finds events without a state field
- Geocodes their coordinates to detect state
- Updates events with detected state
- Includes 200ms delay to avoid rate limits

## How It Works

### API Flow
1. Frontend sends: `POST /fetch-google-events { "state": "California" }`
2. Backend looks up California coordinates: `(34.0522, -118.2437)`
3. Google Places API searches for places near Los Angeles
4. Each place is geocoded to detect its actual state
5. Events are created with `state: "California"`
6. Frontend requests: `GET /events?state=California`
7. Backend returns only events where `state === "California"`

### Geocoding
Each event is automatically geocoded when created:
```javascript
const detectedState = await getStateFromCoordinates(lat, lng, apiKey);
// Returns: "California", "New York", etc.
```

## API Endpoints Updated

### GET /events
**Before:** Returns all active events
**Now:** Accepts optional `state` query parameter

```bash
# Get all events
GET /events

# Get events in California only
GET /events?state=California
```

### POST /fetch-google-events
**Before:** Accepts `{ lat, lng, radius }`
**Now:** Accepts `{ state, radius }`

```bash
# Fetch events for California
POST /fetch-google-events
Content-Type: application/json
{ "state": "California" }

# Fetch events for default location (DC)
POST /fetch-google-events
Content-Type: application/json
{}
```

## Google Geocoding API

### Setup Required
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable "Geocoding API" (same project as Places API)
3. No additional API key needed (uses `GOOGLE_PLACES_API_KEY`)

### Quotas
- **Free tier**: 40,000 requests/month
- **Usage**: 1 request per event created
- **Cost**: Free for typical usage

### Rate Limiting
Migration script includes 200ms delay between requests to avoid quota issues.

## Testing

### Test State Filtering
```bash
# Create events for California
curl -X POST http://localhost:3001/fetch-google-events \
  -H "Content-Type: application/json" \
  -H "Cookie: token=YOUR_TOKEN" \
  -d '{"state": "California"}'

# Get only California events
curl http://localhost:3001/events?state=California \
  -H "Cookie: token=YOUR_TOKEN"

# Get all events
curl http://localhost:3001/events \
  -H "Cookie: token=YOUR_TOKEN"
```

### Verify Event Creation
Check that created events have state field:
```javascript
{
  "_id": "...",
  "title": "Coffee & Chill",
  "location": {
    "name": "Blue Bottle Coffee",
    "lat": 34.0522,
    "lng": -118.2437
  },
  "state": "California",  // ← New field
  "date": "2025-11-28T15:00:00.000Z",
  ...
}
```

## Migration (Optional)

If you have existing events without state information:

```bash
cd baequest-server
node utils/addStateToEvents.js
```

**Output:**
```
Starting migration...
Connected to MongoDB
Found 15 events without state information

Processing event 1/15: Coffee & Chill
Location: 38.9072, -77.0369
✓ Updated event with state: District of Columbia

...

=== Migration Complete ===
Total events processed: 15
Successfully updated: 15
Failed: 0
```

## Deployment Checklist

- [x] Update event model with state field
- [x] Add state coordinates mapping
- [x] Update event controller with filtering
- [x] Add geocoding function
- [x] Create migration script
- [ ] Enable Geocoding API in Google Cloud Console
- [ ] Restart backend server
- [ ] Test event creation with state
- [ ] Test event filtering by state
- [ ] Run migration for existing events (optional)

## Next Steps

1. **Enable Geocoding API** in Google Cloud Console
2. **Restart the server**: `npm start`
3. **Test the endpoints** using the test commands above
4. **Run migration** if you have existing events
5. **Monitor API usage** to ensure you stay within quota

## Files Modified

- ✅ `models/event.js` - Added state field
- ✅ `controllers/event.js` - Added filtering and geocoding
- ✅ `constants/stateCoordinates.js` - New file
- ✅ `utils/addStateToEvents.js` - New file

## Notes

- State field is optional (backward compatible)
- Events without state will still be returned when no filter is applied
- Geocoding happens asynchronously during event creation
- If geocoding fails, event is created with `state: null`
