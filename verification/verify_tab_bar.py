
from playwright.sync_api import Page, expect, sync_playwright
import time

def test_tab_bar_position(page: Page):
    # 1. Arrange: Go to the home page.
    # Updated port to 9002 based on dev_output.log
    page.goto("http://localhost:9002")

    # Wait for initialization
    page.wait_for_selector("text=Flows", timeout=60000)

    # 2. Act: Check for tab bar elements
    # The tab list contains 'Flows', 'History', 'Library'
    tabs_list = page.get_by_role("tablist")

    # 3. Assert: Verify it exists and is visible
    expect(tabs_list).to_be_visible()

    # 4. Screenshot: Capture the full page to verify positioning
    page.screenshot(path="verification/tab_bar_position.png", full_page=True)

    # Also verify that it is physically near the bottom.
    # We can do this by getting the bounding box and comparing to viewport height.
    box = tabs_list.bounding_box()
    viewport_size = page.viewport_size
    if box and viewport_size:
        print(f"Tabs list Y position: {box['y']}")
        print(f"Viewport height: {viewport_size['height']}")
        # It should be near the bottom.
        # Allow some margin for the element height itself and potential padding.
        # box['y'] should be > viewport_height - 100 (approx)
        assert box['y'] > viewport_size['height'] - 100, "Tabs list is not at the bottom"

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            test_tab_bar_position(page)
            print("Verification script finished successfully.")
        except Exception as e:
            print(f"Verification script failed: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()
