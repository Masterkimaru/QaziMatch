const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/authMiddleware');
const ctrl = require('../controllers/headhuntController');

router.post('/', protect, requireRole('EMPLOYER'), ctrl.createRequest);
router.get('/my', protect, requireRole('EMPLOYER'), ctrl.myRequests);
router.put('/:id/assign', protect, requireRole('EMPLOYER'), ctrl.assign);
router.put('/:id/fulfill', protect, requireRole('EMPLOYER'), ctrl.fulfill);

module.exports = router;
