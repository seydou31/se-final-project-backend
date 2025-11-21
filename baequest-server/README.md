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
