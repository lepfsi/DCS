import { z } from 'zod';

// Schémas partagés : testables sans serveur, réutilisés par les routes.
export const titleField = z.string().min(1);

export const businessSchema = z.object({ customerId: z.string().optional(), projectId: z.string().optional(), serviceIds: z.array(z.string()).optional(), transactionId: z.string().optional() }).optional();

export const documentCreateSchema = z.object({ type_code: z.string(), title: titleField, templateVersionId: z.string().optional(), fields: z.record(z.any()).default({}), dueAt: z.string().optional(), business: businessSchema, confidentiality: z.string().optional() });

export const templateDefinitionSchema = z.object({ blocks: z.array(z.string()).default([]), required: z.array(z.string()).default([]), fields: z.array(z.object({ key: z.string().min(1), label: z.string().min(1), type: z.enum(['text', 'textarea', 'number', 'currency', 'date']), required: z.boolean() })).default([]) });
