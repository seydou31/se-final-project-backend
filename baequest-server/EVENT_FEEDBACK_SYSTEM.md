# Event Feedback System

## Overview

The Event Feedback System allows users to provide feedback about events they attended and suggest new venues for future BaeQuest events. Feedback requests are sent via email after users check out from an event.

**Key Features**:
- ⭐ Star ratings (1-5)
- 💬 Optional comments
- 📍 Venue suggestions with details
- 📧 Email-based system with unique tokens
- ⏰ 7-day expiration for feedback requests
- 🔒 One feedback per user per event

---

## User Flow

```
1. User attends event
2. User checks out from event
   ↓
3. System sends feedback email
   ↓
4. User clicks email link
   ↓
5. User submits feedback (rating + optional comment + optional venue suggestion)
   ↓
6. Feedback stored in database
   ↓
7. Admins can view aggregated feedback and venue suggestions
```

---

## Database Schema

### EventFeedback Model

```javascript
{
  userId: ObjectId,           // User who attended the event
  eventId: ObjectId,          // Event that was attended
  token: String,              // Unique token for email link (hashed)

  // Feedback data
  rating: Number,             // 1-5 stars (required)
  comment: String,            // Optional comment (max 500 chars)

  // Venue suggestion (optional)
  venueSuggestion: {
    name: String,             // Venue name (max 100 chars)
    address: String,          // Street address (max 200 chars)
    city: String,             // City (max 100 chars)
    state: String,            // State (max 50 chars)
    type: String,             // Enum: restaurant, cafe, bar, park, museum, venue, other
    reason: String,           // Why this venue is great (max 300 chars)
  },

  // Status tracking
  submitted: Boolean,         // Whether feedback has been submitted
  submittedAt: Date,          // When feedback was submitted
  emailSent: Boolean,         // Whether email was sent
  emailSentAt: Date,          // When email was sent
  expiresAt: Date,            // Token expiration (7 days from event)

  timestamps: true            // createdAt, updatedAt
}
```

### Indexes

```javascript
// One feedback per user per event
{ userId: 1, eventId: 1 } - unique

// Fast token lookup
{ token: 1 }

// Get all feedback for an event
{ eventId: 1 }

// Filter by rating
{ rating: 1 }

// Filter submitted vs pending
{ submitted: 1 }

// Auto-delete expired requests (TTL index)
{ expiresAt: 1 } - expireAfterSeconds: 0
```

---

## API Endpoints

### 1. Create Feedback Request (POST /events/feedback-request)

**Auth**: Required
**Called**: Automatically after checkout

**Request Body**:
```json
{
  "eventId": "507f1f77bcf86cd799439011"
}
```

**Response** (201):
```json
{
  "message": "Feedback request sent successfully",
  "feedbackRequestId": "507f1f77bcf86cd799439011"
}
```

**Process**:
1. Checks if event exists
2. Checks if feedback already requested
3. Generates unique token
4. Creates feedback request (expires in 7 days)
5. Sends email with feedback link
6. Updates feedback request as email sent

---

### 2. Get Feedback Request (GET /events/feedback/:token)

**Auth**: Not required (accessed via email link)
**Purpose**: Display event info on feedback form

**Response** (200):
```json
{
  "eventId": "507f1f77bcf86cd799439011",
  "eventName": "Coffee & Connections",
  "eventDate": "2026-01-20T18:00:00.000Z",
  "eventLocation": "123 Main St, New York, NY",
  "city": "New York",
  "state": "NY"
}
```

**Error Responses**:
- 400: Feedback already submitted
- 400: Feedback request expired
- 404: Feedback request not found

---

### 3. Submit Feedback (POST /events/feedback/:token)

**Auth**: Not required (accessed via email link)

**Request Body**:
```json
{
  "rating": 5,
  "comment": "Great event! Met amazing people.",
  "venueSuggestion": {
    "name": "The Coffee House",
    "address": "456 Park Ave",
    "city": "New York",
    "state": "NY",
    "type": "cafe",
    "reason": "Great atmosphere, affordable prices, central location"
  }
}
```

**Response** (200):
```json
{
  "message": "Thank you for your feedback!",
  "feedback": {
    "rating": 5,
    "hasVenueSuggestion": true
  }
}
```

**Validation**:
- Rating: Required, 1-5
- Comment: Optional, max 500 characters
- Venue Suggestion: Optional, but if provided name is required

---

### 4. Get Event Feedback (GET /events/event/:eventId/feedback)

**Auth**: Required
**Purpose**: View all feedback for a specific event (analytics)

**Response** (200):
```json
{
  "totalFeedbacks": 15,
  "averageRating": "4.3",
  "venueSuggestionsCount": 5,
  "feedbacks": [
    {
      "rating": 5,
      "comment": "Excellent event!",
      "venueSuggestion": {
        "name": "The Coffee House",
        "type": "cafe",
        "reason": "Great atmosphere"
      },
      "submittedAt": "2026-01-21T10:30:00.000Z"
    }
  ]
}
```

---

### 5. Get All Venue Suggestions (GET /events/venue-suggestions)

**Auth**: Required
**Purpose**: Discover new venues suggested by users

**Response** (200):
```json
{
  "count": 12,
  "suggestions": [
    {
      "name": "The Coffee House",
      "address": "456 Park Ave",
      "city": "New York",
      "state": "NY",
      "type": "cafe",
      "reason": "Great atmosphere, affordable prices",
      "submittedAt": "2026-01-21T10:30:00.000Z"
    }
  ]
}
```

---

## Email Template

### Subject
```
How was your BaeQuest experience at [Event Name]?
```

### Content

- Personalized greeting
- Event details (name, date, location)
- Request for feedback:
  - Star rating (1-5)
  - Comments about experience
  - **Venue suggestions**
- Unique feedback link
- Expiration notice (7 days)
- Thank you message

### Design
- Clean, modern HTML email
- Responsive design
- BaeQuest branding (#ff3b6c pink)
- Clear call-to-action button
- Professional layout

---

## Frontend - Feedback Submission Page

### Route
`/event-feedback?token={unique_token}`

### Components

**EventFeedbackPage.jsx**:
- Fetches event details by token
- Star rating selector (1-5)
- Comment textarea (500 char limit)
- Venue suggestion form (optional, collapsible)
- Form validation
- Loading states
- Success/error states
- Auto-redirect after submission

### Venue Suggestion Form Fields

1. **Venue Name** (required if suggesting)
   - Text input, max 100 chars

2. **Address** (optional)
   - Text input, max 200 chars

3. **City** (optional)
   - Text input, max 100 chars

4. **State** (optional)
   - Text input, max 50 chars

5. **Type of Venue** (dropdown)
   - Restaurant
   - Café
   - Bar/Lounge
   - Park/Outdoor Space
   - Museum/Gallery
   - Event Venue
   - Other

6. **Why is this venue great?** (optional)
   - Textarea, max 300 chars

---

## Implementation Details

### Backend

**Files Created**:
1. `models/eventFeedback.js` - Database model
2. `controllers/eventFeedback.js` - Business logic
3. `routes/eventFeedback.js` - API routes
4. `utils/email.js` - Added `sendFeedbackRequestEmail()` function

**Files Modified**:
1. `controllers/event.js` - Added feedback request to checkout
2. `routes/index.js` - Integrated feedback routes

### Frontend

**Files Created**:
1. `components/EventFeedbackPage.jsx` - Feedback submission page
2. `blocks/event-feedback.css` - Styling

**Files Modified**:
1. `components/App.jsx` - Added feedback route

---

## Security Considerations

### Token Security
- Unique 32-byte random token per feedback request
- Tokens stored in database
- 7-day expiration enforced
- One-time use (marked as submitted)
- No authentication required (token acts as auth)

### Input Validation
- Rating: 1-5 range enforced
- All text fields have max length limits
- Comment: 500 chars
- Venue name: 100 chars
- Address: 200 chars
- Reason: 300 chars

### Duplicate Prevention
- Unique index on `{ userId, eventId }`
- Prevents multiple feedback requests for same user/event
- Already submitted check before allowing submission

### Privacy
- Users can optionally provide feedback
- Email addresses not exposed in feedback
- Venue suggestions are attributed to event, not individual user (when viewing)

---

## Usage Examples

### For Users

1. **Attend an Event**
   - Check in to event
   - Participate
   - Check out when leaving

2. **Receive Feedback Email**
   - Sent automatically after checkout
   - Contains unique link
   - Valid for 7 days

3. **Submit Feedback**
   - Click email link
   - Rate event (1-5 stars)
   - Add optional comment
   - Optionally suggest a venue
   - Submit

### For Admins

1. **View Event Feedback**
   ```javascript
   GET /events/event/{eventId}/feedback
   ```
   - See all ratings and comments
   - Calculate average rating
   - Review venue suggestions

2. **Discover New Venues**
   ```javascript
   GET /events/venue-suggestions
   ```
   - Browse all user-suggested venues
   - Filter by city, state, or type
   - Use suggestions to plan future events

---

## Analytics & Insights

### Event Performance
- Average rating per event
- Total feedback count
- Comment themes (manual review)
- Venue suggestion rate

### Venue Discovery
- Most suggested venue types
- Geographic distribution of suggestions
- Popular venue characteristics

### User Engagement
- Feedback submission rate
- Average time to submit
- Venue suggestion participation

---

## Future Enhancements

### Potential Features

1. **Automated Venue Research**
   - Automatically look up suggested venues
   - Verify addresses with Google Places API
   - Add to venue database for future events

2. **Feedback Reminders**
   - Send reminder email if no feedback after 3 days
   - Maximum 1 reminder per event

3. **User Badges/Rewards**
   - "Feedback Champion" for users who consistently provide feedback
   - "Venue Scout" for users who suggest venues that get used

4. **Advanced Analytics**
   - Sentiment analysis on comments
   - Venue suggestion heatmap
   - Correlation between ratings and event characteristics

5. **Public Reviews**
   - Display average ratings on event listings
   - Show anonymous comments (with moderation)
   - Build trust and transparency

6. **Venue Voting**
   - Allow users to upvote suggested venues
   - Prioritize highly-voted venues for future events

---

## Testing

### Unit Tests Needed

1. **Model Tests**
   - Feedback creation
   - Token uniqueness
   - Expiration logic
   - Validation rules

2. **Controller Tests**
   - Create feedback request
   - Get feedback request
   - Submit feedback
   - Duplicate prevention
   - Expiration handling

3. **Email Tests**
   - Email sending success
   - Email template rendering
   - Error handling

### Integration Tests Needed

1. **Complete Flow**
   - Checkout → Email sent → Feedback submitted
   - Token validation
   - Duplicate submission prevention

2. **Edge Cases**
   - Expired token
   - Invalid token
   - Already submitted
   - Missing required fields

---

## Monitoring

### Metrics to Track

1. **Email Delivery**
   - Feedback emails sent
   - Email delivery rate
   - Email open rate (if tracked)
   - Link click rate

2. **Feedback Submission**
   - Feedback submission rate (% of emails sent)
   - Average rating across all events
   - Venue suggestion rate
   - Time to submit (from email sent)

3. **Errors**
   - Email send failures
   - Invalid token attempts
   - Expired token accesses

### Logging

**Important Events**:
- Feedback request created
- Email sent
- Email send failure
- Feedback submitted
- Invalid/expired token attempt
- Duplicate submission attempt

---

## Troubleshooting

### Common Issues

**1. Users not receiving feedback emails**
- Check email service (Resend) status
- Verify email address is correct
- Check spam folder
- Review email send logs

**2. Feedback link expired**
- 7-day expiration is intentional
- Users can contact support if needed
- Consider extending expiration period

**3. Cannot submit feedback**
- Verify token is valid
- Check if already submitted
- Ensure rating is provided
- Check network connection

**4. Duplicate feedback requests**
- Check unique index on userId + eventId
- Review checkout logic
- Verify feedback request creation logic

---

## Configuration

### Environment Variables

**Backend** (`.env`):
```bash
# Email service
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=noreply@baequests.com

# Frontend URL (for email links)
FRONTEND_URL=https://baequests.com
```

**Frontend** (`.env.production`):
```bash
# API base URL
VITE_API_BASE_URL=https://api.baequests.com
```

---

## Best Practices

### For Development

1. **Always test email flow in staging**
2. **Mock email service in tests**
3. **Use descriptive error messages**
4. **Log important events**
5. **Handle email send failures gracefully**

### For Production

1. **Monitor email delivery rate**
2. **Review feedback regularly**
3. **Act on venue suggestions**
4. **Respond to low ratings**
5. **Thank users for feedback**

---

## API Response Examples

### Success Response - Feedback Submitted
```json
{
  "message": "Thank you for your feedback!",
  "feedback": {
    "rating": 5,
    "hasVenueSuggestion": true
  }
}
```

### Error Response - Already Submitted
```json
{
  "error": "Feedback already submitted",
  "message": "Thank you! You have already submitted feedback for this event."
}
```

### Error Response - Expired Token
```json
{
  "error": "Feedback request expired",
  "message": "This feedback link has expired. Feedback requests expire 7 days after the event."
}
```

### Error Response - Invalid Token
```json
{
  "error": "Feedback request not found or expired"
}
```

---

## Summary

The Event Feedback System provides:
- ✅ Easy feedback collection via email
- ✅ Star ratings and comments
- ✅ Venue discovery through user suggestions
- ✅ Secure token-based access
- ✅ Automatic expiration
- ✅ Professional email templates
- ✅ Clean, responsive feedback form
- ✅ Analytics and insights

**Benefits**:
- Improve event quality based on feedback
- Discover new venues from local experts (users)
- Build trust through transparency
- Engage users after events
- Data-driven decision making

---

**Created**: January 25, 2026
**Version**: 1.0
**Status**: Production Ready ✅
