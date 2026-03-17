import os
import time
import base64
import google.generativeai as genai
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "/Users/johnkraeger/Downloads/growth engine/ai_agency/pw-browsers"
os.environ["TMPDIR"] = "/Users/johnkraeger/Downloads/growth engine/ai_agency/pw-tmp"

load_dotenv("../.env")
genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

TARGET_FILE = "/Users/johnkraeger/Downloads/growth engine/public/admin-dashboard.html"
TARGET_URL = "file:///Users/johnkraeger/Downloads/growth engine/public/admin-dashboard.html"
SCREENSHOT_FILE = "ui_screenshot.png"

def take_screenshot():
    """Uses Playwright to headlessly render the HTML and take a full-page screenshot."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        # Navigate to the localhost Next.js server
        page.goto(TARGET_URL)
        # Wait a moment for rendering/React to load
        page.wait_for_timeout(3000)
        # Take full page screenshot
        page.screenshot(path=SCREENSHOT_FILE, full_page=True)
        browser.close()

def evaluate_ui():
    """Sends the screenshot and code to Gemini to evaluate the UX."""
    with open(TARGET_FILE, "r") as f:
        html_code = f.read()
        
    # Read the image
    with open(SCREENSHOT_FILE, "rb") as image_file:
        encoded_string = base64.b64encode(image_file.read()).decode("utf-8")
        
    image_parts = [
        {
            "mime_type": "image/png",
            "data": encoded_string
        }
    ]

    system_instruction = """You are an expert UX/UI designer and frontend engineer. 
    You are evaluating a generated dashboard based on its code and a screenshot of the rendered output.
    Grade the UI on a scale of 0 to 100 based on:
    1. Aesthetics: Does it look modern, clean, and premium?
    2. Layout: Are the elements spaced well? Is it responsive-looking?
    3. Functionality/Completeness: Does it have necessary dashboard components (sidebar, stats, client list, dropdowns)?
    4. Bugs: Are there visible rendering errors, missing CSS, or overlapping text?
    
    Output strictly the final score as a number between 0 and 100 on the first line. 
    You can include brief reasoning on subsequent lines.
    """
    
    model = genai.GenerativeModel("gemini-1.5-flash", system_instruction=system_instruction)
    
    prompt = f"Here is the HTML code:\n\n{html_code}\n\nAnd I have attached the screenshot of how it rendered. Grade the UI."
    
    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = model.generate_content([prompt, image_parts[0]])
            # Extract the score from the first line
            first_line = response.text.strip().split('\n')[0].strip()
            score = float(first_line)
            print(f"ux_score: {score}")
            print("Reasoning:")
            print(response.text)
            return
        except Exception as e:
            if "429" in str(e):
                print(f"Rate limited. Retrying {attempt+1}/{max_retries} in 15s...")
                time.sleep(15)
            else:
                print(f"Error evaluating UI: {e}")
                print("ux_score: 0")
                return
                
    print(f"Error evaluating UI: max retries exceeded.")
    print("ux_score: 0")

def main():
    print("Capturing UI screenshot...")
    try:
        take_screenshot()
    except Exception as e:
        print(f"Playwright error (UI probably broken): {e}")
        print("ux_score: 0")
        return
        
    print("Evaluating UI with LLM Judge...")
    evaluate_ui()

if __name__ == "__main__":
    main()
