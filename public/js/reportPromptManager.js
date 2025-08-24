$(document).ready(function() {
    const reportTypeSelect = $('#reportTypeSelect');
    const promptsContainer = $('#promptsContainer');
    const createNewPromptBtn = $('#createNewPromptBtn');
    const promptFormModal = $('#promptFormModal');
    const promptForm = $('#promptForm');
    const savePromptBtn = $('#savePromptBtn');

    let currentReportType = '';

    // Fetch and display prompts when report type changes
    reportTypeSelect.on('change', function() {
        currentReportType = $(this).val();
        if (currentReportType) {
            fetchPrompts(currentReportType);
            createNewPromptBtn.prop('disabled', false);
        } else {
            promptsContainer.html('<p class="text-muted">Please select a report type to see or manage its prompts.</p>');
            createNewPromptBtn.prop('disabled', true);
        }
    });

    async function fetchPrompts(reportType) {
        promptsContainer.html('<p>Loading prompts...</p>');
        try {
            const response = await fetch(`/api/report-prompts/type/${reportType}`);
            if (!response.ok) {
                if (response.status === 404) {
                    promptsContainer.html('<p class="text-muted">No prompts found for this report type. Feel free to create one!</p>');
                    return;
                }
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const prompts = await response.json();
            renderPrompts(prompts);
        } catch (error) {
            console.error('Error fetching prompts:', error);
            promptsContainer.html('<p class="text-danger">Failed to load prompts. Please try again.</p>');
        }
    }

    function renderPrompts(prompts) {
        if (!prompts || prompts.length === 0) {
            promptsContainer.html('<p class="text-muted">No prompts found for this report type. Feel free to create one!</p>');
            return;
        }

        let html = '<div class="row">';
        prompts.forEach(prompt => {
            html += `
                <div class="col-md-6">
                    <div class="card prompt-card">
                        <div class="card-body">
                            <h5 class="card-title">${escapeHtml(prompt.name)} ${prompt.is_default ? '<span class="badge badge-secondary">Default</span>' : ''}</h5>
                            <h6 class="card-subtitle mb-2 text-muted">Provider: ${escapeHtml(prompt.llm_provider)} - Model: ${escapeHtml(prompt.llm_model)}</h6>
                            <p class="card-text">${escapeHtml((prompt.report_prompt_text || '').substring(0, 100))}${(prompt.report_prompt_text || '').length > 100 ? '...' : ''}</p>
                            <div class="actions">
                                <a href="#" class="btn btn-sm btn-info view-prompt" data-id="${prompt.id}">View/Edit</a>
                                ${!prompt.is_default ? `<a href="#" class="btn btn-sm btn-danger delete-prompt" data-id="${prompt.id}">Delete</a>` : ''}
                                <a href="#" class="btn btn-sm btn-primary generate-report" data-prompt-id="${prompt.id}" data-report-type="${prompt.report_type}">Generate Report</a>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });
        html += '</div>';
        promptsContainer.html(html);
    }

    // Handle 'Create New Prompt' button click
    createNewPromptBtn.on('click', function() {
        if (!currentReportType) {
            alert('Please select a report type first.');
            return;
        }
        resetForm();
        $('#formReportType').val(currentReportType);
        $('#promptFormModalLabel').text('Create New Prompt');
        $('#isDefault').prop('checked', false).prop('disabled', true);
        promptFormModal.modal('show');
    });

    // Handle 'View/Edit' button click
    promptsContainer.on('click', '.view-prompt', async function(e) {
        e.preventDefault();
        const promptId = $(this).data('id');
        try {
            const response = await fetch(`/api/report-prompts/${promptId}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const prompt = await response.json();
            fillForm(prompt);
            $('#promptFormModalLabel').text('Edit Prompt');
            promptFormModal.modal('show');
        } catch (error) {
            console.error('Error fetching prompt details:', error);
            alert('Failed to load prompt details.');
        }
    });

    // Handle 'Delete' button click
    promptsContainer.on('click', '.delete-prompt', async function(e) {
        e.preventDefault();
        const promptId = $(this).data('id');
        if (confirm('Are you sure you want to delete this prompt? This action cannot be undone.')) {
            try {
                const response = await fetch(`/api/report-prompts/${promptId}`, { method: 'DELETE' });
                if (!response.ok) {
                     const errorData = await response.json();
                     throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
                }
                fetchPrompts(currentReportType); // Refresh list
            } catch (error) {
                console.error('Error deleting prompt:', error);
                alert(`Failed to delete prompt: ${error.message}`);
            }
        }
    });

    // Handle 'Generate Report' button click
    promptsContainer.on('click', '.generate-report', async function(e) {
        e.preventDefault();
        const promptId = $(this).data('prompt-id');
        const reportType = $(this).data('report-type');
        const btn = $(this);
        btn.text('Generating...').prop('disabled', true);
        $('#generatedReportDisplayArea').hide();
        try {
            const response = await fetch('/api/reports/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reportType, promptId })
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || `HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            console.log('Report generation result:', result);
            $('#generatedReportDisplay').text(result.generatedReport || '[No report generated]');
            $('#generatedReportDisplayArea').show();
        } catch (error) {
            console.error('Error generating report:', error);
            alert(`Failed to generate report: ${error.message}`);
        } finally {
            btn.text('Generate Report').prop('disabled', false);
        }
    });

    // Handle form submission (Save Prompt)
    savePromptBtn.on('click', async function() {
        const promptId = $('#promptId').val();
        const reportType = $('#formReportType').val();
        const formData = {
            report_type: reportType,
            name: $('#promptName').val(),
            report_prompt_text: $('#promptText').val(),
            llm_provider: $('#llmProvider').val(),
            llm_model: $('#llmModel').val(),
            // is_default is not user-settable through this form for safety
        };

        if (!formData.name || !formData.report_prompt_text || !formData.llm_model) {
            alert('Please fill in all required fields: Name, Report Prompt Text, and LLM Model.');
            return;
        }

        const url = promptId ? `/api/report-prompts/${promptId}` : '/api/report-prompts';
        const method = promptId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.details || errorData.error || `HTTP error! status: ${response.status}`);
            }
            promptFormModal.modal('hide');
            fetchPrompts(reportType); // Refresh list for the current report type
        } catch (error) {
            console.error('Error saving prompt:', error);
            alert(`Failed to save prompt: ${error.message}`);
        }
    });

    function resetForm() {
        promptForm[0].reset();
        $('#promptId').val('');
        $('#isDefault').prop('checked', false).prop('disabled', true);
    }

    function fillForm(prompt) {
        $('#promptId').val(prompt.id);
        $('#formReportType').val(prompt.report_type);
        $('#promptName').val(prompt.name);
        $('#promptText').val(prompt.report_prompt_text);
        $('#llmProvider').val(prompt.llm_provider);
        $('#llmModel').val(prompt.llm_model);
        $('#isDefault').prop('checked', prompt.is_default).prop('disabled', true);
    }

    function escapeHtml(unsafe) {
        if (unsafe === null || typeof unsafe === 'undefined') return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
});
