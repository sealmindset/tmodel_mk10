/**
 * Standalone Safeguard Report Application
 * 
 * This is a standalone application for the safeguard report feature
 * that can run independently without affecting the main application.
 */

const express = require('express');
const path = require('path');
const app = express();
const bodyParser = require('body-parser');
const ejs = require('ejs');

// Configure environment variables
require('dotenv').config();

// Configure middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Import mock services
const projectService = require('./services/projectService');
const threatModelService = require('./services/threatModelService.modified');
const safeguardReportService = require('./services/safeguardReportService.modified');
const analyticsService = require('./services/analyticsService');

// Load the routes
const safeguardRoutes = require('./routes/safeguardReport.modified');

// Project selection page (Root route)
app.get('/', (req, res) => {
  res.render('safeguard-project-selection');
});

// Register safeguard routes without authentication
app.use('/safeguard-report', safeguardRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(`Error: ${err.message}`);
  console.error(err.stack);
  res.status(500).send('Something went wrong!');
});

// Start the server on a different port
const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Safeguard Report App is running on http://localhost:${PORT}`);
  console.log(`Visit http://localhost:${PORT} to view the project selection page`);
});
