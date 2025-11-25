from playwright.sync_api import sync_playwright

def verify_permissions_api():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Use a mobile viewport to trigger the "Android" logic simulation if needed,
        # but here we rely on the component rendering.
        # However, the code checks userAgent. We need to mock userAgent to be Android.
        context = browser.new_context(
            user_agent="Mozilla/5.0 (Linux; Android 10; SM-A205U) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
        )
        page = context.new_page()

        try:
            # Navigate to the app. Default port is 3000 but memory said 9002?
            # Let me check package.json to be sure about the port.
            # I'll try 3000 first, then 9002.
            try:
                page.goto("http://localhost:9002", timeout=60000)
            except Exception as e:
                print(f"Error navigating: {e}")
                return

            # The default page might be Flows. We need to go to Library tab.
            # Assuming Tabs are available.
            # Click on 'Library' tab.
            # Using get_by_role('tab', name='Library') as per best practices.
            # If it's a bottom nav, it might be a link or button.
            # Let's check if we can find "Library" text.
            page.get_by_text("Library").click()

            # Now we should see the "Observer Mode" card and "Permissions" card.
            # Wait for permissions card content to load.
            page.wait_for_timeout(2000)

            # Take a screenshot of the Library tab with Permissions.
            page.screenshot(path="verification/verification.png")
            print("Screenshot taken at verification/verification.png")

        except Exception as e:
            print(f"Error: {e}")
            # Take screenshot on error to debug
            page.screenshot(path="verification/error.png")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_permissions_api()
