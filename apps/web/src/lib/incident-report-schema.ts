import type { Locale, Messages } from '@/i18n';

import { z } from 'zod';

export const incidentSeverities = ['LOW', 'MEDIUM', 'HIGH'] as const;
export const preferredContactMethods = ['PHONE', 'EMAIL'] as const;

export interface IncidentReportFormValues {
  categoryId: string;
  description: string;
  severity: (typeof incidentSeverities)[number];
  incidentDate: string;
  incidentTime: string;
  locationDescription: string;
  state: string;
  lga: string;
  latitude: string;
  longitude: string;
  contactEnabled: boolean;
  name: string;
  phone: string;
  email: string;
  preferredContactMethod: (typeof preferredContactMethods)[number];
  safeContactInstructions: string;
  consentToContact: boolean;
}

export interface IncidentSubmissionPayload {
  categoryId: string;
  description: string;
  severity: (typeof incidentSeverities)[number];
  submissionLanguage: Locale;
  incidentDate?: string;
  incidentTime?: string;
  locationDescription?: string;
  state?: string;
  lga?: string;
  latitude?: number;
  longitude?: number;
  contact?: {
    name?: string;
    phone?: string;
    email?: string;
    preferredContactMethod: (typeof preferredContactMethods)[number];
    safeContactInstructions?: string;
    consentToContact: true;
  };
}

export type IncidentReportValidationMessages = Messages['public']['incidentReport']['validation'];

export function createEmptyIncidentReportValues(): IncidentReportFormValues {
  return {
    categoryId: '',
    description: '',
    severity: 'MEDIUM',
    incidentDate: '',
    incidentTime: '',
    locationDescription: '',
    state: '',
    lga: '',
    latitude: '',
    longitude: '',
    contactEnabled: false,
    name: '',
    phone: '',
    email: '',
    preferredContactMethod: 'PHONE',
    safeContactInstructions: '',
    consentToContact: false,
  };
}

const strictDate = /^\d{4}-\d{2}-\d{2}$/;
const strictTime = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
const phoneNumber = /^\+?[0-9](?:[0-9 ()-]{5,22}[0-9])$/;

function isCalendarDate(value: string): boolean {
  if (!strictDate.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month! - 1 &&
    parsed.getUTCDate() === day
  );
}

export function createIncidentReportSchema(
  locale: Locale,
  messages: IncidentReportValidationMessages,
) {
  return z
    .object({
      categoryId: z.uuid(messages.category),
      description: z
        .string()
        .trim()
        .min(20, messages.descriptionMin)
        .max(5000, messages.descriptionMax),
      severity: z.enum(incidentSeverities),
      incidentDate: z
        .string()
        .refine((value) => value === '' || isCalendarDate(value), messages.date),
      incidentTime: z
        .string()
        .refine((value) => value === '' || strictTime.test(value), messages.time),
      locationDescription: z.string().trim().max(500, messages.locationMax),
      state: z.string().trim().max(100, messages.stateMax),
      lga: z.string().trim().max(100, messages.lgaMax),
      latitude: z.string().trim(),
      longitude: z.string().trim(),
      contactEnabled: z.boolean(),
      name: z.string().trim(),
      phone: z.string().trim(),
      email: z.string().trim(),
      preferredContactMethod: z.enum(preferredContactMethods),
      safeContactInstructions: z.string().trim(),
      consentToContact: z.boolean(),
    })
    .strict()
    .superRefine((values, context) => {
      const hasLatitude = values.latitude !== '';
      const hasLongitude = values.longitude !== '';

      if (hasLatitude !== hasLongitude) {
        context.addIssue({
          code: 'custom',
          path: ['latitude'],
          message: messages.coordinatesPair,
        });
      }

      if (hasLatitude) {
        const latitude = Number(values.latitude);
        if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
          context.addIssue({ code: 'custom', path: ['latitude'], message: messages.latitude });
        }
      }

      if (hasLongitude) {
        const longitude = Number(values.longitude);
        if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
          context.addIssue({ code: 'custom', path: ['longitude'], message: messages.longitude });
        }
      }

      if (!values.contactEnabled) return;

      if (values.name.length > 160) {
        context.addIssue({ code: 'custom', path: ['name'], message: messages.nameMax });
      }
      if (values.phone.length > 32) {
        context.addIssue({ code: 'custom', path: ['phone'], message: messages.phone });
      }
      if (values.email.length > 320) {
        context.addIssue({ code: 'custom', path: ['email'], message: messages.email });
      }
      if (values.safeContactInstructions.length > 500) {
        context.addIssue({
          code: 'custom',
          path: ['safeContactInstructions'],
          message: messages.instructionsMax,
        });
      }

      if (values.phone && !phoneNumber.test(values.phone)) {
        context.addIssue({ code: 'custom', path: ['phone'], message: messages.phone });
      }
      if (values.email && !z.email().safeParse(values.email).success) {
        context.addIssue({ code: 'custom', path: ['email'], message: messages.email });
      }

      if (!values.phone && !values.email) {
        context.addIssue({
          code: 'custom',
          path: ['phone'],
          message: messages.contactRequired,
        });
      }
      if (values.preferredContactMethod === 'PHONE' && !values.phone) {
        context.addIssue({
          code: 'custom',
          path: ['phone'],
          message: messages.preferredPhone,
        });
      }
      if (values.preferredContactMethod === 'EMAIL' && !values.email) {
        context.addIssue({
          code: 'custom',
          path: ['email'],
          message: messages.preferredEmail,
        });
      }
      if (!values.consentToContact) {
        context.addIssue({
          code: 'custom',
          path: ['consentToContact'],
          message: messages.consent,
        });
      }
    })
    .transform((values): IncidentSubmissionPayload => {
      const optional = (value: string): string | undefined => value || undefined;
      const payload: IncidentSubmissionPayload = {
        categoryId: values.categoryId,
        description: values.description,
        severity: values.severity,
        submissionLanguage: locale,
      };

      const incidentDate = optional(values.incidentDate);
      const incidentTime = optional(values.incidentTime);
      const locationDescription = optional(values.locationDescription);
      const state = optional(values.state);
      const lga = optional(values.lga);
      if (incidentDate) payload.incidentDate = incidentDate;
      if (incidentTime) payload.incidentTime = incidentTime;
      if (locationDescription) payload.locationDescription = locationDescription;
      if (state) payload.state = state;
      if (lga) payload.lga = lga;
      if (values.latitude && values.longitude) {
        payload.latitude = Number(values.latitude);
        payload.longitude = Number(values.longitude);
      }

      if (values.contactEnabled) {
        payload.contact = {
          preferredContactMethod: values.preferredContactMethod,
          consentToContact: true,
        };
        const name = optional(values.name);
        const phone = optional(values.phone);
        const email = optional(values.email);
        const instructions = optional(values.safeContactInstructions);
        if (name) payload.contact.name = name;
        if (phone) payload.contact.phone = phone;
        if (email) payload.contact.email = email;
        if (instructions) payload.contact.safeContactInstructions = instructions;
      }

      return payload;
    });
}

export type IncidentReportFieldErrors = Partial<Record<keyof IncidentReportFormValues, string>>;

export function getIncidentReportFieldErrors(
  issues: readonly z.core.$ZodIssue[],
): IncidentReportFieldErrors {
  const errors: IncidentReportFieldErrors = {};
  for (const issue of issues) {
    const field = issue.path[0] as keyof IncidentReportFormValues | undefined;
    if (field && errors[field] === undefined) errors[field] = issue.message;
  }
  return errors;
}
