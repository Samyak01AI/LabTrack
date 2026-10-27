from __future__ import annotations

import os
import secrets
import subprocess
import uuid
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:3000'

run_id = uuid.uuid4().hex[:10]
student_name = 'E2E Student'
student_email = f'e2e-student-{run_id}@example.edu'
student_password = f'Student-{secrets.token_urlsafe(24)}'
teacher_email = f'e2e-teacher-{run_id}@example.edu'
teacher_password = f'Teacher-{secrets.token_urlsafe(24)}'
assignment_code = f'E2E-{run_id.upper()}'
assignment_title = f'Browser Test LRU Cache {run_id}'
assignment_statement = 'Implement an LRU cache with get and put operations in constant average time.'


def provision_teacher() -> None:
    env = os.environ.copy()
    env.update({
        'TEACHER_NAME': 'E2E Teacher',
        'TEACHER_EMAIL': teacher_email,
        'TEACHER_PASSWORD': teacher_password,
    })
    provision_script = """
      import 'dotenv/config';
      if (!process.env.LABTRACK_TEST_DATABASE_URL) throw new Error('LABTRACK_TEST_DATABASE_URL is required.');
      process.env.LABTRACK_PROVISION_TARGET = 'test';
      await import('./scripts/provision-teacher.mjs');
    """
    result = subprocess.run(
        ['node', '--input-type=module', '-e', provision_script],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0 or 'Teacher account provisioned in the test database.' not in result.stdout:
        raise RuntimeError('Could not provision the disposable browser-test teacher account.\n' + result.stderr)


def clean_test_accounts() -> None:
    env = os.environ.copy()
    env['LABTRACK_E2E_EMAILS'] = f'{student_email},{teacher_email}'
    script = """
      import 'dotenv/config';
      import mysql from 'mysql2/promise';
      const emails = (process.env.LABTRACK_E2E_EMAILS || '').split(',').filter(Boolean);
      const databaseUrl = process.env.LABTRACK_TEST_DATABASE_URL;
      if (!databaseUrl) throw new Error('LABTRACK_TEST_DATABASE_URL is required.');
      const parsed = new URL(databaseUrl);
      if (!['mysql:', 'mysqls:'].includes(parsed.protocol)
          || !['localhost', '127.0.0.1', '::1', '[::1]'].includes(parsed.hostname)) {
        throw new Error('Browser-test cleanup refuses non-loopback MySQL URLs.');
      }
      const pool = mysql.createPool({
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 3306,
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        database: decodeURIComponent(parsed.pathname.slice(1)),
        timezone: 'Z',
        dateStrings: true,
      });
      try {
        await pool.execute('DELETE FROM assignments WHERE created_by IN (SELECT id FROM users WHERE email IN (?, ?))', emails);
        await pool.execute('DELETE FROM users WHERE email IN (?, ?)', emails);
      } finally { await pool.end(); }
    """
    result = subprocess.run(
        ['node', '--input-type=module', '-e', script],
        cwd=ROOT,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise RuntimeError('Could not remove disposable browser-test records.\n' + result.stderr)

try:
    provision_teacher()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path='/usr/bin/chromium',
            args=['--no-sandbox'],
        )
        page = browser.new_page(viewport={'width': 1440, 'height': 1050})
        page_errors: list[str] = []
        auth_responses: list[str] = []
        page.on('pageerror', lambda error: page_errors.append(str(error)))
        page.on('response', lambda response: auth_responses.append(f'{response.request.method} {response.status} {response.url.rsplit("/", 1)[-1]}') if '/api/auth/' in response.url else None)

        page.goto(f'{BASE}/register', wait_until='networkidle')
        assert page.title() == 'LabTrack — DSA Workbench'
        page.screenshot(path='/tmp/labtrack-i2-auth-desktop.png', full_page=True)
        page.get_by_label('Full name').fill(student_name)
        page.get_by_label('Institutional email').fill(student_email)
        page.locator('#password').fill(student_password)
        page.locator('#confirmPassword').fill(student_password)
        page.locator('form button[type="submit"]').click()
        try:
            page.wait_for_url('**/student/dashboard', timeout=15000)
        except Exception:
            page.screenshot(path='/tmp/labtrack-web-i2-signup-failure.png', full_page=True)
            print(f'DEBUG signup URL={page.url}; API auth responses={auth_responses}; alerts={page.locator("[role=alert]").all_inner_texts()}')
            raise
        page.get_by_role('heading', name='Welcome back, E2E').wait_for()
        page.get_by_text('No published assignments yet', exact=True).wait_for()
        assert page.locator('.metric-card').first.locator('.metric-value').inner_text() == '0'
        page.get_by_role('link', name='Assignments').click()
        assert page.evaluate('window.location.hash') == '#assignment-list'
        print('PASS student self-registration, cookie-backed login, dashboard route, real empty-state counts')

        page.get_by_role('button', name='Sign out').click()
        page.wait_for_url('**/login', timeout=10000)
        page.locator('.role-tab').nth(1).click()
        page.get_by_label('Institutional email').fill(teacher_email)
        page.locator('#password').fill(teacher_password)
        page.locator('form button[type="submit"]').click()
        page.wait_for_url('**/teacher/assignments', timeout=15000)
        page.get_by_role('heading', name='Assignment management').wait_for()
        page.get_by_role('button', name='Create assignment').click()
        dialog = page.get_by_role('dialog')
        dialog.get_by_label('Assignment code').fill(assignment_code)
        dialog.get_by_label('Title').fill(assignment_title)
        dialog.get_by_label('Topic').fill('Hash Map / Linked List')
        dialog.get_by_label('Short summary').fill('A browser-tested assignment with persisted details.')
        dialog.get_by_label('Problem statement').fill(assignment_statement)
        dialog.locator('textarea').nth(2).fill('[{"input":"get 7","expectedOutput":"-1","explanation":"Missing keys return -1."}]')
        dialog.get_by_role('button', name='Save as draft').click()
        row = page.locator('tr').filter(has_text=assignment_code)
        row.wait_for()
        assert assignment_title in row.inner_text()
        status_pill = row.locator('.status-pill')
        expect(status_pill).to_contain_text('draft')
        row.get_by_role('button', name='Publish').click()
        expect(status_pill).to_contain_text('published')
        page.screenshot(path='/tmp/labtrack-i2-teacher-desktop.png', full_page=True)
        page.set_viewport_size({'width': 390, 'height': 844})
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'teacher assignments page has horizontal overflow at 390px'
        page.set_viewport_size({'width': 1440, 'height': 1050})
        print('PASS teacher login, persisted draft creation, and publish transition')

        page.get_by_role('button', name='Sign out').click()
        page.wait_for_url('**/login', timeout=10000)
        page.locator('.role-tab').nth(0).click()
        page.get_by_label('Institutional email').fill(student_email)
        page.locator('#password').fill(student_password)
        page.locator('form button[type="submit"]').click()
        page.wait_for_url('**/student/dashboard', timeout=15000)
        student_row = page.locator('tr').filter(has_text=assignment_code)
        student_row.wait_for()
        assert assignment_title in student_row.inner_text()
        assert page.locator('.metric-card').first.locator('.metric-value').inner_text() == '1'
        page.screenshot(path='/tmp/labtrack-i2-student-desktop.png', full_page=True)
        student_row.locator('a').last.click()
        page.wait_for_url('**/student/assignments/*', timeout=10000)
        page.get_by_role('heading', name=assignment_title).wait_for()
        page.get_by_text(assignment_statement, exact=True).wait_for()
        page.get_by_text('Supported languages').wait_for()
        page.get_by_text('The sandboxed editor is introduced in the next implementation stage.', exact=False).wait_for()
        page.screenshot(path='/tmp/labtrack-i2-viewer-desktop.png', full_page=True)
        print('PASS student sees only published assignment and loads saved specification details')

        page.set_viewport_size({'width': 390, 'height': 844})
        page.wait_for_timeout(250)
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'mobile page has horizontal overflow'
        page.goto(f'{BASE}/student/dashboard', wait_until='networkidle')
        page.get_by_role('button', name='Toggle navigation').click()
        mobile_navigation = page.get_by_role('navigation', name='Mobile navigation')
        assert mobile_navigation.is_visible()
        dashboard_link = mobile_navigation.get_by_role('link', name='Dashboard')
        assert dashboard_link.is_visible()
        expect(dashboard_link).to_have_css('color', 'rgb(255, 255, 255)')
        assert mobile_navigation.get_by_role('link', name='Assignments').is_visible()
        assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'mobile navigation has horizontal overflow'
        print('PASS 390px assignment viewer and mobile navigation without page-level overflow')

        assert not page_errors, 'uncaught browser exceptions: ' + '; '.join(page_errors)
        print('PASS no uncaught browser JavaScript exceptions')
        page.screenshot(path='/tmp/labtrack-web-i2-mobile.png', full_page=True)
        browser.close()
finally:
    clean_test_accounts()

print('Browser UI smoke test completed; temporary student, teacher, and assignment records were removed.')
