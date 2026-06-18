const User = require('../models/user');
const CuratedEvent = require('../models/curatedEvent');
const logger = require('../utils/logger');

const ticketPriceDollars = () =>
  parseInt(process.env.TICKET_PRICE || '0', 10) / 100;

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

          totalPaidCheckins: {
            $sum: '$paidCheckinCount',
          },
        },
      },
    ]);

    const statsMap = {};

    managerEventStats.forEach((stat) => {
      statsMap[stat._id.toString()] = {
        totalEvents: stat.totalEvents,

        totalEarnings:
          (stat.totalPaidCheckins || 0) *
          ticketPriceDollars() *
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

    // Overall events count
    const totalEvents = await CuratedEvent.countDocuments();

    // Total earnings aggregation
    const earningsResult = await CuratedEvent.aggregate([
      {
        $group: {
          _id: null,

          totalPaidCheckins: {
            $sum: '$paidCheckinCount',
          },
        },
      },
    ]);

    const totalPaidCheckins =
      earningsResult[0]?.totalPaidCheckins || 0;

    const totalEarnings =
      totalPaidCheckins *
      ticketPriceDollars() *
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
        totalManagers,
        totalEvents,

        totalEarnings: parseFloat(
          totalEarnings.toFixed(2)
        ),
      },
    });
  } catch (err) {
    logger.error('Get admin managers error:', err);
    next(err);
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

    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '10', 10);

    const search = req.query.search || '';
    const dateFrom = req.query.dateFrom;
    const dateTo = req.query.dateTo;

    const skip = (page - 1) * limit;

    const query = {
      createdBy: managerId,
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

    // Paginated events
    const events = await CuratedEvent.find(query)
      .sort({ startTime: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const data = events.map((event) => {
      const earnings =
        (event.paidCheckinCount || 0) *
        ticketPriceDollars() *
        MANAGER_SHARE;

      return {
        _id: event._id,
        name: event.name,
        startTime: event.startTime,
        endTime: event.endTime,
        city: event.city,
        state: event.state,

        paidCheckinCount:
          event.paidCheckinCount || 0,

        earnings: parseFloat(
          earnings.toFixed(2)
        ),
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
    next(err);
  }
};