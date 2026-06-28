const router = require('express').Router();
const authAdmin = require('../middleware/authAdmin');

const {
  getAdminOverview,
  getAdminManagerEvents,
} = require('../controllers/admin');

// ─────────────────────────────────────────────
// ADMIN OVERVIEW
// Managers list with pagination + dashboard stats
// Query:
// ?page=1
// &limit=10
// &search=john
// ─────────────────────────────────────────────
router.get('/overview', authAdmin, getAdminOverview);

// ─────────────────────────────────────────────
// MANAGER EVENTS
// Events pagination per manager
// Query:
// ?page=1
// &limit=10
// &search=party
// &dateFrom=2026-05-01
// &dateTo=2026-05-30
// ─────────────────────────────────────────────
router.get('/manager/:managerId/events', authAdmin, getAdminManagerEvents);

module.exports = router;