// ThreatModelsPage.jsx
// Main page for drag-and-drop threat model merging (PostgreSQL only)
import React, { useState, useEffect, useRef } from 'react';
import ModelCard from './ModelCard';

import MergePreviewModal from './MergePreviewModal';

// --- UTILITY FUNCTIONS ---

// Normalize threats array for frontend compatibility
const parseThreatsFromModel = (text) => {
  if (!text) return [];
  const sections = text.split(/(?=## )/g);
  return sections.filter(s => s.trim()).map(s => {
    const titleMatch = s.match(/^## (.*?)(?:\n|$)/);
    const title = titleMatch ? titleMatch[1].trim() : 'Unnamed Threat';
    const content = s.replace(/^## .*?(?:\n|$)/, '').trim();
    return { title, content };
  });
};

const normalizeThreats = (model) => {
  if (Array.isArray(model.threats) && model.threats.length > 0) {
    console.log(`[LOG][normalizeThreats] Using pre-existing threats array for model ${model.id}`);
    return model.threats;
  }
  console.log(`[LOG][normalizeThreats] Parsing threats from response_text for model ${model.id}`);
  const text = model.response_text || model.response || model.text || '';
  return parseThreatsFromModel(text);
};


// Component for each selectable row in the available models table
const SelectableModelRow = ({ model, isSelected, onToggleSelect, onViewDetails }) => {
  // Format the date in a readable format
  const formattedDate = model.updated_at ? new Date(model.updated_at).toLocaleDateString() : 'Unknown';
  const title = model.title || model.name || 'Untitled Model';
  const threatCount = model.threat_count || 0;
  
  return (
    <tr className={isSelected ? 'table-active' : ''}>
      <td>
        <div className="form-check">
          <input 
            className="form-check-input" 
            type="checkbox" 
            checked={isSelected} 
            onChange={() => onToggleSelect(model)}
            id={`model-${model.id}`}
          />
          <label className="form-check-label" htmlFor={`model-${model.id}`}>
            {title}
          </label>
        </div>
      </td>
      <td>{threatCount}</td>
      <td>{formattedDate}</td>
      <td>
        <button 
          className="btn btn-sm btn-outline-secondary" 
          onClick={() => onViewDetails(model)}
        >
          <i className="bi bi-eye"></i>
        </button>
      </td>
    </tr>
  );
}

export default function ThreatModelsPage({ initialModels = null }) {
  // Model data states
  const [models, setModels] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection states
  const [selectedModelIds, setSelectedModelIds] = useState(new Set());
  const [leftModels, setLeftModels] = useState([]); // Models in the left workspace
  const [rightModels, setRightModels] = useState([]); // Models in the right workspace
  const [mergePreview, setMergePreview] = useState(null);

  useEffect(() => {
    // If we have initialModels (from EJS), use them directly
    if (initialModels) {
      console.log('Initial models received from server:', initialModels);
      setModels(initialModels);
    } else {
      // Otherwise fetch from API (standalone mode)
      console.log('No initial models, fetching from API');
      fetch('/api/threat-models/list')
        .then(response => response.json())
        .then(data => {
          console.log('API returned threat models:', data);
          Array.isArray(data) ? setModels(data) : setModels([]);
        })
        .catch(error => {
          console.error('Error fetching threat models:', error);
          setModels([]);
        });
    }
  }, [initialModels]);
  
  // Debug log whenever models change
  useEffect(() => {
    console.log('Current models state:', models);
  }, [models]);

  // Handle selecting and deselecting models from the available models list
  function toggleModelSelection(model) {
    const newSelectedIds = new Set(selectedModelIds);
    
    if (newSelectedIds.has(model.id)) {
      // Remove from selection
      newSelectedIds.delete(model.id);
      // Also remove from workspace if present
      setWorkspaceModels(workspaceModels.filter(m => m.id !== model.id));
    } else {
      // Add to selection
      newSelectedIds.add(model.id);
    }
    
    setSelectedModelIds(newSelectedIds);
  }
  
  // Handle adding selected models to the workspace
  function addToWorkspace() {
    const modelsToAdd = models.filter(model => selectedModelIds.has(model.id) &&
      !leftModels.some(m => m.id === model.id) && !rightModels.some(m => m.id === model.id));
    if (modelsToAdd.length > 0) {
      setLeftModels([...leftModels, ...modelsToAdd]);
    }
  }
  
  // Handle removing models from the workspace
  function removeFromLeft(modelId) {
    setLeftModels(leftModels.filter(model => model.id !== modelId));
  }
  function removeFromRight(modelId) {
    setRightModels(rightModels.filter(model => model.id !== modelId));
  }
  
  // Handle clearing all models from workspace
  function clearWorkspace() {
    setLeftModels([]);
    setRightModels([]);
  }
  
  // Move a model from left to right
  function moveToRight(modelId) {
    const model = leftModels.find(m => m.id === modelId);
    if (!model) return;
    setLeftModels(leftModels.filter(m => m.id !== modelId));
    setRightModels([...rightModels, model]);
  }
  // Move a model from right to left
  function moveToLeft(modelId) {
    const model = rightModels.find(m => m.id === modelId);
    if (!model) return;
    setRightModels(rightModels.filter(m => m.id !== modelId));
    setLeftModels([...leftModels, model]);
  }

  // Helper to fetch full model details by ID
  async function fetchModelDetails(id) {
    try {
      const res = await fetch(`/api/threat-models/${id}`);
      if (!res.ok) throw new Error('Failed to fetch model details');
      return await res.json();
    } catch (err) {
      console.error('Error fetching model details:', err);
      return null;
    }
  }

  // Handle merge button click
  async function handleMerge() {
    if (leftModels.length !== 1 || rightModels.length !== 1) {
      alert('Please select exactly one primary (left) and one source (right) model for merging.');
      return;
    }

    console.log('[LOG][handleMerge] Initiating merge...');
    setMergePreview({ loading: true });

    try {
      console.log(`[LOG][handleMerge] Fetching details for Primary: ${leftModels[0].id} and Source: ${rightModels[0].id}`);
      const [primary, source] = await Promise.all([
        fetchModelDetails(leftModels[0].id),
        fetchModelDetails(rightModels[0].id)
      ]);
      console.log('[LOG][handleMerge] Fetched data:', { primary, source });

      // CRITICAL: Create deep copies to prevent any state mutation
      const primaryCopy = JSON.parse(JSON.stringify(primary));
      const sourceCopy = JSON.parse(JSON.stringify(source));
      console.log('[LOG][handleMerge] Created deep copies of models.');

      // Normalize threats using the external utility functions
      primaryCopy.threats = normalizeThreats(primaryCopy);
      sourceCopy.threats = normalizeThreats(sourceCopy);
      console.log('[LOG][handleMerge] Normalized threats for both models:', {
        primaryThreatCount: primaryCopy.threats.length,
        sourceThreatCount: sourceCopy.threats.length
      });

      // Final check before setting state
      console.log('[LOG][handleMerge] Final data being sent to MergePreviewModal:', {
        primary: primaryCopy,
        sources: [sourceCopy]
      });

      // Set the preview data for the modal
      setMergePreview({
        primary: primaryCopy,
        sources: [sourceCopy]
      });

    } catch (err) {
      console.error('[ERROR][handleMerge] Failed to prepare merge preview:', err);
      alert('Error loading model details for merge preview. Check console for details.');
      setMergePreview(null);
    }
  }

  // Filter models based on search term
  const filteredModels = models.filter(model => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const title = (model.title || model.name || '').toLowerCase();
    const description = (model.description || '').toLowerCase();
    return title.includes(term) || description.includes(term);
  });
  
  return (
    <div className="threat-models-page mb-5">
      <div className="mb-4">
        <h3>
          <i className="bi bi-diagram-3 me-2"></i>
          Threat Model Merge Tool
        </h3>
        <div className="bg-light p-3 rounded-3 mb-4">
          <div className="d-flex align-items-center">
            <i className="bi bi-info-circle text-primary me-2 fs-5"></i>
            <div>
              <strong>How to merge threat models:</strong>
              <ol className="mb-0 ps-3">
                <li>Select models from the Available Models table</li>
                <li>Click "Add to Workspace" to move them to the <b>left panel</b></li>
                <li>Use the <b>arrow button</b> to move one model to the <b>right panel</b></li>
                <li>Click the <b>center merge button</b> to preview and merge</li>
              </ol>
              <div className="mt-2 text-muted small">Drag-and-drop is no longer used. All actions are explicit and button-driven.</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="row">
        {/* Left Panel: Available Models */}
        <div className="col-lg-6 mb-4">
          <div className="card shadow-sm">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-table me-2"></i>
                Available Threat Models
              </h5>
              <div className="input-group input-group-sm" style={{ maxWidth: '250px' }}>
                <span className="input-group-text">
                  <i className="bi bi-search"></i>
                </span>
                <input 
                  type="text" 
                  className="form-control" 
                  placeholder="Search models..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button 
                    className="btn btn-outline-secondary" 
                    type="button" 
                    onClick={() => setSearchTerm('')}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                )}
              </div>
            </div>
            
            <div className="card-body p-0">
              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <table className="table table-hover table-striped mb-0">
                  <thead className="table-light sticky-top">
                    <tr>
                      <th>Name</th>
                      <th>Threats</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredModels.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center py-3">
                          <i className="bi bi-exclamation-circle me-2"></i>
                          No threat models found matching your search criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredModels.map(model => (
                        <SelectableModelRow
                          key={model.id}
                          model={model}
                          isSelected={selectedModelIds.has(model.id)}
                          onToggleSelect={toggleModelSelection}
                          onViewDetails={() => {}}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card-footer d-flex justify-content-between align-items-center">
              <div>
                <small className="text-muted">{selectedModelIds.size} models selected</small>
              </div>
              <button 
                className="btn btn-primary" 
                onClick={addToWorkspace}
                disabled={selectedModelIds.size === 0}
              >
                <i className="bi bi-plus-circle me-1"></i>
                Add to Workspace
              </button>
            </div>
          </div>
        </div>
        
        {/* Right Panel: Split Workspace UI */}
        <div className="col-lg-6">
          <div className="card shadow-sm">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">
                <i className="bi bi-grid me-2"></i>
                Workspace
              </h5>
              <button 
                className="btn btn-sm btn-outline-secondary" 
                onClick={clearWorkspace}
                disabled={leftModels.length + rightModels.length === 0}
              >
                <i className="bi bi-trash me-1"></i>
                Clear
              </button>
            </div>
            <div className="card-body">
              <div className="row align-items-center" style={{ minHeight: '400px' }}>
                {/* Left panel */}
                <div className="col-5 border-end">
                  <h6 className="text-center">Left (Primary)</h6>
                  {leftModels.length === 0 ? (
                    <div className="text-muted text-center py-4">No models</div>
                  ) : (
                    leftModels.map(model => (
                      <div className="mb-2" key={model.id}>
                        <ModelCard
                          model={model}
                          onRemove={() => removeFromLeft(model.id)}
                          showRemoveButton={true}
                          mergePreviewActive={!!mergePreview}
                        />
                        <div className="d-flex justify-content-center">
                          <button className="btn btn-sm btn-outline-primary mt-1" onClick={() => moveToRight(model.id)} disabled={rightModels.length > 0}>
                            <i className="bi bi-arrow-right"></i>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {/* Arrow button */}
                <div className="col-2 d-flex flex-column align-items-center justify-content-center">
                  <button className="btn btn-success" style={{ fontSize: '2rem' }} onClick={handleMerge} disabled={!(leftModels.length === 1 && rightModels.length === 1)}>
                    <i className="bi bi-arrow-left-right"></i>
                  </button>
                  <div className="my-2"></div>
                  {rightModels.length === 1 && (
                    <button className="btn btn-sm btn-outline-secondary" onClick={() => moveToLeft(rightModels[0].id)}>
                      <i className="bi bi-arrow-left"></i>
                    </button>
                  )}
                </div>
                {/* Right panel */}
                <div className="col-5">
                  <h6 className="text-center">Right (Source)</h6>
                  {rightModels.length === 0 ? (
                    <div className="text-muted text-center py-4">No models</div>
                  ) : (
                    rightModels.map(model => (
                      <div className="mb-2" key={model.id}>
                        <ModelCard
                          model={model}
                          onRemove={() => removeFromRight(model.id)}
                          showRemoveButton={true}
                          mergePreviewActive={!!mergePreview}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <MergePreviewModal preview={mergePreview} onClose={() => setMergePreview(null)} />
      
      {/* Drag hint in workspace header instead of an overlay */}

    </div>
  );
}
