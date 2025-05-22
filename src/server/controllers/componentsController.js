// Controller for components
import { fetchAllComponents } from '../services/componentsService.js';
export function getComponents(pool) {
  return async (req, res) => {
    try {
      const components = await fetchAllComponents(pool);
      res.render('component-library', { components });
    } catch (err) {
      res.status(500).render('error', { error: err.message });
    }
  };
}
