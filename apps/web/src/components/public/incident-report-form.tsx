'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { getPublicPath, type Locale, type Messages } from '@/i18n';
import {
  createEmptyIncidentReportValues,
  createIncidentReportSchema,
  getIncidentReportFieldErrors,
  incidentSeverities,
  preferredContactMethods,
  type IncidentReportFieldErrors,
  type IncidentReportFormValues,
} from '@/lib/incident-report-schema';
import {
  loadIncidentCategories,
  PublicApiError,
  submitIncidentReport,
  type PublicApiErrorKind,
  type PublicIncidentCategory,
} from '@/lib/public-api';

type ReportMessages = Messages['public']['incidentReport'];

function FieldError({ id, message }: Readonly<{ id: string; message?: string }>) {
  return message ? (
    <p className="field-error" id={id} role="alert">
      {message}
    </p>
  ) : null;
}

function describedBy(helpId: string, error?: string): string {
  return error ? `${helpId} ${helpId}-error` : helpId;
}

export function IncidentReportForm({
  locale,
  messages,
  apiBaseUrl,
}: Readonly<{ locale: Locale; messages: ReportMessages; apiBaseUrl: string }>) {
  const [values, setValues] = useState(createEmptyIncidentReportValues);
  const [categories, setCategories] = useState<PublicIncidentCategory[]>([]);
  const [categoryState, setCategoryState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<IncidentReportFieldErrors>({});
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccessful, setIsSuccessful] = useState(false);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const submissionInProgress = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    loadIncidentCategories(apiBaseUrl, { signal: controller.signal })
      .then((loadedCategories) => {
        setCategories(loadedCategories);
        setCategoryState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setCategoryState('error');
      });
    return () => controller.abort();
  }, [apiBaseUrl, categoryAttempt]);

  useEffect(() => {
    if (formError || Object.keys(fieldErrors).length > 0) errorSummaryRef.current?.focus();
  }, [fieldErrors, formError]);

  useEffect(() => {
    if (isSuccessful) successRef.current?.focus();
  }, [isSuccessful]);

  const updateValue = <Field extends keyof IncidentReportFormValues>(
    field: Field,
    value: IncidentReportFormValues[Field],
  ) => {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const updateText =
    (field: keyof IncidentReportFormValues) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      updateValue(field, event.target.value as never);

  const safeErrorMessage = (kind: PublicApiErrorKind): string => {
    const errorMessages: Record<PublicApiErrorKind, string> = {
      validation: messages.errors.validation,
      'payload-too-large': messages.errors.payloadTooLarge,
      'unsupported-media': messages.errors.unsupportedMedia,
      'rate-limit': messages.errors.rateLimit,
      network: messages.errors.network,
      timeout: messages.errors.timeout,
      server: messages.errors.server,
    };
    return errorMessages[kind];
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submissionInProgress.current) return;

    const result = createIncidentReportSchema(locale, messages.validation).safeParse(values);
    if (!result.success) {
      setFieldErrors(getIncidentReportFieldErrors(result.error.issues));
      setFormError(messages.errors.validation);
      return;
    }

    submissionInProgress.current = true;
    setIsSubmitting(true);
    setFieldErrors({});
    setFormError(undefined);
    try {
      await submitIncidentReport(apiBaseUrl, result.data);
      setIsSuccessful(true);
    } catch (error) {
      setFormError(safeErrorMessage(error instanceof PublicApiError ? error.kind : 'server'));
    } finally {
      submissionInProgress.current = false;
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setValues(createEmptyIncidentReportValues());
    setFieldErrors({});
    setFormError(undefined);
    setIsSuccessful(false);
  };

  if (isSuccessful) {
    return (
      <section className="report-success" aria-labelledby="report-success-title">
        <div ref={successRef} tabIndex={-1}>
          <p className="status-badge">{messages.success.title}</p>
          <h2 id="report-success-title">{messages.success.title}</h2>
          <p>{messages.success.body}</p>
          <div className="action-row">
            <Link className="button button-primary" href={getPublicPath(locale, 'home')}>
              {messages.actions.home}
            </Link>
            <button className="button button-secondary" type="button" onClick={resetForm}>
              {messages.actions.another}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const selectedCategory = categories.find(({ id }) => id === values.categoryId);
  const selectedCategoryDescription =
    locale === 'ha' ? selectedCategory?.descriptionHa : selectedCategory?.descriptionEn;

  return (
    <form className="incident-report-form" onSubmit={handleSubmit} noValidate>
      {formError || Object.keys(fieldErrors).length > 0 ? (
        <div className="error-summary" ref={errorSummaryRef} tabIndex={-1} role="alert">
          <h2>{messages.validation.summaryTitle}</h2>
          {formError ? <p>{formError}</p> : null}
          {Object.entries(fieldErrors).length > 0 ? (
            <ul>
              {Object.entries(fieldErrors).map(([field, error]) => (
                <li key={field}>
                  <a href={`#${field}`}>{error}</a>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <fieldset className="form-section">
        <legend>{messages.sections.incident}</legend>
        <div className="form-field">
          <label htmlFor="categoryId">
            {messages.fields.category} <span>({messages.required})</span>
          </label>
          <p className="field-help" id="categoryId-help">
            {messages.fields.categoryHelp}
          </p>
          <select
            id="categoryId"
            value={values.categoryId}
            onChange={updateText('categoryId')}
            disabled={categoryState !== 'ready' || categories.length === 0}
            aria-invalid={Boolean(fieldErrors.categoryId)}
            aria-describedby={describedBy('categoryId-help', fieldErrors.categoryId)}
            required
          >
            <option value="">
              {categoryState === 'loading'
                ? messages.categories.loading
                : messages.categories.placeholder}
            </option>
            {categories.map((category) => (
              <option value={category.id} key={category.id}>
                {locale === 'ha' ? category.nameHa : category.nameEn}
              </option>
            ))}
          </select>
          {categoryState === 'error' ? (
            <div className="category-state" role="alert">
              <p>{messages.categories.error}</p>
              <button
                type="button"
                onClick={() => {
                  setCategoryState('loading');
                  setCategoryAttempt((attempt) => attempt + 1);
                }}
              >
                {messages.categories.retry}
              </button>
            </div>
          ) : null}
          {categoryState === 'ready' && categories.length === 0 ? (
            <p className="category-state" role="status">
              {messages.categories.empty}
            </p>
          ) : null}
          {selectedCategoryDescription ? (
            <p className="field-help">{selectedCategoryDescription}</p>
          ) : null}
          <FieldError id="categoryId-help-error" message={fieldErrors.categoryId} />
        </div>

        <div className="form-field">
          <label htmlFor="description">
            {messages.fields.description} <span>({messages.required})</span>
          </label>
          <p className="field-help" id="description-help">
            {messages.fields.descriptionHelp}
          </p>
          <textarea
            id="description"
            rows={8}
            maxLength={5000}
            value={values.description}
            onChange={updateText('description')}
            aria-invalid={Boolean(fieldErrors.description)}
            aria-describedby={describedBy('description-help', fieldErrors.description)}
            required
          />
          <p className="character-count" aria-live="polite">
            {messages.characterCount
              .replace('{current}', String(values.description.length))
              .replace('{maximum}', '5000')}
          </p>
          <FieldError id="description-help-error" message={fieldErrors.description} />
        </div>

        <fieldset className="nested-fieldset">
          <legend>
            {messages.fields.severity} <span>({messages.required})</span>
          </legend>
          <p className="field-help" id="severity-help">
            {messages.fields.severityHelp}
          </p>
          <div className="choice-group" aria-describedby="severity-help">
            {incidentSeverities.map((severity) => (
              <label key={severity}>
                <input
                  type="radio"
                  name="severity"
                  value={severity}
                  checked={values.severity === severity}
                  onChange={() => updateValue('severity', severity)}
                />
                <span>{messages.severity[severity]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>

      <fieldset className="form-section">
        <legend>{messages.sections.details}</legend>
        <p className="section-helper">{messages.optional}</p>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="incidentDate">{messages.fields.incidentDate}</label>
            <input
              id="incidentDate"
              type="date"
              value={values.incidentDate}
              onChange={updateText('incidentDate')}
              aria-invalid={Boolean(fieldErrors.incidentDate)}
              aria-describedby={fieldErrors.incidentDate ? 'incidentDate-error' : undefined}
            />
            <FieldError id="incidentDate-error" message={fieldErrors.incidentDate} />
          </div>
          <div className="form-field">
            <label htmlFor="incidentTime">{messages.fields.incidentTime}</label>
            <input
              id="incidentTime"
              type="time"
              value={values.incidentTime}
              onChange={updateText('incidentTime')}
              aria-invalid={Boolean(fieldErrors.incidentTime)}
              aria-describedby={fieldErrors.incidentTime ? 'incidentTime-error' : undefined}
            />
            <FieldError id="incidentTime-error" message={fieldErrors.incidentTime} />
          </div>
        </div>
        <div className="form-field">
          <label htmlFor="locationDescription">{messages.fields.locationDescription}</label>
          <p className="field-help" id="locationDescription-help">
            {messages.fields.locationHelp}
          </p>
          <input
            id="locationDescription"
            value={values.locationDescription}
            onChange={updateText('locationDescription')}
            maxLength={500}
            aria-invalid={Boolean(fieldErrors.locationDescription)}
            aria-describedby={describedBy(
              'locationDescription-help',
              fieldErrors.locationDescription,
            )}
          />
          <FieldError
            id="locationDescription-help-error"
            message={fieldErrors.locationDescription}
          />
        </div>
        <div className="form-grid">
          <div className="form-field">
            <label htmlFor="state">{messages.fields.state}</label>
            <input
              id="state"
              value={values.state}
              onChange={updateText('state')}
              maxLength={100}
              aria-invalid={Boolean(fieldErrors.state)}
              aria-describedby={fieldErrors.state ? 'state-error' : undefined}
            />
            <FieldError id="state-error" message={fieldErrors.state} />
          </div>
          <div className="form-field">
            <label htmlFor="lga">{messages.fields.lga}</label>
            <input
              id="lga"
              value={values.lga}
              onChange={updateText('lga')}
              maxLength={100}
              aria-invalid={Boolean(fieldErrors.lga)}
              aria-describedby={fieldErrors.lga ? 'lga-error' : undefined}
            />
            <FieldError id="lga-error" message={fieldErrors.lga} />
          </div>
        </div>
        <details className="coordinate-details">
          <summary>{messages.sections.coordinates}</summary>
          <p className="field-help" id="coordinates-help">
            {messages.fields.coordinatesHelp}
          </p>
          <div className="form-grid">
            <div className="form-field">
              <label htmlFor="latitude">{messages.fields.latitude}</label>
              <input
                id="latitude"
                type="number"
                inputMode="decimal"
                min="-90"
                max="90"
                step="any"
                value={values.latitude}
                onChange={updateText('latitude')}
                aria-invalid={Boolean(fieldErrors.latitude)}
                aria-describedby={
                  fieldErrors.latitude ? 'coordinates-help latitude-error' : 'coordinates-help'
                }
              />
              <FieldError id="latitude-error" message={fieldErrors.latitude} />
            </div>
            <div className="form-field">
              <label htmlFor="longitude">{messages.fields.longitude}</label>
              <input
                id="longitude"
                type="number"
                inputMode="decimal"
                min="-180"
                max="180"
                step="any"
                value={values.longitude}
                onChange={updateText('longitude')}
                aria-invalid={Boolean(fieldErrors.longitude)}
                aria-describedby={
                  fieldErrors.longitude ? 'coordinates-help longitude-error' : 'coordinates-help'
                }
              />
              <FieldError id="longitude-error" message={fieldErrors.longitude} />
            </div>
          </div>
        </details>
      </fieldset>

      <fieldset className="form-section contact-section">
        <legend>{messages.sections.contact}</legend>
        <label className="toggle-label" htmlFor="contactEnabled">
          <input
            id="contactEnabled"
            type="checkbox"
            checked={values.contactEnabled}
            onChange={(event) => updateValue('contactEnabled', event.target.checked)}
          />
          <span>{messages.fields.contactEnabled}</span>
        </label>
        <p className="field-help">{messages.fields.contactHelp}</p>
        {values.contactEnabled ? (
          <div className="contact-fields">
            <div className="form-field">
              <label htmlFor="name">{messages.fields.name}</label>
              <input
                id="name"
                value={values.name}
                onChange={updateText('name')}
                maxLength={160}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              />
              <FieldError id="name-error" message={fieldErrors.name} />
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="phone">{messages.fields.phone}</label>
                <input
                  id="phone"
                  type="tel"
                  value={values.phone}
                  onChange={updateText('phone')}
                  maxLength={32}
                  aria-invalid={Boolean(fieldErrors.phone)}
                  aria-describedby={fieldErrors.phone ? 'phone-error' : undefined}
                />
                <FieldError id="phone-error" message={fieldErrors.phone} />
              </div>
              <div className="form-field">
                <label htmlFor="email">{messages.fields.email}</label>
                <input
                  id="email"
                  type="email"
                  value={values.email}
                  onChange={updateText('email')}
                  maxLength={320}
                  aria-invalid={Boolean(fieldErrors.email)}
                  aria-describedby={fieldErrors.email ? 'email-error' : undefined}
                />
                <FieldError id="email-error" message={fieldErrors.email} />
              </div>
            </div>
            <fieldset className="nested-fieldset">
              <legend>{messages.fields.preferredContactMethod}</legend>
              <div className="choice-group">
                {preferredContactMethods.map((method) => (
                  <label key={method}>
                    <input
                      type="radio"
                      name="preferredContactMethod"
                      checked={values.preferredContactMethod === method}
                      onChange={() => updateValue('preferredContactMethod', method)}
                    />
                    <span>
                      {method === 'PHONE'
                        ? messages.fields.phoneMethod
                        : messages.fields.emailMethod}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="form-field">
              <label htmlFor="safeContactInstructions">
                {messages.fields.safeContactInstructions}
              </label>
              <p className="field-help" id="safeContactInstructions-help">
                {messages.fields.safeContactInstructionsHelp}
              </p>
              <textarea
                id="safeContactInstructions"
                rows={3}
                value={values.safeContactInstructions}
                onChange={updateText('safeContactInstructions')}
                maxLength={500}
                aria-invalid={Boolean(fieldErrors.safeContactInstructions)}
                aria-describedby={describedBy(
                  'safeContactInstructions-help',
                  fieldErrors.safeContactInstructions,
                )}
              />
              <FieldError
                id="safeContactInstructions-help-error"
                message={fieldErrors.safeContactInstructions}
              />
            </div>
            <label className="consent-label" htmlFor="consentToContact">
              <input
                id="consentToContact"
                type="checkbox"
                checked={values.consentToContact}
                onChange={(event) => updateValue('consentToContact', event.target.checked)}
                aria-invalid={Boolean(fieldErrors.consentToContact)}
                aria-describedby={
                  fieldErrors.consentToContact ? 'consentToContact-error' : undefined
                }
              />
              <span>{messages.fields.consent}</span>
            </label>
            <FieldError id="consentToContact-error" message={fieldErrors.consentToContact} />
          </div>
        ) : null}
      </fieldset>

      <div className="submission-notice">
        <p>{messages.outcomeNotice}</p>
      </div>
      <button
        className="button button-primary submit-report-button"
        type="submit"
        disabled={isSubmitting || categoryState !== 'ready' || categories.length === 0}
      >
        {isSubmitting ? messages.actions.submitting : messages.actions.submit}
      </button>
    </form>
  );
}
