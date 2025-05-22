/**
 * Component Loader
 * 
 * This script ensures React components are properly loaded before they're used.
 * It provides a safe way to render components only when all dependencies are available.
 */

(function() {
  // Create a global namespace for our component loader
  window.ComponentLoader = {
    // Track loaded components
    loadedComponents: {},
    
    // Register a component as loaded
    registerComponent: function(name, component) {
      this.loadedComponents[name] = component;
      console.log(`Component registered: ${name}`);
      
      // Trigger any pending renders for this component
      this.triggerPendingRenders(name);
    },
    
    // Check if a component is loaded
    isComponentLoaded: function(name) {
      return !!this.loadedComponents[name];
    },
    
    // Get a loaded component
    getComponent: function(name) {
      return this.loadedComponents[name];
    },
    
    // Pending renders waiting for components to load
    pendingRenders: {},
    
    // Register a pending render
    registerPendingRender: function(componentName, container, props) {
      if (!this.pendingRenders[componentName]) {
        this.pendingRenders[componentName] = [];
      }
      
      this.pendingRenders[componentName].push({
        container: container,
        props: props
      });
    },
    
    // Trigger pending renders for a component
    triggerPendingRenders: function(componentName) {
      if (!this.pendingRenders[componentName]) {
        return;
      }
      
      const component = this.getComponent(componentName);
      if (!component) {
        return;
      }
      
      this.pendingRenders[componentName].forEach(render => {
        try {
          ReactDOM.render(
            React.createElement(component, render.props),
            render.container
          );
        } catch (error) {
          console.error(`Error rendering ${componentName}:`, error);
          render.container.innerHTML = `<div class="alert alert-danger">Error rendering ${componentName}: ${error.message}</div>`;
        }
      });
      
      // Clear pending renders for this component
      this.pendingRenders[componentName] = [];
    },
    
    // Safely render a component
    render: function(componentName, container, props) {
      // Make sure React and ReactDOM are available
      if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
        console.error('React or ReactDOM is not available');
        container.innerHTML = '<div class="alert alert-warning">Unable to load component. React is not available.</div>';
        return;
      }
      
      // Check if the component is loaded
      if (this.isComponentLoaded(componentName)) {
        // Component is loaded, render it
        try {
          ReactDOM.render(
            React.createElement(this.getComponent(componentName), props),
            container
          );
        } catch (error) {
          console.error(`Error rendering ${componentName}:`, error);
          container.innerHTML = `<div class="alert alert-danger">Error rendering ${componentName}: ${error.message}</div>`;
        }
      } else {
        // Component is not loaded yet, register a pending render
        console.log(`Component ${componentName} not loaded yet, registering pending render`);
        container.innerHTML = '<div class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading...</span></div></div>';
        this.registerPendingRender(componentName, container, props);
      }
    }
  };
})();
