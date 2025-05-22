import componentsRouter from './components.js';
import vulnerabilitiesRouter from './vulnerabilities.js';
import reportsRouter from './reports.js';
import settingsRouter from './settings.js';
// ...import all other routers
import refArchRouter from './referenceArchitecture.js';

export function registerRoutes(app, deps) {
  app.use('/components', componentsRouter(deps));
  app.use('/vulnerabilities', vulnerabilitiesRouter(deps));
  app.use('/reports', reportsRouter(deps));
  app.use('/settings', settingsRouter(deps));
  app.use('/api/reference-architecture', refArchRouter(deps));
  // ...register all other routers
}
