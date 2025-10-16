const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');
const path = require('path');

// apply to a job (employee)
exports.apply = async (req, res, next) => {
  try {
    const { jobId } = req.params; // Changed from 'id' to 'jobId'
    const { coverLetter, extras } = req.body;

    if (!jobId) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ message: "Job ID is required" });
    }

    // Step 1: Check if job exists and isn't headhunted
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ message: "Job not found" });
    }

    if (job.isHeadhunted) {
      if (req.file) {
        const filePath = path.resolve(req.file.path);
        fs.unlink(filePath, (err) => {
          if (err) console.warn("Failed to delete unused resume:", err.message);
        });
      }
      return res.status(403).json({ 
        message: "This job is exclusively handled by our headhunting service and not accepting public applications" 
      });
    }

    // Step 2: Check if user already applied
    const existingApplication = await prisma.application.findFirst({
      where: {
        jobId,
        applicantId: req.user.id,
      },
    });

    if (existingApplication) {
      // delete the uploaded resume if any
      if (req.file) {
        const filePath = path.resolve(req.file.path);
        fs.unlink(filePath, (err) => {
          if (err) console.warn("Failed to delete unused resume:", err.message);
        });
      }

      return res
        .status(400)
        .json({ message: "You have already applied to this job" });
    }

    // Step 3: Parse extras safely
    let parsedExtras = {};
    try {
      if (extras) parsedExtras = JSON.parse(extras);
    } catch {
      parsedExtras = {};
    }

    // Step 4: Continue to create application
    const resumeUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const application = await prisma.application.create({
      data: {
        job: { connect: { id: jobId } },
        applicant: { connect: { id: req.user.id } },
        resumeUrl,
        coverLetter: coverLetter || "",
        extras: parsedExtras,
      },
    });

    res.status(201).json(application);
  } catch (err) {
    console.error("Job application error:", err);

    // delete uploaded file if DB failed
    if (req.file) {
      fs.unlink(req.file.path, () => {});
    }

    // Prisma known errors
    if (err.code === "P2025") {
      return res.status(404).json({ message: "Job not found" });
    }

    res.status(500).json({
      message: "Something went wrong while applying for the job. Please try again later.",
      fallback: true,
    });
  }
};


// employer: list applications for a job
exports.getApplicationsForJob = async (req, res, next) => {
  try {
    const { id: jobId } = req.params;
    const job = await prisma.job.findUnique({ where: { id: jobId }});
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.employerId !== req.user.id) return res.status(403).json({ message: 'Forbidden' });

    const applications = await prisma.application.findMany({
      where: { jobId },
      orderBy: { appliedAt: 'desc' }
    });
    res.json(applications);
  } catch (err) { next(err); }
};

// employer selects an application
exports.selectApplicant = async (req, res, next) => {
  try {
    const { jobId, applicationId } = req.params;

    // 1. Find the job
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.employerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 2. Check that the application exists and belongs to this job
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.jobId !== jobId) {
      return res.status(400).json({
        message: 'Application does not belong to this job',
      });
    }

    // 3. Mark the chosen application as ACCEPTED
    await prisma.application.update({
      where: { id: applicationId },
      data: { status: 'ACCEPTED' },
    });

    // 4.Mark all other applications for the same job as REJECTED
    await prisma.application.updateMany({
      where: { jobId, id: { not: applicationId } },
      data: { status: 'REJECTED' },
    });

    // 5. Mark the job as FILLED
    await prisma.job.update({
      where: { id: jobId },
      data: { status: 'FILLED' },
    });

    return res.json({ message: 'Applicant selected successfully' });
  } catch (err) {
    console.error('Select applicant error:', err);

    // Handle specific Prisma error codes gracefully
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Record not found for update' });
    }

    return res.status(500).json({
      message: 'Something went wrong while selecting applicant.',
      error: err.message,
    });
  }
};

// employer rejects a specific application
exports.rejectApplicant = async (req, res, next) => {
  try {
    const { jobId, applicationId } = req.params;

    // 1. Find the job and verify ownership
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.employerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 2. Check that the application exists and belongs to this job
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.jobId !== jobId) {
      return res.status(400).json({
        message: 'Application does not belong to this job',
      });
    }

    // 3. Check if application is already accepted
    if (application.status === 'ACCEPTED') {
      return res.status(400).json({
        message: 'Cannot reject an already accepted application',
      });
    }

    // 4. Mark the application as REJECTED
    const updatedApplication = await prisma.application.update({
      where: { id: applicationId },
      data: { status: 'REJECTED' },
    });

    return res.json({ 
      message: 'Application rejected successfully',
      application: updatedApplication 
    });
  } catch (err) {
    console.error('Reject applicant error:', err);

    // Handle specific Prisma error codes
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Record not found for update' });
    }

    return res.status(500).json({
      message: 'Something went wrong while rejecting application.',
      error: err.message,
    });
  }
};

// employer marks application as reviewed
exports.reviewApplicant = async (req, res, next) => {
  try {
    const { jobId, applicationId } = req.params;

    // 1. Find the job and verify ownership
    const job = await prisma.job.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      return res.status(404).json({ message: 'Job not found' });
    }

    if (job.employerId !== req.user.id) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 2. Check that the application exists and belongs to this job
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.jobId !== jobId) {
      return res.status(400).json({
        message: 'Application does not belong to this job',
      });
    }

    // 3. Check if application is already accepted or rejected
    if (application.status === 'ACCEPTED') {
      return res.status(400).json({
        message: 'Cannot mark an already accepted application as reviewed',
      });
    }

    // 4. Mark the application as REVIEWED
    const updatedApplication = await prisma.application.update({
      where: { id: applicationId },
      data: { status: 'REVIEWED' },
    });

    return res.json({ 
      message: 'Application marked as reviewed successfully',
      application: updatedApplication 
    });
  } catch (err) {
    console.error('Review applicant error:', err);

    // Handle specific Prisma error codes
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Record not found for update' });
    }

    return res.status(500).json({
      message: 'Something went wrong while marking application as reviewed.',
      error: err.message,
    });
  }
};

// employer: view all their OPEN jobs and corresponding applications
exports.getOpenJobsWithApplications = async (req, res, next) => {
  try {
    // 1.Get all OPEN jobs belonging to this employer
    const jobs = await prisma.job.findMany({
      where: {
        employerId: req.user.id,
        status: 'OPEN',
      },
      include: {
        applications: {
          orderBy: { appliedAt: 'desc' },
          include: {
            applicant: {
              select: {
                id: true,
                name: true,
                email: true,
                // add more fields if needed (like profilePic)
              },
            },
          },
        },
      },
    });

    // 2. Return a clean structured response
    res.json({
      count: jobs.length,
      jobs: jobs.map((job) => ({
        id: job.id,
        title: job.title,
        status: job.status,
        createdAt: job.createdAt,
        applicationsCount: job.applications.length,
        applications: job.applications,
      })),
    });
  } catch (err) {
    console.error('Error fetching open jobs with applications:', err);
    res.status(500).json({
      message: 'Failed to retrieve open jobs and applications',
      error: err.message,
    });
  }
};

// employee: view their own applications
exports.getMyApplications = async (req, res, next) => {
  try {
    const applications = await prisma.application.findMany({
      where: {
        applicantId: req.user.id,
      },
      orderBy: {
        appliedAt: 'desc',
      },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            status: true,
            createdAt: true,
            employer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    res.json({
      count: applications.length,
      applications: applications.map(app => ({
        id: app.id,
        status: app.status,
        appliedAt: app.appliedAt,
        resumeUrl: app.resumeUrl,
        coverLetter: app.coverLetter,
        extras: app.extras,
        job: {
          id: app.job.id,
          title: app.job.title,
          status: app.job.status,
          postedAt: app.job.createdAt,
          employer: {
            id: app.job.employer.id,
            name: app.job.employer.name || 'Anonymous Employer',
          },
        },
      })),
    });
  } catch (err) {
    console.error('Error fetching my applications:', err);
    res.status(500).json({
      message: 'Failed to retrieve your applications',
    });
  }
};

