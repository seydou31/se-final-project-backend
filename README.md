# 🧩 BaeQuest Backend

The **BaeQuest Backend** powers the geolocation-driven dating experience of the BaeQuest platform.  
It handles event management, user authentication, check-ins, and location validation to ensure that members physically attend real-world events before connecting with others.

---

## ⚙️ Overview

The backend provides secure RESTful APIs that support the following:
- User authentication and authorization (JWT-based)
- Event creation, listing, and attendance tracking
- Geolocation-based user check-ins
- Distance validation between users and events
- Real-time updates of attendees at active events

---

## 🧠 Core Features

1. **User Authentication**
   - Register, login, and manage sessions securely using JWT tokens.
   - Protects event and check-in routes with authorization middleware.

2. **Event Management**
   - Create, update, and delete local events.
   - Store event details such as location coordinates, date, and participant list.

3. **Geolocation Check-In**
   - Validates that users are within a specific radius of the event before allowing check-in.
   - Returns feedback messages (e.g., “You are too far from the event to check in”).

4. **Navigation Prompt**
   - If the user is too far, the frontend triggers Google Maps navigation to the event location.

5. **User Discovery**
   - Retrieve all users currently checked into the same event.
   - Enables the frontend to display nearby attendees.

---

## 🧰 Tech Stack

- **Node.js** – JavaScript runtime for building scalable backend services.  
- **Express.js** – Fast, unopinionated web framework for building REST APIs.  
- **MongoDB + Mongoose** – NoSQL database for storing users, events, and attendance data.  
- **JWT (JSON Web Tokens)** – Secure user authentication and route protection.  
- **bcrypt.js** – For password hashing and user credential security.  
- **dotenv** – Environment variable management.  
- **CORS** – Middleware for handling cross-origin requests from the frontend.  

---

## 📡 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|-----------|-------------|
| POST | `/api/auth/register` | Register a new user |
| POST | `/api/auth/login` | Log in and receive a JWT token |
| GET | `/api/auth/me` | Get authenticated user details |

### Events
| Method | Endpoint | Description |
|--------|-----------|-------------|
| GET | `/api/events` | Get all active events |
| GET | `/api/events/:id` | Get a single event by ID |
| POST | `/api/events` | Create a new event (admin only) |
| PUT | `/api/events/:id` | Update event details |
| DELETE | `/api/events/:id` | Delete an event |

### Check-Ins
| Method | Endpoint | Description |
|--------|-----------|-------------|
| POST | `/api/checkin` | Validate user’s distance and mark attendance |
| GET | `/api/checkin/:eventId/users` | Get all users currently at an event |

---

## 🧮 Geolocation Logic

Each check-in compares the user’s current coordinates to the event’s coordinates using the **Haversine formula** to calculate distance on Earth’s surface.

If the distance is greater than the allowed threshold (e.g., 100 meters), the system returns:
```json
{
  "message": "User is too far away from the event, and must get directions.",
  "newEvent": { ...eventData }
}
```

---

## 🚀 Installation & Setup

### Prerequisites
Before you begin, ensure you have the following installed:
- **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
- **MongoDB** (local or cloud instance) - [Download here](https://www.mongodb.com/try/download/community) or use [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
- **npm** or **yarn** package manager
- **Git** for version control

### Step 1: Clone the Repository
```bash
git clone https://github.com/seydou31/se_project_express.git
cd se_project_express
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Configure Environment Variables
Create a `.env` file in the root directory and add the following variables:

```env
# Server Configuration
PORT=3001
NODE_ENV=development

# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017/baequest
# Or use MongoDB Atlas:
# MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/baequest

# JWT Secret (use a strong random string)
JWT_SECRET=your_super_secure_jwt_secret_key_here
JWT_EXPIRE=7d

# CORS Configuration (frontend URL)
CORS_ORIGIN=http://localhost:3000

# Geolocation Settings
MAX_CHECKIN_DISTANCE=100  # Distance in meters

# Google Places API (optional)
GOOGLE_PLACES_API_KEY=your_google_places_api_key_here
```

### Step 4: Set Up MongoDB
**Option A: Local MongoDB**
1. Start your local MongoDB server:
   ```bash
   mongod
   ```

**Option B: MongoDB Atlas (Cloud)**
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Create a new cluster
3. Get your connection string and update `MONGO_URI` in `.env`

### Step 5: Start the Development Server
```bash
npm run dev
```

The server should now be running at `http://localhost:3001`

### Step 6: Verify Installation
Test the API is running by visiting:
```
http://localhost:3001/api/events
```

Or use curl:
```bash
curl http://localhost:3001/api/events
```

---

## 📝 Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with hot reload (nodemon)
- `npm test` - Run test suite
- `npm run lint` - Run ESLint for code quality checks

---
