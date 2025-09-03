/**
 * Input Validation Middleware
 *
 * Comprehensive validation for API requests including sanitization and security checks
 */

const validator = require('validator');

// Validation schemas for different endpoints
const validationSchemas = {
    reportsGenerate: {
        reportType: {
            type: 'string',
            required: true,
            allowedValues: ['project_portfolio', 'component_inventory', 'safeguard_status', 'threat_model_summary'],
            maxLength: 50
        },
        templateId: {
            type: 'string',
            required: true,
            maxLength: 100,
            pattern: /^[a-zA-Z0-9\-_]+$/
        },
        filters: {
            type: 'object',
            required: false,
            properties: {
                projectUuid: { type: 'uuid', required: false },
                project_id: { type: 'uuid', required: false },
                projectId: { type: 'uuid', required: false },
                llmOverride: {
                    type: 'object',
                    required: false,
                    properties: {
                        provider: { type: 'string', allowedValues: ['openai', 'ollama'], required: false },
                        model: { type: 'string', maxLength: 50, required: false }
                    }
                },
                author: { type: 'string', maxLength: 100, required: false },
                ci_example: { type: 'string', maxLength: 50, required: false },
                pipeline_steps: { type: 'array', maxLength: 20, required: false },
                tags: { type: 'object', required: false },
                aws_accounts: { type: 'array', maxLength: 10, required: false }
            }
        }
    }
};

// Custom validation functions
const validators = {
    string: (value, rules) => {
        if (typeof value !== 'string') return false;
        if (rules.maxLength && value.length > rules.maxLength) return false;
        if (rules.pattern && !rules.pattern.test(value)) return false;
        if (rules.allowedValues && !rules.allowedValues.includes(value)) return false;
        return true;
    },

    uuid: (value) => {
        return typeof value === 'string' && validator.isUUID(value, 4);
    },

    object: (value, rules) => {
        if (typeof value !== 'object' || value === null) return false;
        if (rules.properties) {
            for (const [prop, propRules] of Object.entries(rules.properties)) {
                if (propRules.required && !(prop in value)) {
                    return false;
                }
                if (prop in value) {
                    const validatorFn = validators[propRules.type];
                    if (validatorFn && !validatorFn(value[prop], propRules)) {
                        return false;
                    }
                }
            }
        }
        return true;
    },

    array: (value, rules) => {
        if (!Array.isArray(value)) return false;
        if (rules.maxLength && value.length > rules.maxLength) return false;
        return true;
    }
};

/**
 * Sanitize input value based on type
 * @param {*} value - Value to sanitize
 * @param {string} type - Expected type
 * @returns {*} Sanitized value
 */
function sanitizeValue(value, type) {
    if (value == null) return value;

    switch (type) {
        case 'string':
            if (typeof value === 'string') {
                // Basic sanitization - remove potentially dangerous characters
                return validator.escape(value.trim());
            }
            return String(value);

        case 'uuid':
            if (typeof value === 'string') {
                return value.trim().toLowerCase();
            }
            return value;

        case 'object':
            if (typeof value === 'object' && value !== null) {
                // Deep sanitize object properties
                const sanitized = {};
                for (const [key, val] of Object.entries(value)) {
                    if (typeof key === 'string') {
                        const cleanKey = validator.escape(key);
                        sanitized[cleanKey] = sanitizeValue(val, typeof val);
                    }
                }
                return sanitized;
            }
            return value;

        case 'array':
            if (Array.isArray(value)) {
                return value.map(item => sanitizeValue(item, typeof item));
            }
            return value;

        default:
            return value;
    }
}

/**
 * Validate request body against schema
 * @param {Object} body - Request body
 * @param {Object} schema - Validation schema
 * @returns {Object} Validation result with isValid and errors
 */
function validateAgainstSchema(body, schema) {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
        const value = body[field];

        // Check required fields
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`${field} is required`);
            continue;
        }

        // Skip validation if field is not present and not required
        if (value === undefined || value === null) continue;

        // Validate field type and rules
        const validatorFn = validators[rules.type];
        if (validatorFn && !validatorFn(value, rules)) {
            errors.push(`${field} validation failed`);
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Create validation middleware for specific endpoint
 * @param {string} endpoint - Endpoint name (must match validationSchemas key)
 * @returns {Function} Express middleware function
 */
function createValidationMiddleware(endpoint) {
    const schema = validationSchemas[endpoint];

    if (!schema) {
        throw new Error(`No validation schema found for endpoint: ${endpoint}`);
    }

    return (req, res, next) => {
        try {
            // Sanitize the request body
            const sanitizedBody = {};
            for (const [key, value] of Object.entries(req.body || {})) {
                const cleanKey = validator.escape(key);
                const fieldRules = schema[cleanKey];
                const expectedType = fieldRules ? fieldRules.type : typeof value;
                sanitizedBody[cleanKey] = sanitizeValue(value, expectedType);
            }

            // Replace request body with sanitized version
            req.body = sanitizedBody;

            // Validate against schema
            const validation = validateAgainstSchema(sanitizedBody, schema);

            if (!validation.isValid) {
                console.warn(`[Validation] Request validation failed for ${endpoint}:`, validation.errors);
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validation.errors,
                    message: 'Request contains invalid or malformed data'
                });
            }

            // Additional security checks
            const securityCheck = performSecurityChecks(sanitizedBody);
            if (!securityCheck.isValid) {
                console.warn(`[Validation] Security check failed for ${endpoint}:`, securityCheck.errors);
                return res.status(400).json({
                    error: 'Security validation failed',
                    details: securityCheck.errors,
                    message: 'Request contains potentially malicious content'
                });
            }

            next();
        } catch (error) {
            console.error(`[Validation] Unexpected error during validation for ${endpoint}:`, error);
            return res.status(500).json({
                error: 'Validation error',
                message: 'An error occurred during request validation'
            });
        }
    };
}

/**
 * Perform additional security checks on the request
 * @param {Object} body - Sanitized request body
 * @returns {Object} Security check result
 */
function performSecurityChecks(body) {
    const errors = [];

    // Check for potentially malicious patterns in string fields
    const maliciousPatterns = [
        /<script/i,
        /javascript:/i,
        /on\w+\s*=/i,
        /<iframe/i,
        /<object/i,
        /<embed/i,
        /\b(eval|exec|system)\b/i
    ];

    function checkStringForMalicious(value) {
        if (typeof value !== 'string') return false;
        return maliciousPatterns.some(pattern => pattern.test(value));
    }

    function deepCheck(obj) {
        if (typeof obj === 'string') {
            if (checkStringForMalicious(obj)) {
                errors.push('Potentially malicious content detected');
                return true;
            }
        } else if (Array.isArray(obj)) {
            obj.forEach(item => deepCheck(item));
        } else if (typeof obj === 'object' && obj !== null) {
            Object.values(obj).forEach(value => deepCheck(value));
        }
    }

    deepCheck(body);

    return {
        isValid: errors.length === 0,
        errors
    };
}

module.exports = {
    createValidationMiddleware,
    validateAgainstSchema,
    sanitizeValue
};
