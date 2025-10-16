const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const nodemailer = require("nodemailer");

// Gmail transporter setup
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS, // use your app password
  },
});

// employer creates headhunt request with embedded job creation
exports.createRequest = async (req, res, next) => {
  try {
    const {
      // Job details (NEW - required for creating the private job)
      title,
      description,
      salary,
      duration,
      contractType,
      requirements,
      meta,
      
      // Headhunt request details
      companyName,
      contactEmail,
      contactPhone,
      otherContacts,
      urgency,
      preferredContactMethod,
      notes,
    } = req.body;

    // Validation for job details
    if (!title) return res.status(400).json({ message: 'Job title is required' });
    if (!description) return res.status(400).json({ message: 'Job description is required' });
    if (!contractType) return res.status(400).json({ message: 'Contract type is required' });
    
    // Validation for headhunt request details
    if (!companyName) return res.status(400).json({ message: 'Company name is required' });
    if (!contactEmail && !contactPhone)
      return res.status(400).json({ message: 'Provide contactEmail or contactPhone' });

    // Create both job and headhunt request in a single transaction
    const result = await prisma.$transaction(async (prisma) => {
      // 1. Create the private job (automatically marked as headhunted)
      const job = await prisma.job.create({
        data: {
          title,
          description,
          salary: salary ? Number(salary) : null,
          duration,
          contractType,
          requirements: requirements ? (typeof requirements === 'string' ? JSON.parse(requirements) : requirements) : {},
          meta: meta ? (typeof meta === 'string' ? JSON.parse(meta) : meta) : {},
          employer: { connect: { id: req.user.id } },
          isHeadhunted: true, // Mark as headhunted from creation
          status: 'OPEN'
        }
      });

      // 2. Create the headhunt request linked to the new job
      const headhuntRequest = await prisma.headhuntRequest.create({
        data: {
          job: { connect: { id: job.id } },
          employer: { connect: { id: req.user.id } },
          companyName,
          contactEmail,
          contactPhone: contactPhone || null,
          otherContacts: otherContacts ? (typeof otherContacts === 'string' ? JSON.parse(otherContacts) : otherContacts) : null,
          urgency: urgency || 'MEDIUM',
          preferredContactMethod: preferredContactMethod || null,
          notes,
        },
      });

      return { job, headhuntRequest };
    });

    // Build email to internal inbox
    const internalMailOptions = {
        from: `"Headhunt System" <${process.env.GMAIL_USER}>`,
        to: process.env.COMPANY_INBOX,
        subject: `New Headhunt Request — ${companyName} — ${result.headhuntRequest.id}`,
        html: `
            <!DOCTYPE html>
            <html>
            <head>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
                
                body {
                font-family: 'Inter', Arial, sans-serif;
                line-height: 1.6;
                color: #2c3e50;
                margin: 0;
                padding: 0;
                background-color: #f8fafc;
                }
                
                .email-container {
                max-width: 600px;
                margin: 0 auto;
                background: #ffffff;
                border-radius: 12px;
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
                }
                
                .email-header {
                background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
                color: white;
                padding: 30px;
                text-align: center;
                animation: fadeInDown 0.6s ease-out;
                }
                
                .email-header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
                letter-spacing: -0.5px;
                }
                
                .email-badge {
                display: inline-block;
                background: rgba(255, 255, 255, 0.2);
                padding: 6px 16px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 500;
                margin-top: 12px;
                backdrop-filter: blur(10px);
                }
                
                .email-content {
                padding: 40px;
                animation: fadeInUp 0.6s ease-out 0.3s both;
                }
                
                .info-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 20px;
                margin-bottom: 30px;
                }
                
                .info-card {
                background: #f8fafc;
                padding: 20px;
                border-radius: 8px;
                border-left: 4px solid #1e3a8a;
                transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                
                .info-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(30, 58, 138, 0.1);
                }
                
                .info-card.full-width {
                grid-column: 1 / -1;
                }
                
                .info-label {
                font-size: 12px;
                font-weight: 600;
                color: #64748b;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 6px;
                display: block;
                }
                
                .info-value {
                font-size: 16px;
                font-weight: 500;
                color: #1e293b;
                margin: 0;
                }
                
                .job-details-section {
                background: #eff6ff;
                padding: 24px;
                border-radius: 8px;
                border: 1px solid #bfdbfe;
                margin: 30px 0;
                }
                
                .job-details-label {
                font-size: 14px;
                font-weight: 600;
                color: #1e40af;
                margin-bottom: 12px;
                display: block;
                }
                
                .notes-section {
                background: #f1f5f9;
                padding: 24px;
                border-radius: 8px;
                border: 1px solid #e2e8f0;
                margin: 30px 0;
                }
                
                .notes-label {
                font-size: 14px;
                font-weight: 600;
                color: #475569;
                margin-bottom: 12px;
                display: block;
                }
                
                .notes-content {
                color: #334155;
                line-height: 1.7;
                white-space: pre-wrap;
                }
                
                .urgency-badge {
                display: inline-flex;
                align-items: center;
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                font-weight: 600;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                }
                
                .urgency-high {
                background: #fef2f2;
                color: #dc2626;
                border: 1px solid #fecaca;
                }
                
                .urgency-medium {
                background: #fffbeb;
                color: #d97706;
                border: 1px solid #fed7aa;
                }
                
                .urgency-low {
                background: #f0fdf4;
                color: #16a34a;
                border: 1px solid #bbf7d0;
                }
                
                .urgency-asap {
                background: #fef2f2;
                color: #dc2626;
                border: 1px solid #fecaca;
                animation: pulse 2s infinite;
                }
                
                .cta-button {
                display: inline-block;
                background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
                color: white;
                padding: 14px 32px;
                text-decoration: none;
                border-radius: 8px;
                font-weight: 600;
                font-size: 14px;
                text-align: center;
                transition: all 0.3s ease;
                box-shadow: 0 2px 4px rgba(30, 58, 138, 0.2);
                margin-top: 20px;
                }
                
                .cta-button:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(30, 58, 138, 0.3);
                }
                
                .email-footer {
                text-align: center;
                padding: 30px;
                background: #f8fafc;
                color: #64748b;
                font-size: 12px;
                border-top: 1px solid #e2e8f0;
                }
                
                @keyframes fadeInDown {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
                }
                
                @keyframes fadeInUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
                }
                
                @keyframes pulse {
                0% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.05);
                }
                100% {
                    transform: scale(1);
                }
                }
                
                @media (max-width: 600px) {
                .info-grid {
                    grid-template-columns: 1fr;
                }
                
                .email-content {
                    padding: 24px;
                }
                }
            </style>
            </head>
            <body>
            <div class="email-container">
                <div class="email-header">
                <h1>New Private Headhunt Request</h1>
                <div class="email-badge">Request ID: ${result.headhuntRequest.id}</div>
                </div>
                
                <div class="email-content">
                <div class="info-grid">
                    <div class="info-card">
                    <span class="info-label">Employer User ID</span>
                    <p class="info-value">${req.user.id}</p>
                    </div>
                    
                    <div class="info-card">
                    <span class="info-label">Private Job ID</span>
                    <p class="info-value">${result.job.id}</p>
                    </div>
                    
                    <div class="info-card">
                    <span class="info-label">Company</span>
                    <p class="info-value">${companyName}</p>
                    </div>
                    
                    <div class="info-card">
                    <span class="info-label">Contact Email</span>
                    <p class="info-value">${contactEmail || 'N/A'}</p>
                    </div>
                    
                    <div class="info-card">
                    <span class="info-label">Contact Phone</span>
                    <p class="info-value">${contactPhone || 'N/A'}</p>
                    </div>
                    
                    <div class="info-card">
                    <span class="info-label">Urgency</span>
                    <p class="info-value">
                        <span class="urgency-badge urgency-${(result.headhuntRequest.urgency?.toLowerCase() || 'medium')}">
                        ${result.headhuntRequest.urgency}
                        </span>
                    </p>
                    </div>
                    
                    <div class="info-card full-width">
                    <span class="info-label">Preferred Contact Method</span>
                    <p class="info-value">${result.headhuntRequest.preferredContactMethod || 'N/A'}</p>
                    </div>

                    <div class="info-card full-width">
                    <span class="info-label">Job Status</span>
                    <p class="info-value">
                        <strong>✓ Private Job Created</strong> - This job is exclusively handled by headhunting services and not visible to public browsing
                    </p>
                    </div>
                </div>
                
                <div class="job-details-section">
                    <span class="job-details-label">📋 Job Details</span>
                    <div class="info-grid">
                        <div class="info-card">
                            <span class="info-label">Job Title</span>
                            <p class="info-value">${title}</p>
                        </div>
                        <div class="info-card">
                            <span class="info-label">Contract Type</span>
                            <p class="info-value">${contractType}</p>
                        </div>
                        <div class="info-card">
                            <span class="info-label">Salary</span>
                            <p class="info-value">${salary ? `KSH${salary}` : 'Not specified'}</p>
                        </div>
                        <div class="info-card">
                            <span class="info-label">Duration</span>
                            <p class="info-value">${duration || 'Not specified'}</p>
                        </div>
                        <div class="info-card full-width">
                            <span class="info-label">Description</span>
                            <p class="info-value">${description}</p>
                        </div>
                    </div>
                </div>
                
                ${notes ? `
                <div class="notes-section">
                    <span class="notes-label">Additional Notes</span>
                    <div class="notes-content">${notes.replace(/\n/g, '<br/>')}</div>
                </div>
                ` : ''}
                
                <div style="text-align: center;">
                    <a href="${process.env.ADMIN_URL || '#'}" class="cta-button">
                    Review Request in Admin Panel
                    </a>
                </div>
                </div>
                
                <div class="email-footer">
                <p>This email was automatically generated by the Headhunt System</p>
                <p>© ${new Date().getFullYear()} qazimatch.com. All rights reserved.</p>
                </div>
            </div>
            </body>
            </html>
        `,
    };

    // NEW: Build confirmation email to user
    const userConfirmationMailOptions = {
      from: `"QaziMatch Headhunt Team" <${process.env.GMAIL_USER}>`,
      to: contactEmail, // Send to the user who submitted the request
      subject: `Headhunt Request Received - QaziMatch`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
            
            body {
              font-family: 'Inter', Arial, sans-serif;
              line-height: 1.6;
              color: #2c3e50;
              margin: 0;
              padding: 0;
              background-color: #f8fafc;
            }
            
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            
            .email-header {
              background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
              color: white;
              padding: 30px;
              text-align: center;
            }
            
            .email-header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
              letter-spacing: -0.5px;
            }
            
            .email-content {
              padding: 40px;
            }
            
            .confirmation-message {
              text-align: center;
              margin-bottom: 30px;
            }
            
            .confirmation-message h2 {
              color: #1e3a8a;
              margin-bottom: 16px;
            }
            
            .confirmation-message p {
              font-size: 16px;
              color: #4b5563;
              margin-bottom: 12px;
            }
            
            .next-steps {
              background: #f0f9ff;
              padding: 24px;
              border-radius: 8px;
              border-left: 4px solid #1e3a8a;
              margin: 30px 0;
            }
            
            .next-steps h3 {
              color: #1e3a8a;
              margin-top: 0;
              margin-bottom: 16px;
            }
            
            .next-steps ul {
              margin: 0;
              padding-left: 20px;
            }
            
            .next-steps li {
              margin-bottom: 8px;
              color: #4b5563;
            }
            
            .contact-info {
              background: #f8fafc;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              margin: 30px 0;
            }
            
            .email-footer {
              text-align: center;
              padding: 30px;
              background: #f8fafc;
              color: #64748b;
              font-size: 12px;
              border-top: 1px solid #e2e8f0;
            }
            
            @media (max-width: 600px) {
              .email-content {
                padding: 24px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-header">
              <h1>Headhunt Request Received</h1>
            </div>
            
            <div class="email-content">
              <div class="confirmation-message">
                <h2>Thank You for Your Headhunt Request!</h2>
                <p>Dear ${companyName},</p>
                <p>We have successfully received your headhunt request and our team has been notified.</p>
                <p><strong>Someone from the QaziMatch team will be in touch with you shortly to discuss your requirements further.</strong></p>
              </div>
              
              <div class="next-steps">
                <h3>What Happens Next?</h3>
                <ul>
                  <li>Our headhunting specialists will review your requirements</li>
                  <li>We'll contact you to discuss the position in more detail</li>
                  <li>We'll begin searching for suitable candidates</li>
                  <li>We'll provide regular updates on our progress</li>
                </ul>
              </div>
              
              <div class="contact-info">
                <p><strong>Need immediate assistance?</strong></p>
                <p>If you have any urgent questions, please don't hesitate to contact us.</p>
              </div>
            </div>
            
            <div class="email-footer">
              <p>This email was automatically generated by the QaziMatch Headhunt System</p>
              <p>© ${new Date().getFullYear()} qazimatch.com. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    // Send both emails
    try {
      // Send internal email (existing functionality)
      await transporter.sendMail(internalMailOptions);
      await prisma.headhuntRequest.update({
        where: { id: result.headhuntRequest.id },
        data: { notified: true },
      });

      // NEW: Send user confirmation email (only if contactEmail exists)
      if (contactEmail) {
        await transporter.sendMail(userConfirmationMailOptions);
      }
    } catch (mailErr) {
      console.error('Failed to send email notifications:', mailErr);
      // Don't fail the entire request if email fails
    }

    res.status(201).json({
      job: result.job,
      headhuntRequest: result.headhuntRequest,
      message: 'Private headhunt job and request created successfully. This job is not publicly visible and will be handled exclusively by our headhunting service.'
    });
  } catch (err) {
    next(err);
  }
};
// list headhunt requests for employer
exports.myRequests = async (req, res, next) => {
  try {
    const list = await prisma.headhuntRequest.findMany({ where: { employerId: req.user.id }, orderBy: { createdAt: 'desc' }});
    res.json(list);
  } catch (err) { next(err); }
};

// assign a recruiter (set assignedTo)
exports.assign = async (req, res, next) => {
  try {
    const { id } = req.params; // headhunt request id
    const { assignedTo } = req.body; // recruiter id (string) or external id
    const updated = await prisma.headhuntRequest.update({ where: { id }, data: { assignedTo, status: 'IN_PROGRESS' }});
    res.json(updated);
  } catch (err) { next(err); }
};


// fulfill: mark headhunt request as fulfilled (internal or external) + email company inbox
exports.fulfill = async (req, res, next) => {
  try {
    const { id } = req.params; // headhunt request id
    const { applicationId, candidateName, notes } = req.body;

    // Fetch the headhunt request + job details
    const request = await prisma.headhuntRequest.findUnique({
      where: { id },
      include: { job: true },
    });

    if (!request)
      return res.status(404).json({ message: 'Headhunt request not found' });

        //  NEW CHECK: Prevent re-fulfillment of already fulfilled requests
    if (request.status === 'FULFILLED') {
      return res.status(400).json({
        message: 'This headhunt request has already been fulfilled.',
        existingCandidate: request.candidateName || 'External candidate',
        existingApplicationId: request.fulfilledApplicationId,
        fulfilledAt: request.fulfilledAt
      });
    }

    //  Check if job has already been filled
    const existingFulfilled = await prisma.headhuntRequest.findFirst({
      where: {
        jobId: request.jobId,
        status: 'FULFILLED',
        NOT: { id: request.id }, // exclude this request itself
      },
    });

    if (existingFulfilled) {
      return res.status(400).json({
        message: 'This job has already been fulfilled by another candidate.',
      });
    }

    //  Prepare update payload
    const updateData = {
      status: 'FULFILLED',
      fulfilledAt: new Date(),
      notes: notes || request.notes,
    };

    let candidateDisplayName = null;
    let usedVia = 'external candidate';

    //  Internal application case
    if (applicationId) {
      usedVia = 'internal application';
      const application = await prisma.application.findUnique({
        where: { id: applicationId },
        include: { applicant: { select: { name: true, email: true } } },
      });

      if (!application)
        return res.status(404).json({ message: 'Application not found' });

      // mark as headhunted
      await prisma.application.update({
        where: { id: applicationId },
        data: { isHeadhunted: true },
      });

      updateData.fulfilledApplicationId = applicationId;
      candidateDisplayName =
        application.applicant?.name || application.applicant?.email || 'Applicant';
    } else if (candidateName) {
      //  External candidate case
      updateData.candidateName = candidateName;
      candidateDisplayName = candidateName;
    } else {
      candidateDisplayName = 'N/A';
    }

    //  Update headhunt request
    const updated = await prisma.headhuntRequest.update({
      where: { id },
      data: updateData,
    });

    // Update the job’s status to FILLED
    await prisma.job.update({
      where: { id: request.jobId },
      data: { status: 'FILLED' },
    });
    // 5) Send professional notification email
    const companyEmail = process.env.COMPANY_INBOX;
    if (companyEmail) {
      const subject = `Headhunt Request Fulfilled — ${request.companyName || 'Company'}`;
      const adminLink = process.env.ADMIN_URL || '#';
      
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
            
            body {
              font-family: 'Inter', Arial, sans-serif;
              line-height: 1.6;
              color: #2c3e50;
              margin: 0;
              padding: 0;
              background-color: #f8fafc;
            }
            
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
            }
            
            .email-header {
              background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
              color: white;
              padding: 30px;
              text-align: center;
              animation: fadeInDown 0.6s ease-out;
            }
            
            .email-header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: 600;
              letter-spacing: -0.5px;
            }
            
            .success-badge {
              display: inline-flex;
              align-items: center;
              background: rgba(34, 197, 94, 0.2);
              color: #16a34a;
              padding: 8px 16px;
              border-radius: 20px;
              font-size: 14px;
              font-weight: 600;
              margin-top: 12px;
              border: 1px solid rgba(34, 197, 94, 0.3);
            }
            
            .email-content {
              padding: 40px;
              animation: fadeInUp 0.6s ease-out 0.3s both;
            }
            
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
            }
            
            .info-card {
              background: #f8fafc;
              padding: 20px;
              border-radius: 8px;
              border-left: 4px solid #1e3a8a;
              transition: transform 0.3s ease, box-shadow 0.3s ease;
            }
            
            .info-card:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(30, 58, 138, 0.1);
            }
            
            .info-card.full-width {
              grid-column: 1 / -1;
            }
            
            .info-label {
              font-size: 12px;
              font-weight: 600;
              color: #64748b;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 6px;
              display: block;
            }
            
            .info-value {
              font-size: 16px;
              font-weight: 500;
              color: #1e293b;
              margin: 0;
            }
            
            .fulfillment-badge {
              display: inline-flex;
              align-items: center;
              padding: 8px 16px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            
            .fulfillment-internal {
              background: #f0fdf4;
              color: #16a34a;
              border: 1px solid #bbf7d0;
            }
            
            .fulfillment-external {
              background: #eff6ff;
              color: #2563eb;
              border: 1px solid #bfdbfe;
            }
            
            .notes-section {
              background: #f1f5f9;
              padding: 24px;
              border-radius: 8px;
              border: 1px solid #e2e8f0;
              margin: 30px 0;
            }
            
            .notes-label {
              font-size: 14px;
              font-weight: 600;
              color: #475569;
              margin-bottom: 12px;
              display: block;
            }
            
            .notes-content {
              color: #334155;
              line-height: 1.7;
              white-space: pre-wrap;
            }
            
            .cta-button {
              display: inline-block;
              background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
              color: white;
              padding: 14px 32px;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 14px;
              text-align: center;
              transition: all 0.3s ease;
              box-shadow: 0 2px 4px rgba(30, 58, 138, 0.2);
              margin-top: 20px;
            }
            
            .cta-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(30, 58, 138, 0.3);
            }
            
            .email-footer {
              text-align: center;
              padding: 30px;
              background: #f8fafc;
              color: #64748b;
              font-size: 12px;
              border-top: 1px solid #e2e8f0;
            }
            
            .candidate-highlight {
              background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
              border: 1px solid #bbf7d0;
              border-radius: 8px;
              padding: 20px;
              margin: 20px 0;
            }
            
            @keyframes fadeInDown {
              from {
                opacity: 0;
                transform: translateY(-20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(20px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            
            @keyframes successPulse {
              0% {
                box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4);
              }
              70% {
                box-shadow: 0 0 0 10px rgba(34, 197, 94, 0);
              }
              100% {
                box-shadow: 0 0 0 0 rgba(34, 197, 94, 0);
              }
            }
            
            @media (max-width: 600px) {
              .info-grid {
                grid-template-columns: 1fr;
              }
              
              .email-content {
                padding: 24px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="email-header">
              <h1>Headhunt Request Fulfilled</h1>
              <div class="success-badge" style="animation: successPulse 2s infinite;">
                ✅ Successfully Completed
              </div>
            </div>
            
            <div class="email-content">
              <div class="candidate-highlight">
                <div style="text-align: center;">
                  <h3 style="margin: 0 0 8px 0; color: #065f46;">Candidate Match Found!</h3>
                  <p style="margin: 0; color: #047857; font-weight: 500;">${candidateDisplayName}</p>
                </div>
              </div>
              
              <div class="info-grid">
                <div class="info-card">
                  <span class="info-label">Request ID</span>
                  <p class="info-value">${request.id}</p>
                </div>
                
                <div class="info-card">
                  <span class="info-label">Job ID</span>
                  <p class="info-value">${request.jobId}</p>
                </div>
                
                <div class="info-card">
                  <span class="info-label">Company</span>
                  <p class="info-value">${request.companyName}</p>
                </div>
                
                <div class="info-card">
                  <span class="info-label">Fulfilled Via</span>
                  <p class="info-value">
                    <span class="fulfillment-badge fulfillment-${usedVia === 'internal application' ? 'internal' : 'external'}">
                      ${usedVia}
                    </span>
                  </p>
                </div>
                
                <div class="info-card full-width">
                  <span class="info-label">Candidate / Applicant</span>
                  <p class="info-value" style="font-size: 18px; font-weight: 600; color: #065f46;">${candidateDisplayName}</p>
                </div>
              </div>
              
              ${updateData.notes ? `
              <div class="notes-section">
                <span class="notes-label">Fulfillment Notes</span>
                <div class="notes-content">${(updateData.notes || 'N/A').replace(/\n/g, '<br/>')}</div>
              </div>
              ` : ''}
              
              <div style="text-align: center;">
                <a href="${adminLink}" class="cta-button">
                  Review Details in Admin Panel
                </a>
              </div>
            </div>
            
            <div class="email-footer">
              <p>This fulfillment notification was automatically generated by the Headhunt System</p>
              <p>© ${new Date().getFullYear()} qazimatch.com. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const mailOptions = {
        from: `"Headhunt System" <${process.env.GMAIL_USER}>`,
        to: companyEmail,
        subject,
        html
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (mailErr) {
        console.error('Failed to send fulfillment notification email:', mailErr);
      }
    }

    // 6) return success
    res.json({
      message: 'Headhunt request fulfilled successfully.',
      fulfilledVia: usedVia,
      headhuntRequest: updated,
    });
  } catch (err) {
    next(err);
  }
};
