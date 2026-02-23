const Joi = require("joi");
const { BadRequestError } = require("../utils/customErrors");

// Custom sanitization to prevent XSS in text fields
const sanitizeString = (value, helpers) => {
  // Check for HTML/script tags (XSS attempts)
  if (/<script\b/i.test(value) || /<[^>]+>/g.test(value)) {
    return helpers.error('string.unsafe', { value });
  }

  // Return trimmed value
  return value.trim();
};

// User validation schemas
const createUserSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters with one uppercase letter and one number",
      "string.max": "Password must not exceed 128 characters",
      "string.pattern.base": "Password must be at least 8 characters with one uppercase letter and one number",
      "any.required": "Password is required",
    }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
});

// Profile validation schemas
const createProfileSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(30)
    .pattern(/^[a-zA-Z\s'-]+$/)
    .custom(sanitizeString)
    .required()
    .messages({
      "string.min": "Name must be at least 2 characters long",
      "string.max": "Name must not exceed 30 characters",
      "string.pattern.base": "Name can only contain letters, spaces, hyphens, and apostrophes",
      "string.unsafe": "Name contains invalid or unsafe characters",
      "any.required": "Name is required",
    }),
  age: Joi.number().integer().positive().min(18).max(120).required().messages({
    "number.base": "Age must be a valid number",
    "number.integer": "Age must be a whole number",
    "number.positive": "Age must be a positive number",
    "number.min": "Age must be at least 18",
    "number.max": "Age must not exceed 120",
    "any.required": "Age is required",
  }),
  gender: Joi.string().valid("male", "female").required().messages({
    "any.only": "Gender must be one of: male, female",
    "any.required": "Gender is required",
  }),
  sexualOrientation: Joi.string().valid("straight", "gay", "bisexual").required().messages({
    "any.only": "Sexual orientation must be one of: straight, gay, bisexual",
    "any.required": "Sexual orientation is required",
  }),
  profession: Joi.string()
    .min(2)
    .max(50)
    .custom(sanitizeString)
    .required()
    .messages({
      "string.min": "Profession must be at least 2 characters long",
      "string.max": "Profession must not exceed 50 characters",
      "string.unsafe": "Profession contains invalid or unsafe characters",
      "any.required": "Profession is required",
    }),
  bio: Joi.string()
    .min(6)
    .max(280)
    .custom(sanitizeString)
    .required()
    .messages({
      "string.min": "Bio must be at least 6 characters long",
      "string.max": "Bio must not exceed 280 characters",
      "string.unsafe": "Bio contains invalid or unsafe characters",
      "any.required": "Bio is required",
    }),
  interests: Joi.array()
    .items(Joi.string().min(1).max(30).custom(sanitizeString))
    .min(3)
    .max(3)
    .unique()
    .required()
    .messages({
      "array.min": "You must select exactly 3 interests",
      "array.max": "You must select exactly 3 interests",
      "array.unique": "Interests must be unique (no duplicates)",
      "string.unsafe": "Interest contains invalid or unsafe characters",
      "any.required": "Interests are required",
    }),
  convoStarter: Joi.string()
    .min(10)
    .max(160)
    .custom(sanitizeString)
    .required()
    .messages({
      "string.min": "Conversation starter must be at least 10 characters long",
      "string.max": "Conversation starter must not exceed 160 characters",
      "string.unsafe": "Conversation starter contains invalid or unsafe characters",
      "any.required": "Conversation starter is required",
    }),
  phoneNumber: Joi.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Phone number must be in E.164 format (e.g. +12025551234)",
      "any.required": "Phone number is required",
    }),
});

const updateProfileSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(30)
    .pattern(/^[a-zA-Z\s'-]+$/)
    .custom(sanitizeString)
    .optional()
    .messages({
      "string.min": "Name must be at least 2 characters long",
      "string.max": "Name must not exceed 30 characters",
      "string.pattern.base": "Name can only contain letters, spaces, hyphens, and apostrophes",
      "string.unsafe": "Name contains invalid or unsafe characters",
    }),
  age: Joi.number().integer().positive().min(18).max(120).optional().messages({
    "number.base": "Age must be a valid number",
    "number.integer": "Age must be a whole number",
    "number.positive": "Age must be a positive number",
    "number.min": "Age must be at least 18",
    "number.max": "Age must not exceed 120",
  }),
  gender: Joi.string().valid("male", "female").optional().messages({
    "any.only": "Gender must be one of: male, female",
  }),
  sexualOrientation: Joi.string().valid("straight", "gay", "bisexual").optional().messages({
    "any.only": "Sexual orientation must be one of: straight, gay, bisexual",
  }),
  profession: Joi.string()
    .min(2)
    .max(50)
    .custom(sanitizeString)
    .optional()
    .messages({
      "string.min": "Profession must be at least 2 characters long",
      "string.max": "Profession must not exceed 50 characters",
      "string.unsafe": "Profession contains invalid or unsafe characters",
    }),
  bio: Joi.string()
    .min(6)
    .max(280)
    .custom(sanitizeString)
    .optional()
    .messages({
      "string.min": "Bio must be at least 6 characters long",
      "string.max": "Bio must not exceed 280 characters",
      "string.unsafe": "Bio contains invalid or unsafe characters",
    }),
  interests: Joi.array()
    .items(Joi.string().min(1).max(30).custom(sanitizeString))
    .min(3)
    .max(3)
    .unique()
    .optional()
    .messages({
      "array.min": "You must select exactly 3 interests",
      "array.max": "You must select exactly 3 interests",
      "array.unique": "Interests must be unique (no duplicates)",
      "string.unsafe": "Interest contains invalid or unsafe characters",
    }),
  convoStarter: Joi.string()
    .min(10)
    .max(160)
    .custom(sanitizeString)
    .optional()
    .messages({
      "string.min": "Conversation starter must be at least 10 characters long",
      "string.max": "Conversation starter must not exceed 160 characters",
      "string.unsafe": "Conversation starter contains invalid or unsafe characters",
    }),
  phoneNumber: Joi.string()
    .pattern(/^\+[1-9]\d{1,14}$/)
    .optional()
    .allow("")
    .messages({
      "string.pattern.base": "Phone number must be in E.164 format (e.g. +12025551234)",
    }),
});

// Event validation schemas
const checkinSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required().messages({
    "number.min": "Latitude must be between -90 and 90",
    "number.max": "Latitude must be between -90 and 90",
    "any.required": "Latitude is required",
  }),
  lng: Joi.number().min(-180).max(180).required().messages({
    "number.min": "Longitude must be between -180 and 180",
    "number.max": "Longitude must be between -180 and 180",
    "any.required": "Longitude is required",
  }),
  eventId: Joi.string().hex().length(24).required().messages({
    "string.hex": "Event ID must be a valid MongoDB ObjectId",
    "string.length": "Event ID must be 24 characters long",
    "any.required": "Event ID is required",
  }),
});

const checkoutSchema = Joi.object({
  eventId: Joi.string().hex().length(24).required().messages({
    "string.hex": "Event ID must be a valid MongoDB ObjectId",
    "string.length": "Event ID must be 24 characters long",
    "any.required": "Event ID is required",
  }),
});

// Validation middleware factory
const validate = (schema, property = "body") => (req, res, next) => {
  const { error } = schema.validate(req[property], { abortEarly: false });

  if (error) {
    const errorMessages = error.details.map((detail) => detail.message).join(", ");
    return next(new BadRequestError(errorMessages));
  }

  return next();
};

module.exports = {
  validate,
  createUserSchema,
  loginSchema,
  createProfileSchema,
  updateProfileSchema,
  checkinSchema,
  checkoutSchema,
};
