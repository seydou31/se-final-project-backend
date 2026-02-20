const crypto = require('crypto');
const EventFeedback = require('../models/eventFeedback');
const Event = require('../models/event');
const User = require('../models/user');
const { sendFeedbackRequestEmail } = require('../utils/email');
const { BadRequestError, NotFoundError } = require('../utils/customErrors');

/**
 * Create feedback request and send email
 * Called after user checks out from event
 */
module.exports.createFeedbackRequest = async (req, res, next) => {
  try {
    const { eventId } = req.body;
    const userId = req.user._id;

    // Check if event exists
    const event = await Event.findById(eventId);
    if (!event) {
      throw new NotFoundError('Event not found');
    }

    // Check if feedback request already exists
    const existingFeedback = await EventFeedback.findOne({ userId, eventId });
    if (existingFeedback) {
      // Don't send duplicate emails
      return res.status(200).json({ message: 'Feedback request already sent' });
    }

    // Generate unique token
    const token = crypto.randomBytes(32).toString('hex');

    // Create feedback request (expires in 7 days)
    const feedbackRequest = await EventFeedback.create({
      userId,
      eventId,
      token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      emailSent: false,
    });

    // Get user email
    const user = await User.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Create feedback URL
    const feedbackUrl = `${process.env.FRONTEND_URL}/event-feedback?token=${token}`;

    // Format event details for email
    const eventDetails = {
      name: event.title,
      date: new Date(event.date).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }),
      location: event.location?.address || event.location?.name || 'Location TBD',
    };

    // Send feedback email
    await sendFeedbackRequestEmail(user.email, feedbackUrl, eventDetails);

    // Update feedback request
    feedbackRequest.emailSent = true;
    feedbackRequest.emailSentAt = new Date();
    await feedbackRequest.save();

    return res.status(201).json({
      message: 'Feedback request sent successfully',
      feedbackRequestId: feedbackRequest._id,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Get feedback request by token (for displaying event info on feedback page)
 */
module.exports.getFeedbackRequest = async (req, res, next) => {
  try {
    const { token } = req.params;

    const feedbackRequest = await EventFeedback.findOne({ token })
      .populate('eventId', 'title date location city state')
      .populate('userId', 'email');

    if (!feedbackRequest) {
      throw new NotFoundError('Feedback request not found or expired');
    }

    // Check if already submitted
    if (feedbackRequest.submitted) {
      return res.status(400).json({
        error: 'Feedback already submitted',
        message: 'Thank you! You have already submitted feedback for this event.',
      });
    }

    // Check if expired
    if (feedbackRequest.expiresAt < new Date()) {
      return res.status(400).json({
        error: 'Feedback request expired',
        message: 'This feedback link has expired. Feedback requests expire 7 days after checkout.',
      });
    }

    // Place-based feedback
    if (feedbackRequest.placeId) {
      return res.status(200).json({
        placeId: feedbackRequest.placeId,
        eventName: feedbackRequest.placeName,
        eventDate: feedbackRequest.createdAt,
        eventLocation: feedbackRequest.placeAddress || 'N/A',
      });
    }

    // Event-based feedback
    return res.status(200).json({
      eventId: feedbackRequest.eventId._id,
      eventName: feedbackRequest.eventId.title,
      eventDate: feedbackRequest.eventId.date,
      eventLocation: feedbackRequest.eventId.location?.address || feedbackRequest.eventId.location?.name || 'Location TBD',
      city: feedbackRequest.eventId.city,
      state: feedbackRequest.eventId.state,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * Submit event feedback
 */
module.exports.submitFeedback = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { rating, comment, venueSuggestion } = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
      throw new BadRequestError('Rating must be between 1 and 5');
    }

    // Find feedback request
    const feedbackRequest = await EventFeedback.findOne({ token });

    if (!feedbackRequest) {
      throw new NotFoundError('Feedback request not found or expired');
    }

    // Check if already submitted
    if (feedbackRequest.submitted) {
      throw new BadRequestError('Feedback already submitted for this event');
    }

    // Check if expired
    if (feedbackRequest.expiresAt < new Date()) {
      throw new BadRequestError('Feedback request has expired');
    }

    // Update feedback
    feedbackRequest.rating = rating;
    feedbackRequest.comment = comment || '';
    feedbackRequest.submitted = true;
    feedbackRequest.submittedAt = new Date();

    // Add venue suggestion if provided
    if (venueSuggestion && venueSuggestion.name) {
      feedbackRequest.venueSuggestion = {
        name: venueSuggestion.name,
        address: venueSuggestion.address || '',
        city: venueSuggestion.city || '',
        state: venueSuggestion.state || '',
        type: venueSuggestion.type || 'other',
        reason: venueSuggestion.reason || '',
      };
    }

    await feedbackRequest.save();

    res.status(200).json({
      message: 'Thank you for your feedback!',
      feedback: {
        rating: feedbackRequest.rating,
        hasVenueSuggestion: !!feedbackRequest.venueSuggestion?.name,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all feedback for an event (admin/analytics)
 */
module.exports.getEventFeedback = async (req, res, next) => {
  try {
    const { eventId } = req.params;

    const feedbacks = await EventFeedback.find({
      eventId,
      submitted: true,
    }).select('rating comment venueSuggestion submittedAt');

    // Calculate average rating
    const avgRating = feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
      : 0;

    // Count venue suggestions
    const venueSuggestions = feedbacks.filter(f => f.venueSuggestion?.name);

    res.status(200).json({
      totalFeedbacks: feedbacks.length,
      averageRating: avgRating.toFixed(1),
      venueSuggestionsCount: venueSuggestions.length,
      feedbacks,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get all venue suggestions (for discovering new venues)
 */
module.exports.getAllVenueSuggestions = async (req, res, next) => {
  try {
    const suggestions = await EventFeedback.find({
      submitted: true,
      'venueSuggestion.name': { $exists: true, $ne: '' },
    })
      .select('venueSuggestion eventId submittedAt')
      .populate('eventId', 'city state')
      .sort({ submittedAt: -1 });

    res.status(200).json({
      count: suggestions.length,
      suggestions: suggestions.map(s => ({
        name: s.venueSuggestion.name,
        address: s.venueSuggestion.address,
        city: s.venueSuggestion.city || s.eventId?.city,
        state: s.venueSuggestion.state || s.eventId?.state,
        type: s.venueSuggestion.type,
        reason: s.venueSuggestion.reason,
        submittedAt: s.submittedAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};
