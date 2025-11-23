from playwright.sync_api import sync_playwright

def verify_home_page():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Listen for console logs
        page.on("console", lambda msg: print(f"Console: {msg.text}"))
        page.on("pageerror", lambda err: print(f"Page Error: {err}"))

        try:
            page.goto("http://localhost:9002")
            page.wait_for_load_state('networkidle')

            # Wait for "Flows" tab trigger to be visible, ensuring hydration
            page.wait_for_selector('text=Flows')

            # Take a screenshot
            page.screenshot(path="verification/home_page.png")
            print("Screenshot taken successfully")
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_home_page()
