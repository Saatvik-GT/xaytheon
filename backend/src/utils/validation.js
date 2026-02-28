// Input validation utilities
const validator = require('validator');
const sanitizeHtml = require('sanitize-html'); // Added for proper HTML sanitization

class ValidationError extends Error {
  constructor(message, field) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
    this.statusCode = 400;
  }
}

// Sanitization functions
function sanitizeString(input, options = {}) {
  if (typeof input !== 'string') return '';

  const { maxLength = 1000, allowHtml = false } = options;

  let sanitized = input.trim();

  if (!allowHtml) {
    // Remove HTML tags and encode special characters
    sanitized = sanitizeHtml(sanitized, { allowedTags: [], allowedAttributes: {} });
  }

  return sanitized.substring(0, maxLength);
}

function sanitizeEmail(email) {
  if (typeof email !== 'string') return '';
  return validator.normalizeEmail(email.trim(), {
    gmail_remove_dots: false,
    gmail_remove_subaddress: false,
    outlookdotcom_remove_subaddress: false,
    yahoo_remove_subaddress: false,
    icloud_remove_subaddress: false
  }) || '';
}

// Validation functions
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    throw new ValidationError('Email is required', 'email');
  }

  if (!validator.isEmail(email)) {
    throw new ValidationError('Please provide a valid email address', 'email');
  }

  const sanitized = sanitizeEmail(email);

  if (sanitized.length > 254) {
    throw new ValidationError('Email is too long', 'email');
  }

  return sanitized;
}

function validatePassword(password) {
  if (!password || typeof password !== 'string') {
    throw new ValidationError('Password is required', 'password');
  }

  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters long', 'password');
  }

  if (password.length > 128) {
    throw new ValidationError('Password must be less than 128 characters', 'password');
  }

  // Strong password validation
  if (!validator.isStrongPassword(password, {
    minLength: 8,
    minLowercase: 1,
    minUppercase: 1,
    minNumbers: 1,
    minSymbols: 1
  })) {
    throw new ValidationError('Password is too weak', 'password');
  }

  return password;
}

function validateString(input, fieldName, options = {}) {
  const { required = false, minLength = 0, maxLength = 1000, allowEmpty = false } = options;

  if (required && (!input || typeof input !== 'string' || input.trim().length === 0)) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  if (!input && !required) return '';

  if (typeof input !== 'string') {
    throw new ValidationError(`${fieldName} must be a string`, fieldName);
  }

  // Validate length before truncation
  if (input.length < minLength) {
    throw new ValidationError(`${fieldName} must be at least ${minLength} characters`, fieldName);
  }

  const sanitized = sanitizeString(input, { maxLength });

  if (required && sanitized.length === 0 && !allowEmpty) {
    throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
  }

  return sanitized;
}

function validateUrl(url, fieldName) {
  if (!url || typeof url !== 'string') return '';

  const sanitized = url.trim();

  if (sanitized && !validator.isURL(sanitized, {
    protocols: ['http', 'https'],
    require_protocol: true
  })) {
    throw new ValidationError(`${fieldName} must be a valid HTTP or HTTPS URL`, fieldName);
  }

  return sanitized;
}

function validateNumber(input, fieldName, options = {}) {
  const { required = false, min = -Infinity, max = Infinity, integer = false } = options;

  if (required && (input === null || input === undefined || input === '')) {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  if (!required && (input === null || input === undefined || input === '')) {
    return null;
  }

  const numStr = String(input).trim();

  // Strict numeric validation
  const isValid = integer ? /^-?\d+$/.test(numStr) : /^-?\d+(\.\d+)?$/.test(numStr);
  if (!isValid) {
    throw new ValidationError(`${fieldName} must be a valid number`, fieldName);
  }

  const num = integer ? parseInt(numStr, 10) : parseFloat(numStr);

  if (num < min || num > max) {
    throw new ValidationError(`${fieldName} must be between ${min} and ${max}`, fieldName);
  }

  return num;
}

function validateArray(input, fieldName, options = {}) {
  const { required = false, maxLength = 100, itemValidator } = options;

  if (required && (!Array.isArray(input))) {
    throw new ValidationError(`${fieldName} must be an array`, fieldName);
  }

  if (!required && !Array.isArray(input)) return [];

  if (input.length > maxLength) {
    throw new ValidationError(`${fieldName} cannot contain more than ${maxLength} items`, fieldName);
  }

  if (itemValidator) {
    // Avoid mutating input array
    const validated = input.map((item, i) => {
      try {
        return itemValidator(item, `${fieldName}[${i}]`);
      } catch (error) {
        throw new ValidationError(`${fieldName}[${i}]: ${error.message}`, fieldName);
      }
    });
    return validated;
  }

  return [...input];
}

// Middleware for handling validation errors
function handleValidationError(err, req, res, next) {
  if (err.name === 'ValidationError') {
    return res.status(err.statusCode).json({
      message: err.message,
      field: err.field
    });
  }
  next(err);
}

module.exports = {
  ValidationError,
  sanitizeString,
  sanitizeEmail,
  validateEmail,
  validatePassword,
  validateString,
  validateUrl,
  validateNumber,
  validateArray,
  handleValidationError
};
