from playwright.sync_api import sync_playwright

def verify_flow_creation():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a mobile viewport to match the app style
        context = browser.new_context(viewport={"width": 375, "height": 812})
        page = context.new_page()

        try:
            # 1. Navigate to the app
            page.goto("http://localhost:9002")

            # Wait for app to load (checking for 'Flows' tab or header)
            page.wait_for_selector("text=Flows")

            # 2. Click "Create Flow"
            page.click("button:has-text('Create Flow')")

            # 3. Fill in the form
            # Name
            page.fill("input[name='name']", "My Test Flow")

            # Trigger Type (default is MANUAL)
            # Let's change it to DEEP_LINK
            page.click("button:has-text('MANUAL')") # Opens select
            page.click("div[role='option']:has-text('DEEP_LINK')") # Selects option

            # Fill Deep Link Event
            page.fill("input[name='trigger.details.event']", "test_event")

            # Action Type (default is LOG)
            # Let's add a second action
            page.click("button:has-text('Add Action')")

            # Change second action to NOTIFICATION
            # The second action will be at index 1
            # We need to target the select for the second action.
            # Since we have multiple selects, we need to be careful.
            # The first select is for Trigger Type, then Action 0 Type, then Action 1 Type.
            # Using specific locators if possible.

            # Assuming the order in DOM is Trigger -> Action 0 -> Action 1
            select_buttons = page.locator("button[role='combobox']")
            # 0: Trigger Type
            # 1: Action 0 Type
            # 2: Action 1 Type

            select_buttons.nth(2).click()
            page.click("div[role='option']:has-text('NOTIFICATION')")

            # Fill Notification details
            page.fill("input[name='actions.1.details.title']", "Hello World")
            page.fill("input[name='actions.1.details.body']", "This is a test notification")

            # 4. Take Screenshot
            page.screenshot(path="verification/flow_creation.png")
            print("Screenshot saved to verification/flow_creation.png")

        except Exception as e:
            print(f"Error: {e}")
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_flow_creation()
