// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { IncidentReportForm } from '../src/components/public/incident-report-form';
import { getMessages } from '../src/i18n';

const category = {
  id: '6bd8a2d5-d369-49f6-bf37-27a35a983a7d',
  nameHa: 'Wani lamari',
  nameEn: 'Other incident',
  descriptionHa: "Bayanin nau'in lamari.",
  descriptionEn: 'Description of the category.',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderForm(locale: 'ha' | 'en') {
  render(
    <IncidentReportForm
      locale={locale}
      messages={getMessages(locale).public.incidentReport}
      apiBaseUrl="http://localhost:4000/api"
    />,
  );
}

async function completeRequiredFields(
  user: ReturnType<typeof userEvent.setup>,
  locale: 'ha' | 'en',
) {
  await screen.findByRole('option', { name: locale === 'ha' ? category.nameHa : category.nameEn });
  await user.selectOptions(
    screen.getByLabelText(locale === 'ha' ? /Nau'in lamari/ : /Incident category/),
    category.id,
  );
  await user.type(
    screen.getByLabelText(locale === 'ha' ? /^Bayani/ : /^Description/, {
      selector: 'textarea',
    }),
    'A sufficiently detailed fake incident description.',
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('IncidentReportForm', () => {
  it('renders Hausa and English copy and localizes loaded categories', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse({ categories: [category] }))),
    );
    renderForm('ha');
    expect(screen.getByText('Bayanin lamarin')).toBeTruthy();
    expect(await screen.findByRole('option', { name: category.nameHa })).toBeTruthy();
    cleanup();

    renderForm('en');
    expect(screen.getByText('Incident information')).toBeTruthy();
    expect(await screen.findByRole('option', { name: category.nameEn })).toBeTruthy();
  });

  it('shows a safe localized category loading failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private network detail')));
    renderForm('en');

    expect(
      await screen.findByText('Incident categories could not be loaded. Please try again.'),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain('private network detail');
  });

  it('submits Hausa once, exposes no response identifier, and resets sensitive fields', async () => {
    const user = userEvent.setup();
    let resolveSubmission!: (response: Response) => void;
    const pendingSubmission = new Promise<Response>((resolve) => {
      resolveSubmission = resolve;
    });
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ categories: [category] }))
      .mockReturnValueOnce(pendingSubmission);
    vi.stubGlobal('fetch', fetcher);
    const browserStorageWrite = vi.spyOn(Storage.prototype, 'setItem');

    renderForm('ha');
    await completeRequiredFields(user, 'ha');
    await user.click(screen.getByLabelText(/Ina son a iya tuntubata/));
    await user.type(
      screen.getByLabelText('Imel', { selector: 'input[type="email"]' }),
      'fake@example.test',
    );
    await user.click(screen.getByLabelText('Imel', { selector: 'input[type="radio"]' }));
    await user.click(screen.getByLabelText(/Na yarda/));

    const submitButton = screen.getByRole('button', { name: 'Aika rahoto' });
    await user.dblClick(submitButton);
    expect(fetcher).toHaveBeenCalledTimes(2);
    resolveSubmission(jsonResponse({ success: true, internalCaseId: 'must-not-appear' }, 201));

    expect(await screen.findByRole('heading', { name: 'An karɓi rahotonka' })).toBeTruthy();
    expect(document.body.textContent).not.toContain('must-not-appear');
    const request = fetcher.mock.calls[1]![1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      submissionLanguage: 'ha',
      contact: { email: 'fake@example.test', consentToContact: true },
    });
    expect(browserStorageWrite).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Aika wani rahoto' }));
    await user.click(screen.getByLabelText(/Ina son a iya tuntubata/));
    expect(
      (screen.getByLabelText('Imel', { selector: 'input[type="email"]' }) as HTMLInputElement)
        .value,
    ).toBe('');
  });

  it('submits English with automatic language and omits disabled contact', async () => {
    const user = userEvent.setup();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ categories: [category] }))
      .mockResolvedValueOnce(jsonResponse({ success: true }, 201));
    vi.stubGlobal('fetch', fetcher);
    renderForm('en');
    await completeRequiredFields(user, 'en');

    await user.click(screen.getByRole('button', { name: 'Submit report' }));
    await screen.findByRole('heading', { name: 'Your report was received' });

    const request = fetcher.mock.calls[1]![1] as RequestInit;
    const body = JSON.parse(String(request.body)) as Record<string, unknown>;
    expect(body.submissionLanguage).toBe('en');
    expect(body).not.toHaveProperty('contact');
  });

  it('renders the safe rate-limit message without raw API details', async () => {
    const user = userEvent.setup();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ categories: [category] }))
      .mockResolvedValueOnce(
        jsonResponse({ message: 'internal limiter state and identifier' }, 429),
      );
    vi.stubGlobal('fetch', fetcher);
    renderForm('en');
    await completeRequiredFields(user, 'en');
    await user.click(screen.getByRole('button', { name: 'Submit report' }));

    expect(
      await screen.findByText(
        'There have been too many submission attempts. Wait before trying again.',
      ),
    ).toBeTruthy();
    expect(document.body.textContent).not.toContain('internal limiter state');
    await waitFor(() => expect(screen.getByRole('alert')).toBe(document.activeElement));
  });
});
