const router = require('express').Router();
const authAdmin = require('../middleware/authAdmin');
const { getAdminOverview } = require('../controllers/admin');

router.get('/overview', authAdmin, getAdminOverview);

module.exports = router;
