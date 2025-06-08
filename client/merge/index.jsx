import React from 'react';
import ReactDOM from 'react-dom/client';
import ThreatModelsPage from './ThreatModelsPage';

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('React merge UI initializing...');
  
  // Find the appropriate root element in either standalone or hybrid mode
  const rootElement = document.getElementById('react-merge-ui-root');
  
  if (!rootElement) {
    console.error('Could not find root element for React merge UI!');
    return;
  }
  
  // Check if we have initial data from EJS
  let initialData = [];
  try {
    initialData = window.__INITIAL_DATA__ || [];
    console.log(`Loaded ${initialData.length} threat models for merge UI`);
  } catch (err) {
    console.error('Error loading initial data:', err);
  }

  // Create and render the React root
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <ThreatModelsPage initialModels={initialData} />
      </React.StrictMode>
    );
    console.log('React merge UI successfully rendered');
  } catch (err) {
    console.error('Error rendering React merge UI:', err);
  }
});
