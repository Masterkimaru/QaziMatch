const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// create job (employer only)
exports.createJob = async (req, res, next) => {
  try {
    const { title, description, salary, duration, contractType, requirements, meta } = req.body;
    const job = await prisma.job.create({
      data: {
        title,
        description,
        salary: salary ? Number(salary) : null,
        duration,
        contractType,
        requirements: requirements ? JSON.parse(requirements) : {},
        meta: meta ? JSON.parse(meta) : {},
        employer: { connect: { id: req.user.id } }
      }
    });
    res.status(201).json(job);
  } catch (err) { next(err); }
};

// For public job listings (employees browsing)
exports.getPublicJobs = async (req, res, next) => {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        status: 'OPEN',
        isHeadhunted: false, // ← Exclude headhunted jobs
      },
      include: {
        employer: {
          select: {
            name: true,
            
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(jobs);
  } catch (err) {
    next(err);
  }
};

// For employers to see their own jobs (including headhunted ones)
exports.getMyJobs = async (req, res, next) => {
  try {
    const jobs = await prisma.job.findMany({
      where: {
        employerId: req.user.id,
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(jobs);
  } catch (err) {
    next(err);
  }
};

exports.getJob = async (req, res, next) => {
  try {
    const job = await prisma.job.findUnique({ where: { id: req.params.id }});
    if (!job) return res.status(404).json({ message: 'Job not found' });
    res.json(job);
  } catch (err) { next(err); }
};

exports.myJobs = async (req, res, next) => {
  try {
    const jobs = await prisma.job.findMany({ where: { employerId: req.user.id }, orderBy: { createdAt: 'desc' }});
    res.json(jobs);
  } catch (err) { next(err); }
};

// set job status
exports.updateJobStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const job = await prisma.job.findUnique({ where: { id }});
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.employerId !== req.user.id) return res.status(403).json({ message: 'Forbidden' });

    const updated = await prisma.job.update({ where: { id }, data: { status }});
    res.json(updated);
  } catch (err) { next(err); }
};

// DELETE job
exports.deleteJob = async (req, res, next) => {
  try {
    const { id } = req.params;

    const job = await prisma.job.findUnique({ where: { id }});
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.employerId !== req.user.id)
      return res.status(403).json({ message: 'You are not allowed to delete this job' });

    await prisma.job.delete({ where: { id }});
    res.json({ message: 'Job deleted successfully' });
  } catch (err) {
    next(err);
  }
};


//  PATCH job (update fields)
exports.updateJobDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, salary, duration, contractType, requirements, meta } = req.body;

    const job = await prisma.job.findUnique({ where: { id }});
    if (!job) return res.status(404).json({ message: 'Job not found' });
    if (job.employerId !== req.user.id)
      return res.status(403).json({ message: 'You are not allowed to modify this job' });

    const updated = await prisma.job.update({
      where: { id },
      data: {
        title: title ?? job.title,
        description: description ?? job.description,
        salary: salary ? Number(salary) : job.salary,
        duration: duration ?? job.duration,
        contractType: contractType ?? job.contractType,
        requirements: requirements ? JSON.parse(requirements) : job.requirements,
        meta: meta ? JSON.parse(meta) : job.meta,
      }
    });

    res.json({ message: 'Job updated successfully', job: updated });
  } catch (err) {
    next(err);
  }
};