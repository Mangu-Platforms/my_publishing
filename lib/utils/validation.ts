import { z } from 'zod';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_MIN_MESSAGE,
} from '@/lib/auth/password-policy';

/**
 * Validation schemas using Zod
 */

export const emailSchema = z.string().email('Invalid email address');

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, PASSWORD_MIN_MESSAGE)
  .max(PASSWORD_MAX_LENGTH, `Password must be less than ${PASSWORD_MAX_LENGTH} characters`);

export const bookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  genre: z.string().min(1, 'Genre is required'),
  price: z.number().min(0, 'Price must be positive'),
  description: z.string().optional(),
});

export const manuscriptSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  genre: z.string().min(1, 'Genre is required'),
  synopsis: z.string().max(1000, 'Synopsis must be less than 1000 characters').optional(),
  word_count: z.number().min(1).optional(),
});
