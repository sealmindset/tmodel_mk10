console.log('[LOG] index.js loaded');
const componentsRouter = require('./components.js');
const vulnerabilitiesRouter = require('./vulnerabilities.js');
const reportsRouter = require('./reports.js');
const settingsRouter = require('./settings.js');
// ...import all other routers
const refArchRouter = require('./referenceArchitecture.js');

function registerRoutes(app, deps) {
  app.use('/components', componentsRouter(deps));
  app.use('/vulnerabilities', vulnerabilitiesRouter(deps));
  app.use('/reports', reportsRouter(deps));
  app.use('/settings', settingsRouter(deps));
  app.use('/api/reference-architecture', refArchRouter(deps));
  // ...register all other routers
}

module.exports = {
  registerRoutes
};
