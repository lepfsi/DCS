import { z } from 'zod';

// Schémas partagés : testables sans serveur, réutilisés par les routes.
export const titleField = z.string().min(1);

export const businessSchema = z.object({ customerId: z.string().optional(), projectId: z.string().optional(), serviceIds: z.array(z.string()).optional(), transactionId: z.string().optional() }).optional();

export const documentCreateSchema = z.object({ type_code: z.string(), title: titleField, templateVersionId: z.string().optional(), fields: z.record(z.any()).default({}), dueAt: z.string().optional(), business: businessSchema, confidentiality: z.string().optional() });

// Champs intelligents (spec §5, §12-13) : niveau 1 (nom, type, obligatoire, aide, ordre)
// et niveau 2 (valeur par défaut, source de données, condition d'affichage, validation, calcul).
export const templateDefinitionSchema = z.object({
  blocks: z.array(z.string()).default([]),
  required: z.array(z.string()).default([]),
  fields: z.array(z.object({
    key: z.string().min(1), label: z.string().min(1), required: z.boolean(),
    type: z.enum(['text', 'textarea', 'number', 'currency', 'date', 'list', 'person', 'client', 'project', 'computed']),
    help: z.string().optional(),
    defaultValue: z.any().optional(),
    dataSource: z.enum(['customers', 'projects', 'services', 'people', 'employees']).optional(),
    options: z.array(z.string()).optional(),
    visibleIf: z.object({ field: z.string(), equals: z.string() }).optional(),
    min: z.number().optional(), max: z.number().optional(),
    formula: z.string().optional(),
  })).default([]),
});
