const mongoose = require('mongoose');
const User = require('../models/user');
const CuratedEvent = require('../models/curatedEvent');
const Profile = require('../models/profile');
const logger = require('../utils/logger');

const MANAGER_SHARE = 0.30;

/**
 * ─────────────────────────────────────────────────────────────
 * GET EVENT MANAGERS (SERVER PAGINATION)
 * ─────────────────────────────────────────────────────────────
 */
module.exports.getAdminOverview = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);
    const search = req.query.search || '';

    const skip = (page - 1) * limit;

    // Search query
    const query = {
      role: 'eventManager',
    };

    if (search) {
      query.$or = [
        {
          name: {
            $regex: search,
            $options: 'i',
          },
        },
        {
          email: {
            $regex: search,
            $options: 'i',
          },
        },
      ];
    }

    // Total managers count
    const totalManagers = await User.countDocuments(query);

    // Total regular app users (anyone who isn't an event manager)
    const totalUsers = await User.countDocuments({ role: { $ne: 'eventManager' } });

    // User insight queries — run in parallel for speed
    const [
      totalProfiles,
      verifiedUsers,
      liveNow,
      engagedResult,
      genderResult,
    ] = await Promise.all([
      // Users who completed their profile
      Profile.countDocuments(),

      // Users who verified their email
      User.countDocuments({ role: { $ne: 'eventManager' }, isEmailVerified: true }),

      // Users currently checked into an event right now
      Profile.countDocuments({ 'location.eventId': { $exists: true, $ne: null } }),

      // Distinct users who have checked in at least once (across all events)
      CuratedEvent.aggregate([
        { $unwind: '$checkedInUsers' },
        { $group: { _id: '$checkedInUsers' } },
        { $count: 'total' },
      ]),

      // Gender split across all profiles
      Profile.aggregate([
        { $group: { _id: '$gender', count: { $sum: 1 } } },
      ]),
    ]);

    // Paginated managers
    const managers = await User.find(query)
      .select('name email stripeOnboardingComplete createdAt')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const managerIds = managers.map((m) => m._id);

    /**
     * Aggregate manager event stats
     */
    const managerEventStats = await CuratedEvent.aggregate([
      {
        $match: {
          createdBy: {
            $in: managerIds,
          },
        },
      },
      {
        $group: {
          _id: '$createdBy',

          totalEvents: {
            $sum: 1,
          },

          // Earnings in cents: each event's own paid check-ins * its own ticket price
          totalEarningsCents: {
            $sum: {
              $multiply: ['$paidCheckinCount', '$ticketPrice'],
            },
          },
        },
      },
    ]);

    const statsMap = {};

    managerEventStats.forEach((stat) => {
      statsMap[stat._id.toString()] = {
        totalEvents: stat.totalEvents,

        totalEarnings:
          (stat.totalEarningsCents || 0) / 100 *
          MANAGER_SHARE,
      };
    });

    /**
     * Final managers response
     */
    const data = managers.map((manager) => {
      const managerStats = statsMap[manager._id.toString()] || {
        totalEvents: 0,
        totalEarnings: 0,
      };

      return {
        _id: manager._id,
        name: manager.name,
        email: manager.email,
        stripeOnboardingComplete:
          manager.stripeOnboardingComplete,
        createdAt: manager.createdAt,

        totalEvents: managerStats.totalEvents,

        totalEarnings: parseFloat(
          managerStats.totalEarnings.toFixed(2)
        ),
      };
    });

    /**
     * ─────────────────────────────────────────
     * GLOBAL DASHBOARD STATS
     * ─────────────────────────────────────────
     */

    // Events created by a manager (excludes legacy/seed events with no createdBy)
    const totalEvents = await CuratedEvent.countDocuments({ createdBy: { $exists: true, $ne: null } });

    // Total check-ins + earnings aggregation
    const globalResult = await CuratedEvent.aggregate([
      {
        $group: {
          _id: null,

          totalCheckins: {
            $sum: { $size: '$checkedInUsers' },
          },

          totalEarningsCents: {
            $sum: {
              $multiply: ['$paidCheckinCount', '$ticketPrice'],
            },
          },
        },
      },
    ]);

    const totalCheckins = globalResult[0]?.totalCheckins || 0;
    const totalEarnings =
      (globalResult[0]?.totalEarningsCents || 0) / 100 *
      MANAGER_SHARE;

    return res.status(200).json({
      data,

      pagination: {
        page,
        limit,
        total: totalManagers,
        totalPages: Math.ceil(totalManagers / limit),
      },

      stats: {
        totalUsers,
        totalManagers,
        totalEvents,
        totalCheckins,
        totalEarnings: parseFloat(totalEarnings.toFixed(2)),

        userInsights: {
          profileCompletion: totalUsers > 0
            ? Math.round((totalProfiles / totalUsers) * 100)
            : 0,
          verifiedUsers,
          liveNow,
          engagedUsers: engagedResult[0]?.total || 0,
          genderSplit: {
            male:   genderResult.find(g => g._id === 'male')?.count   || 0,
            female: genderResult.find(g => g._id === 'female')?.count || 0,
          },
        },
      },
    });
  } catch (err) {
    logger.error('Get admin managers error:', err);
    return next(err);
  }
};

/**
 * ─────────────────────────────────────────────────────────────
 * GET EVENTS BY MANAGER (SERVER PAGINATION)
 * ─────────────────────────────────────────────────────────────
 */
module.exports.getAdminManagerEvents = async (req, res, next) => {
  try {
    const { managerId } = req.params;

    const {
      page: pageQuery = '1',
      limit: limitQuery = '10',
      search = '',
      dateFrom,
      dateTo,
    } = req.query;

    const page = parseInt(pageQuery, 10);
    const limit = parseInt(limitQuery, 10);

    const skip = (page - 1) * limit;

    const query = {
      createdBy: new mongoose.Types.ObjectId(managerId),
    };

    // Search filter
    if (search) {
      query.name = {
        $regex: search,
        $options: 'i',
      };
    }

    // Date filter
    if (dateFrom || dateTo) {
      query.startTime = {};

      if (dateFrom) {
        query.startTime.$gte = new Date(dateFrom);
      }

      if (dateTo) {
        query.startTime.$lte = new Date(dateTo);
      }
    }

    // Total events count
    const total = await CuratedEvent.countDocuments(query);

    // Paginated events with gender split via profile lookup
    const events = await CuratedEvent.aggregate([
      { $match: query },
      { $sort: { startTime: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'profiles',
          localField: 'checkedInUsers',
          foreignField: 'owner',
          as: 'attendeeProfiles',
        },
      },
      {
        $project: {
          name: 1,
          startTime: 1,
          endTime: 1,
          city: 1,
          state: 1,
          paidCheckinCount: 1,
          ticketPrice: 1,
          totalCheckins: { $size: '$checkedInUsers' },
          genderSplit: {
            male: {
              $size: {
                $filter: {
                  input: '$attendeeProfiles',
                  cond: { $eq: ['$$this.gender', 'male'] },
                },
              },
            },
            female: {
              $size: {
                $filter: {
                  input: '$attendeeProfiles',
                  cond: { $eq: ['$$this.gender', 'female'] },
                },
              },
            },
          },
        },
      },
    ]);

    const data = events.map((event) => {
      const earnings =
        (event.paidCheckinCount || 0) *
        ((event.ticketPrice || 0) / 100) *
        MANAGER_SHARE;

      return {
        _id: event._id,
        name: event.name,
        startTime: event.startTime,
        endTime: event.endTime,
        city: event.city,
        state: event.state,
        paidCheckinCount: event.paidCheckinCount || 0,
        totalCheckins: event.totalCheckins || 0,
        genderSplit: event.genderSplit || { male: 0, female: 0 },
        earnings: parseFloat(earnings.toFixed(2)),
      };
    });

    return res.status(200).json({
      data,

      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    logger.error('Get manager events error:', err);
    return next(err);
  }
};