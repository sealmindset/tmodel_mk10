// Controller for components
const { fetchAllComponents } = require('../services/componentsService.js');
function getComponents(pool) {
  return async (req, res) => {
    try {
      const components = await fetchAllComponents(pool);
      res.render('component-library', { components });
    } catch (err) {
      res.status(500).render('error', { error: err.message });
    }
  };
}

console.log('[LOG] componentsController.js loaded, exporting getComponents');
module.exports = {
  getComponents
};
