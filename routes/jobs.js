const express = require('express');
const router = express.Router();
const jobCtrl = require('../controllers/jobController');
const { protect, requireRole } = require('../middleware/authMiddleware');

// public
router.get('/', jobCtrl.getPublicJobs);

// employer protected routes
router.get('/my', protect, requireRole('EMPLOYER'), jobCtrl.getMyJobs);
router.post('/', protect, requireRole('EMPLOYER'), jobCtrl.createJob);
router.put('/:id/status', protect, requireRole('EMPLOYER'), jobCtrl.updateJobStatus);
router.patch('/:id', protect, requireRole('EMPLOYER'), jobCtrl.updateJobDetails);
router.delete('/:id', protect, requireRole('EMPLOYER'), jobCtrl.deleteJob);

// always comes last to avoid route conflicts
router.get('/:id', jobCtrl.getJob);

module.exports = router;
