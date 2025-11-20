const Joi = require("joi");
const { BadRequestError } = require("../utils/customErrors");

// User validation schemas
const createUserSchema = Joi.object({
  name: Joi.string().min(2).max(30).required().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name must not exceed 30 characters",
    "any.required": "Name is required",
  }),
  avatar: Joi.string().uri().optional().messages({
    "string.uri": "Avatar must be a valid URL",
  }),
  email: Joi.string().email().required().messages({
    "string.email": "Email must be a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(8).required().messages({
    "string.min": "Password must be at least 8 characters long",
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
  name: Joi.string().min(2).max(30).required().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name must not exceed 30 characters",
    "any.required": "Name is required",
  }),
  age: Joi.number().integer().min(18).max(120).required().messages({
    "number.min": "Age must be at least 18",
    "number.max": "Age must not exceed 120",
    "any.required": "Age is required",
  }),
  gender: Joi.string().valid("male", "female", "non-binary", "other").required().messages({
    "any.only": "Gender must be one of: male, female, non-binary, other",
    "any.required": "Gender is required",
  }),
  bio: Joi.string().min(6).max(280).required().messages({
    "string.min": "Bio must be at least 6 characters long",
    "string.max": "Bio must not exceed 280 characters",
    "any.required": "Bio is required",
  }),
  interests: Joi.array().items(Joi.string()).min(1).max(3).required().messages({
    "array.min": "At least 1 interest is required",
    "array.max": "Maximum 3 interests allowed",
    "any.required": "Interests are required",
  }),
  convoStarter: Joi.string().min(10).max(200).required().messages({
    "string.min": "Conversation starter must be at least 10 characters long",
    "string.max": "Conversation starter must not exceed 200 characters",
    "any.required": "Conversation starter is required",
  }),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).max(30).optional().messages({
    "string.min": "Name must be at least 2 characters long",
    "string.max": "Name must not exceed 30 characters",
  }),
  age: Joi.number().integer().min(18).max(120).optional().messages({
    "number.min": "Age must be at least 18",
    "number.max": "Age must not exceed 120",
  }),
  gender: Joi.string().valid("male", "female", "non-binary", "other").optional().messages({
    "any.only": "Gender must be one of: male, female, non-binary, other",
  }),
  bio: Joi.string().min(6).max(280).optional().messages({
    "string.min": "Bio must be at least 6 characters long",
    "string.max": "Bio must not exceed 280 characters",
  }),
  interests: Joi.array().items(Joi.string()).min(1).max(3).optional().messages({
    "array.min": "At least 1 interest is required",
    "array.max": "Maximum 3 interests allowed",
  }),
  convoStarter: Joi.string().min(10).max(200).optional().messages({
    "string.min": "Conversation starter must be at least 10 characters long",
    "string.max": "Conversation starter must not exceed 200 characters",
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

const fetchGoogleEventsSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).optional().messages({
    "number.min": "Latitude must be between -90 and 90",
    "number.max": "Latitude must be between -90 and 90",
  }),
  lng: Joi.number().min(-180).max(180).optional().messages({
    "number.min": "Longitude must be between -180 and 180",
    "number.max": "Longitude must be between -180 and 180",
  }),
  radius: Joi.number().min(1000).max(50000).optional().messages({
    "number.min": "Radius must be at least 1000 meters",
    "number.max": "Radius must not exceed 50000 meters",
  }),
});

// Validation middleware factory
const validate = (schema, property = "body") => {
  return (req, res, next) => {
    const { error } = schema.validate(req[property], { abortEarly: false });

    if (error) {
      const errorMessages = error.details.map((detail) => detail.message).join(", ");
      return next(new BadRequestError(errorMessages));
    }

    next();
  };
};

module.exports = {
  validate,
  createUserSchema,
  loginSchema,
  createProfileSchema,
  updateProfileSchema,
  checkinSchema,
  checkoutSchema,
  fetchGoogleEventsSchema,
};
