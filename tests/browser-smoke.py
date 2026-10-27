from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = 'http://127.0.0.1:4173/'
SCREENSHOT = '/tmp/labtrack-iteration0.png'

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={"width": 1440, "height": 1100})
    page.goto(BASE, wait_until='networkidle')
    page.screenshot(path=SCREENSHOT, full_page=True)

    assert page.title() == 'LabTrack — Faculty Register'
    assert page.locator('#metric-total').inner_text() == '6'
    assert page.locator('#metric-complete').inner_text() == '3'
    assert page.locator('#metric-incomplete').inner_text() == '2'
    assert page.locator('#metric-rate').inner_text() == '50%'
    assert page.locator('#student-rows tr').count() == 6
    assert not page.locator('#empty-state').is_visible()
    assert page.locator('#student-rows .status-chip').count() == 0
    print('PASS page load + derived demo metrics (6 total; 3 complete; 2 incomplete; 50%)')

    page.locator('#search-input').fill('No matching student')
    assert page.locator('#student-rows tr').count() == 0
    assert page.locator('#empty-state').is_visible()
    page.locator('#clear-filters').click()
    assert page.locator('#student-rows tr').count() == 6
    print('PASS empty-state display and filter recovery')

    page.locator('#search-input').fill('Rohan')
    assert page.locator('#student-rows tr').count() == 1
    assert 'Rohan Mukherjee' in page.locator('#student-rows').inner_text()
    page.locator('#clear-filters').click()
    page.locator('#status-filter').select_option('Incomplete')
    assert page.locator('#student-rows tr').count() == 2
    print('PASS search and status dropdown filters')

    page.locator('#clear-filters').click()
    page.locator('#date-from').fill('2026-10-15')
    page.locator('#date-to').fill('2026-10-14')
    assert page.locator('#filter-error').is_visible()
    assert 'on or before' in page.locator('#filter-error').inner_text()
    page.locator('#clear-filters').click()
    print('PASS date inputs reject a reversed range')

    page.locator('#open-add-student').click()
    page.locator('#student-form button[type="submit"]').click()
    assert page.locator('#form-error').is_visible()
    assert 'student name' in page.locator('#form-error').inner_text()
    print('PASS blank student rejected')

    page.locator('#student-name').fill('Duplicate Example')
    page.locator('#student-id').fill('cs26b042')
    page.locator('#student-section').select_option('Section A')
    page.locator('#student-date').fill('2026-10-14')
    page.locator('#student-form button[type="submit"]').click()
    assert 'already in the register' in page.locator('#form-error').inner_text()
    print('PASS duplicate ID rejected case-insensitively')

    page.locator('#student-name').fill('Taylor Example')
    page.locator('#student-id').fill('CS26B777')
    page.locator('#student-section').select_option('Section A')
    page.locator('#student-date').fill('2026-10-14')
    page.locator('#student-status').select_option('Incomplete')
    page.locator('#student-form button[type="submit"]').click()
    assert page.locator('#student-rows tr').count() == 7
    assert page.locator('#metric-total').inner_text() == '7'
    assert page.locator('#metric-incomplete').inner_text() == '3'
    assert page.locator('#metric-complete').inner_text() == '3'
    print('PASS valid student saved; Incomplete remains excluded from Complete count')

    page.reload(wait_until='networkidle')
    assert page.locator('#metric-total').inner_text() == '7'
    assert 'Taylor Example' in page.locator('#student-rows').inner_text()
    print('PASS localStorage persistence across reload')

    page.set_viewport_size({"width": 390, "height": 844})
    page.screenshot(path='/tmp/labtrack-iteration0-mobile.png', full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= window.innerWidth')
    assert page.locator('#open-add-student').is_visible()
    print('PASS mobile layout at 390px without page-level horizontal overflow')

    browser.close()

print(f'Browser screenshot: {SCREENSHOT}')
