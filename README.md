# BaeQuest Backend

The BaeQuest backend powers the event discovery, geolocation check-in, real-time attendee tracking, and payment processing for the BaeQuest platform.

API base URL: https://api.baequests.com
Frontend repo: https://github.com/seydou31/se-final-project

---

## Tech Stack

- **Node.js + Express** – REST API server
- **MongoDB + Mongoose** – Database (hosted on MongoDB Atlas)
- **Socket.io** – Real-time check-in/checkout events
- **JWT + bcryptjs** – Authentication and password hashing
- **Stripe Connect** – Per-event payments and event manager payouts
- **Resend** – Transactional email (verification, feedback requests)
- **Twilio** – SMS notifications when a compatible user checks in nearby
- **AWS S3** – Profile picture and event photo storage
- **Sharp** – Image optimization before upload
- **Helmet + express-rate-limit** – Security hardening
- **Sentry** – Error monitoring
- **Winston** – Structured logging
- **Docker** – Containerized deployment with blue-green strategy on GCP

---

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/signup` | Register a new user |
| POST | `/signin` | Log in |
| POST | `/logout` | Log out |
| POST | `/refresh-token` | Refresh JWT |
| POST | `/auth/google` | Google OAuth |
| POST | `/password-reset/request` | Request password reset email |
| POST | `/password-reset/reset` | Reset password with token |
| POST | `/email-verification/send` | Send verification email |
| POST | `/email-verification/verify` | Verify email address |

### Users / Profiles
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/users/profile` | Create profile |
| GET | `/users/profile` | Get own profile |
| PATCH | `/users/profile` | Update profile |
| DELETE | `/users/profile` | Delete profile |
| POST | `/users/profile/picture` | Upload profile picture |

### Events
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/events` | Get upcoming events (auth required) |
| GET | `/events/nearby` | Get events near coordinates |
| POST | `/events` | Create event (event manager only) |
| POST | `/events/:id/going` | Toggle I'm Going |
| POST | `/events/:id/checkin` | Check in (validates geolocation, handles Stripe) |
| POST | `/events/:id/checkout` | Check out |
| POST | `/events/:id/heartbeat` | Update location while checked in |
| GET | `/events/:id/users` | Get compatible users at event |

### Event Feedback
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/events/feedback-request` | Create feedback request after checkout |
| GET | `/events/feedback/:token` | Get feedback form (via email link) |
| POST | `/events/feedback/:token` | Submit feedback |
| GET | `/events/event/:eventId/feedback` | Get all feedback for an event |
| GET | `/events/venue-suggestions` | Get all venue suggestions |

### Event Managers
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/event-managers/signup` | Register (invite code required) |
| POST | `/event-managers/signin` | Log in |
| GET | `/event-managers/me` | Get own manager profile |
| GET | `/event-managers/dashboard` | Get events, check-in counts, earnings |
| POST | `/event-managers/stripe/onboard` | Get Stripe Connect onboarding link |
| POST | `/event-managers/stripe/verify` | Verify Stripe onboarding completion |

### Stripe
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/stripe/webhook` | Handle Stripe webhook events |

### Health
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check (used by Docker and load balancers) |

---

## Environment Variables

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=
MONGODB_URI=mongodb+srv://...
RESEND_API_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
PHONE_ENCRYPTION_KEY=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
AWS_S3_BUCKET_NAME=
GOOGLE_PLACES_API_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
TICKET_PRICE=           # in cents, e.g. 300 = $3.00
FRONTEND_URL=https://baequests.com
SENTRY_DSN=
EVENT_MANAGER_INVITE_CODE=
```

---

## Local Development

```bash
git clone https://github.com/seydou31/se-final-project-backend.git
cd se-final-project-backend/baequest-server
npm install
npm run dev
```

Server runs at `http://localhost:3001`.

---

## Deployment

Deployed via GitHub Actions CI/CD to a GCP VM using a blue-green Docker strategy:
1. Tests and lint run on push to `main`
2. Docker image is built and uploaded as a GitHub release asset
3. SSH deploys to the VM — new container starts on the inactive port, health-checked, then nginx switches traffic over
