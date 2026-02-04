const router = require('express').Router();
const auth = require('../middleware/auth');
const {
  createFeedbackRequest,
  getFeedbackRequest,
  submitFeedback,
  getEventFeedback,
  getAllVenueSuggestions,
} = require('../controllers/eventFeedback');

// Create feedback request (called after checkout) - requires auth
router.post('/feedback-request', auth, createFeedbackRequest);

// Get feedback request by token (public - accessed via email link)
router.get('/feedback/:token', getFeedbackRequest);

// Submit feedback (public - accessed via email link)
router.post('/feedback/:token', submitFeedback);

// Get all feedback for an event (requires auth)
router.get('/event/:eventId/feedback', auth, getEventFeedback);

// Get all venue suggestions (requires auth - for admins/event creators)
router.get('/venue-suggestions', auth, getAllVenueSuggestions);

module.exports = router;
