// @vitest-environment jsdom

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AdminLanding } from '../src/components/admin/admin-landing';
import { AdminLoginForm } from '../src/components/admin/admin-login-form';

const navigation = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => navigation }));

const apiBaseUrl = 'http://localhost:4000/api';

afterEach(() => {
  cleanup();
  navigation.replace.mockReset();
  navigation.refresh.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('admin authentication web foundation', () => {
  it('renders independently localized Hausa and English login interfaces', () => {
    render(<AdminLoginForm locale="ha" apiBaseUrl={apiBaseUrl} sessionExpired={false} />);
    expect(screen.getByRole('heading', { name: 'Shiga sashen gudanarwa' })).toBeTruthy();
    expect(screen.getByLabelText('Imel na ma\u0027aikaci')).toBeTruthy();
    expect(screen.queryByText(/register|rajista/i)).toBeNull();
    cleanup();

    render(<AdminLoginForm locale="en" apiBaseUrl={apiBaseUrl} sessionExpired />);
    expect(screen.getByRole('heading', { name: 'Sign in to administration' })).toBeTruthy();
    expect(screen.getByText(/session has expired/i)).toBeTruthy();
    expect(screen.queryByText(/forgot password|register/i)).toBeNull();
  });

  it('submits cookies with credentials include, prevents double submission, and uses no browser storage', async () => {
    const user = userEvent.setup();
    let finish!: (response: Response) => void;
    const pending = new Promise<Response>((resolveResponse) => {
      finish = resolveResponse;
    });
    const fetcher = vi.fn().mockReturnValue(pending);
    vi.stubGlobal('fetch', fetcher);
    const storageWrite = vi.spyOn(Storage.prototype, 'setItem');
    render(<AdminLoginForm locale="en" apiBaseUrl={apiBaseUrl} sessionExpired={false} />);

    await user.type(screen.getByLabelText('Staff email'), 'staff@example.test');
    await user.type(screen.getByLabelText('Password'), 'Fake-development-password-42!');
    await user.dblClick(screen.getByRole('button', { name: 'Sign in' }));
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:4000/api/auth/staff/login',
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
    expect(storageWrite).not.toHaveBeenCalled();

    finish(new Response(JSON.stringify({ authenticated: true }), { status: 200 }));
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/admin?lang=en'));
  });

  it('shows a generic error without rendering raw API details', async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: 'unknown email database detail' }), {
          status: 401,
        }),
      ),
    );
    render(<AdminLoginForm locale="en" apiBaseUrl={apiBaseUrl} sessionExpired={false} />);
    await user.type(screen.getByLabelText('Staff email'), 'unknown@example.test');
    await user.type(screen.getByLabelText('Password'), 'Fake-development-password-42!');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'The supplied credentials could not be accepted.',
    );
    expect(document.body.textContent).not.toContain('database detail');
  });

  it('renders a minimal authenticated principal without dashboard or moderation tools', () => {
    render(
      <AdminLanding
        locale="en"
        apiBaseUrl={apiBaseUrl}
        principal={{
          id: 'user-id',
          email: 'staff@example.test',
          name: 'Test Staff',
          role: 'MODERATOR',
        }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Administration area' })).toBeTruthy();
    expect(screen.getByText('Welcome, Test Staff.')).toBeTruthy();
    expect(screen.getByText('MODERATOR')).toBeTruthy();
    expect(screen.queryByText(/incident queue|analytics|contact reveal/i)).toBeNull();
  });

  it('logs out with included credentials and returns to the login route', async () => {
    const user = userEvent.setup();
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    render(
      <AdminLanding
        locale="ha"
        apiBaseUrl={apiBaseUrl}
        principal={{
          id: 'user-id',
          email: 'staff@example.test',
          name: 'Ma\u0027aikacin Gwaji',
          role: 'ANALYST',
        }}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Fita' }));
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:4000/api/auth/staff/logout',
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
    await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('/admin/login?lang=ha'));
  });

  it('uses server-side session checks for both admin routes', () => {
    const landingSource = readFileSync(
      resolve(process.cwd(), 'src/app/(default)/admin/page.tsx'),
      'utf8',
    );
    const loginSource = readFileSync(
      resolve(process.cwd(), 'src/app/(default)/admin/login/page.tsx'),
      'utf8',
    );
    expect(landingSource).toContain('await getAdminPrincipal()');
    expect(landingSource).toContain('redirect(`/admin/login?lang=${locale}&reason=expired`)');
    expect(loginSource).toContain('if (principal) redirect(`/admin?lang=${locale}`)');
  });
});
