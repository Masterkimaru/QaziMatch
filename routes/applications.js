const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { protect, requireRole } = require('../middleware/authMiddleware');
const appCtrl = require('../controllers/applicationController');

// simple multer setup - store files in /uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = `${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    cb(null, `${base}${ext}`);
  }
});
const upload = multer({ storage });

// employees apply (upload resume) - FIXED ROUTE
router.post('/:jobId/apply', protect, requireRole('EMPLOYEE'), upload.single('resume'), appCtrl.apply);

// employer views all applications presented to them
router.get('/employer/open', protect, requireRole('EMPLOYER'), appCtrl.getOpenJobsWithApplications)

// employer views applications for job
router.get('/job/:id', protect, requireRole('EMPLOYER'), appCtrl.getApplicationsForJob);
// employee views their applications
router.get('/my', protect, requireRole('EMPLOYEE'), appCtrl.getMyApplications);

// employer selects applicant
router.post('/job/:jobId/select/:applicationId', protect, requireRole('EMPLOYER'), appCtrl.selectApplicant);

// employer marks applicant as reviewed
router.post('/job/:jobId/review/:applicationId', protect, requireRole('EMPLOYER'), appCtrl.reviewApplicant);

// employer rejects applicant
router.post('/job/:jobId/reject/:applicationId', protect, requireRole('EMPLOYER'), appCtrl.rejectApplicant);

module.exports = router;
