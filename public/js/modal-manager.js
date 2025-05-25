/**
 * Modal Manager - Ensures only one Bootstrap modal is open at a time
 * Prevents issues with multiple modals appearing simultaneously
 */

class ModalManager {
  constructor() {
    this.openModals = new Set();
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Listen for modal show events
    document.addEventListener('show.bs.modal', (event) => {
      // Close any open modals before showing a new one
      this.closeAllModals();
      // Add this modal to the set of open modals
      this.openModals.add(event.target.id);
    });

    // Listen for modal hide events
    document.addEventListener('hidden.bs.modal', (event) => {
      // Remove this modal from the set of open modals
      this.openModals.delete(event.target.id);
    });
  }

  closeAllModals() {
    // Close all open modals
    this.openModals.forEach(modalId => {
      const modalElement = document.getElementById(modalId);
      if (modalElement) {
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
          modal.hide();
        }
      }
    });
    // Clear the set of open modals
    this.openModals.clear();
  }

  // Static method to get the singleton instance
  static getInstance() {
    if (!ModalManager.instance) {
      ModalManager.instance = new ModalManager();
    }
    return ModalManager.instance;
  }
}

// Initialize the modal manager as soon as the script loads
const modalManager = ModalManager.getInstance();

// Make the modal manager available globally
window.modalManager = modalManager;
