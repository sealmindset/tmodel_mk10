// ThreatModelsPage.jsx
// Main page for drag-and-drop threat model merging (PostgreSQL only)
import React, { useState, useEffect, useRef } from 'react';
import ModelCard from './ModelCard';
import ModelContentModal from './ModelContentModal';
import MergePreviewModal from './MergePreviewModal';

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
  const [workspaceModels, setWorkspaceModels] = useState([]);
  
  // Drag and drop states
  const [isDragging, setIsDragging] = useState(false);
  const [selected, setSelected] = useState([]);
  const dragSourceRef = useRef(null); // Reference to track the current drag source model
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalModel, setModalModel] = useState(null);
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
                                  !workspaceModels.some(m => m.id === model.id));
    
    if (modelsToAdd.length > 0) {
      setWorkspaceModels([...workspaceModels, ...modelsToAdd]);
    }
  }
  
  // Handle removing models from the workspace
  function removeFromWorkspace(modelId) {
    setWorkspaceModels(workspaceModels.filter(model => model.id !== modelId));
  }
  
  // Handle clearing all models from workspace
  function clearWorkspace() {
    setWorkspaceModels([]);
  }
  
  // Drag and drop handlers for the workspace
  function handleDragStart(model) {
    console.log('Drag started with model:', model.title);
    setSelected([model]);
    setIsDragging(true);
    // Store the current drag source in ref for easier access
    dragSourceRef.current = model;
    
    // Debug info
    console.log('Drag source model stored in ref:', model.id, model.title);
  }
  
  function handleDragEnd() {
    console.log('Drag ended');
    setIsDragging(false);
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

  async function handleDrop(targetModel, sourceModelFromEvent) {
    setIsDragging(false);
    console.log('[ThreatModelsPage] Drop detected on model:', targetModel.title, targetModel.id);
    
    // Get the source model - prefer the one from our ref but fall back to the one from the event
    const sourceModel = dragSourceRef.current || sourceModelFromEvent;
    
    if (!sourceModel) {
      console.error('[ThreatModelsPage] No source model found for drop operation');
      alert('Error: Unable to determine which model you are trying to merge from. Please try again.');
      return;
    }
    
    if (sourceModel.id === targetModel.id) {
      console.log('[ThreatModelsPage] Cannot merge a model with itself');
      alert('Cannot merge a model with itself. Please drag onto a different model.');
      return;
    }

    // Show loading state in the modal
    setMergePreview({ loading: true });

    try {
      // Fetch full details for both models in parallel
      const [primary, source] = await Promise.all([
        fetchModelDetails(targetModel.id),
        fetchModelDetails(sourceModel.id)
      ]);
      if (!primary || !source) {
        alert('Failed to load full model details for merge preview.');
        setMergePreview(null);
        return;
      }
      setMergePreview({
        primary,
        sources: [source]
      });
    } catch (err) {
      alert('Error loading model details for merge preview.');
      setMergePreview(null);
    }
    dragSourceRef.current = null;
  }

  function handleCardHover(model) {
    // Only show the hover modal when not dragging
    if (!isDragging) {
      setModalModel(model);
      setShowModal(!!model);
    }
  }
  
  /* Remove duplicate filteredModels */

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
                <li>Click "Add to Workspace" to move them to the Workspace area</li>
                <li>Drag one model card onto another in the Workspace to merge them</li>
                <li>Select which threats to include in the merged model</li>
              </ol>
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
                          onViewDetails={(model) => {
                            setModalModel(model);
                            setShowModal(true);
                          }}
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
        
        {/* Right Panel: Workspace for Drag and Drop */}
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
                disabled={workspaceModels.length === 0}
              >
                <i className="bi bi-trash me-1"></i>
                Clear
              </button>
            </div>
            
            <div className="card-body">
              <div
  className={`workspace-area p-3 border rounded ${isDragging ? 'dragging-active' : ''}`}
  style={{ minHeight: '400px' }}
  onDrop={e => { console.log('[WorkspaceArea] Top-level drop event fired'); e.preventDefault(); }}
  onDragOver={e => { console.log('[WorkspaceArea] Top-level dragOver event fired'); e.preventDefault(); }}
>
                {workspaceModels.length === 0 ? (
                  <div className="text-center text-muted p-5">
                    <i className="bi bi-arrow-left-right display-4 mb-3"></i>
                    <p>Select models from the Available Models list and add them to this workspace for merging.</p>
                  </div>
                ) : (
                  <div className="row row-cols-1 row-cols-md-2 g-3">
                    {workspaceModels.map(model => (
                      <div className="col" key={model.id}>
                        <ModelCard
                          model={model}
                          onDragStart={() => handleDragStart(model)}
                          onDragEnd={handleDragEnd}
                          onDrop={(_evt, sourceModelFromEvent) => handleDrop(model, sourceModelFromEvent)}
                          onRemove={() => removeFromWorkspace(model.id)}
                          onHover={handleCardHover}
                          showRemoveButton={true}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <ModelContentModal show={showModal} model={modalModel} onHide={() => setShowModal(false)} />
      <MergePreviewModal preview={mergePreview} onClose={() => setMergePreview(null)} />
      
      {/* Drag hint in workspace header instead of an overlay */}
      {isDragging && (
        <div className="workspace-drag-hint position-fixed bottom-0 start-50 translate-middle-x mb-3 p-2 bg-info text-white rounded shadow-sm">
          <small>
            <i className="bi bi-info-circle me-1"></i>
            Drop onto another model card to merge
          </small>
        </div>
      )}
    </div>
  );
}
