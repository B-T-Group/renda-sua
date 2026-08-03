import { z } from 'zod';
import type { PersonaId } from '../wizard/types';

const personaEnum = z.enum(['client', 'agent', 'business']);

export const contactSchema = z.object({
  firstName: z.string().trim().min(1, 'Required'),
  lastName: z.string().trim().min(1, 'Required'),
  email: z
    .string()
    .trim()
    .email('Invalid email')
    .min(1, 'Required'),
  phone: z.string().trim().min(5, 'Required'),
});

export const personasSchema = z
  .array(personaEnum)
  .min(1, 'Select a persona')
  .max(1, 'Select only one persona');

export const businessSchema = z.object({
  name: z.string().trim().min(1, 'Required'),
  mainInterest: z.enum(['sell_items', 'rent_items']),
  referralAgentCode: z.string().trim().max(6).optional().default(''),
});

export const countrySchema = z.string().trim().length(2, 'Select a country');

export function buildStoreLocationSchema(postalCodeRequired: boolean) {
  const base = z.object({
    street: z.string().trim().min(1, 'Required'),
    city: z.string().trim().min(1, 'Required'),
    region: z.string().trim().min(1, 'Required'),
    postalCode: z.string().trim(),
    latitude: z.number().optional(),
    longitude: z.number().optional(),
  });
  if (!postalCodeRequired) return base;
  return base.superRefine((val, ctx) => {
    if (!val.postalCode.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Required',
        path: ['postalCode'],
      });
    }
  });
}

export function buildSignupSchema(opts: {
  postalCodeRequired: boolean;
}) {
  const storeLocationSchema = buildStoreLocationSchema(opts.postalCodeRequired);

  return z
    .object({
      contact: contactSchema,
      personas: personasSchema,
      business: z.object({
        name: z.string(),
        mainInterest: z.enum(['sell_items', 'rent_items']),
        referralAgentCode: z.string(),
      }),
      country: z.string(),
      storeLocation: z.object({
        street: z.string(),
        city: z.string(),
        region: z.string(),
        postalCode: z.string(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }),
    })
    .superRefine((values, ctx) => {
      const personas = values.personas as PersonaId[];
      const contact = contactSchema.safeParse(values.contact);
      if (!contact.success) {
        for (const issue of contact.error.issues) {
          ctx.addIssue({ ...issue, path: ['contact', ...issue.path] });
        }
      }

      if (!personas.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Select at least one persona',
          path: ['personas'],
        });
      }

      if (personas.includes('business')) {
        const biz = businessSchema.safeParse(values.business);
        if (!biz.success) {
          for (const issue of biz.error.issues) {
            ctx.addIssue({ ...issue, path: ['business', ...issue.path] });
          }
        }
      }

      const country = countrySchema.safeParse(values.country);
      if (!country.success) {
        for (const issue of country.error.issues) {
          ctx.addIssue({ ...issue, path: ['country'] });
        }
      }

      if (personas.includes('business')) {
        const loc = storeLocationSchema.safeParse(values.storeLocation);
        if (!loc.success) {
          for (const issue of loc.error.issues) {
            ctx.addIssue({
              ...issue,
              path: ['storeLocation', ...issue.path],
            });
          }
        }
      }
    });
}

export type SignupSchema = ReturnType<typeof buildSignupSchema>;
