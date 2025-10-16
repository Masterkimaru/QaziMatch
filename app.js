require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require("cors");


const authRoutes = require('./routes/auth');
const jobRoutes = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const headhuntRoutes = require('./routes/headhunt');

const { errorHandler, notFound } = require('./middleware/errorMiddleware');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// serve uploads statically (resumes)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// routes
app.use('/api/auth', authRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/headhunt', headhuntRoutes);

// health
app.get('/', (req, res) => res.send('Kazi Job  platform backend is running'));

// 404 & error handlers
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Qazi Platform Server running on port ${PORT}`);
});
