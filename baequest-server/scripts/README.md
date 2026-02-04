# Database Migration Scripts

This directory contains scripts for managing database migrations and data population.

## Available Scripts

### `populateCityField.js`

Populates the `city` field for existing events by extracting city names from their addresses.

**When to use:**
- After adding the `city` field to the Event model
- When events in the database have addresses but no city field

**How to run:**
```bash
node scripts/populateCityField.js
```

**What it does:**
- Finds all events without a city field (or with null/empty city)
- Extracts city name from the `location.address` field
- Updates each event with the extracted city
- Provides a summary of updated and skipped events

### `checkEvents.js`

Displays a sample of events from the database to inspect their structure.

**When to use:**
- To verify event data structure
- To check if events have city and state fields
- To debug event-related issues

**How to run:**
```bash
node scripts/checkEvents.js
```

## Notes

- All scripts require a valid MongoDB connection (configured via `.env` file)
- Scripts will automatically close the database connection when complete
- Run scripts from the `baequest-server` directory
