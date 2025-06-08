// ModelCard.jsx
// Draggable card for a single threat model
import React, { useState } from 'react';

export default function ModelCard({ model, onDragStart, onDragEnd, onDrop, onClick, onHover, onRemove, showRemoveButton = false }) {
  const [isDraggedOver, setIsDraggedOver] = useState(false);
  const [dragId] = useState(`drag-${Math.random().toString(36).substr(2, 9)}`);
  
  // Format the date in a readable format
  const formattedDate = model.updated_at ? new Date(model.updated_at).toLocaleDateString() : 'Unknown';

  // Safely handle missing fields
  const title = model.title || model.name || 'Untitled Model';
  const description = model.description || 'No description available';
  const threatCount = model.threat_count || 0;
  
  // Handle drag & drop events with safety checks
  const handleDragStart = (e) => {
    try {
      // Store both model ID and drag ID for cross-browser compatibility
      e.dataTransfer.setData('text/plain', model.id.toString());
      e.dataTransfer.setData('application/json', JSON.stringify(model));
      e.dataTransfer.effectAllowed = 'move';
      
      // Set drag image to the card element itself for better visual feedback
      const elem = document.getElementById(dragId);
      if (elem) {
        e.dataTransfer.setDragImage(elem, 20, 20);
      }
      
      // Call the parent component's drag handler
      onDragStart && onDragStart(model);
      console.log(`Started dragging model: ${title} (${model.id})`);
    } catch (err) {
      console.error('Drag start error:', err);
    }
  };
  
  const handleDragOver = (e) => {
    // preventDefault is CRITICAL to make drop work
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (!isDraggedOver) {
      setIsDraggedOver(true);
      console.log(`[ModelCard] Dragging over model: ${title} (${model.id})`);
    }
  };
  
  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDraggedOver(false);
    console.log(`Drag left model: ${title}`);
  };
  
  const handleDrop = (e) => {
    // These two lines are CRITICAL for drop to work
    e.preventDefault();
    e.stopPropagation();
    
    setIsDraggedOver(false);
    console.log(`[ModelCard] Drop detected on model: ${title} (${model.id})`);
    
    try {
      // First try to get the model data from dataTransfer
      const sourceId = e.dataTransfer.getData('text/plain');
      let sourceModelData;
      
      try {
        const jsonData = e.dataTransfer.getData('application/json');
        if (jsonData) sourceModelData = JSON.parse(jsonData);
      } catch (err) {
        console.log('No JSON data available in dataTransfer, using target handler only');
      }
      
      // Call the parent's drop handler with this model as the target
      if (onDrop) {
        // If we have source model data from dataTransfer, pass it along
        if (sourceModelData) {
          console.log('[ModelCard] Using source model from dataTransfer:', sourceModelData.title, sourceModelData.id);
          onDrop(model, sourceModelData);
        } else {
          // Otherwise just pass the target model and let the parent handle the source
          onDrop(model);
        }
        console.log(`[ModelCard] Drop handler called for model: ${title}`);
      }
    } catch (err) {
      console.error('Error in drop handler:', err);
    }
  };

  return (
    <div
      id={dragId}
      className={`card shadow-sm model-card ${isDraggedOver ? 'drag-over border border-primary border-3' : ''}`}
      draggable="true"
      onDragStart={handleDragStart}
      onDragEnd={() => { 
        onDragEnd && onDragEnd();
        console.log(`Finished dragging model: ${title}`);
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => onClick && onClick(model)}
      onMouseEnter={() => onHover && onHover(model)}
      onMouseLeave={() => onHover && onHover(null)}
      aria-label={`${title} threat model card with ${threatCount} threats`}
      role="button"
      tabIndex="0"
    >
      <div className="card-body">
        <h5 className="card-title">{title}</h5>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <span className="badge bg-primary rounded-pill">{threatCount} threats</span>
          <small className="text-muted">Updated: {formattedDate}</small>
        </div>
        {model.description && (
          <p className="card-text small text-truncate">{model.description}</p>
        )}
        {showRemoveButton && (
          <button 
            type="button" 
            className="btn btn-sm btn-outline-danger mt-2" 
            onClick={(e) => {
              e.stopPropagation();
              onRemove && onRemove();
            }}
            aria-label="Remove from workspace"
          >
            <i className="bi bi-x-circle me-1"></i>
            Remove
          </button>
        )}
        {isDraggedOver && (
          <div className="drop-indicator position-absolute top-0 start-0 w-100 h-100 d-flex justify-content-center align-items-center">
            <div className="bg-secondary bg-opacity-75 p-2 rounded text-light">
              <i className="bi bi-arrow-down-up me-1"></i>Drop to merge
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
