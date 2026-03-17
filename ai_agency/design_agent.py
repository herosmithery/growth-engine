import os
import json
import logging
import google.generativeai as genai
from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Bypass macOS sandbox restrictions for Playwright
os.environ["PLAYWRIGHT_BROWSERS_PATH"] = os.path.join(os.getcwd(), ".playwright-browsers")

# We no longer use a static HTML template string here; Gemini will code custom React.

class DesignAgent:
    def __init__(self):
        self.gemini_key = os.environ.get("GEMINI_API_KEY")
        if self.gemini_key:
            genai.configure(api_key=self.gemini_key)
        self.model = genai.GenerativeModel('gemini-2.5-flash')
        
    def generate_redesign(self, business_name, niche, old_text_content, output_dir):
        """Uses Claude to map old website content into the premium Tailwind template."""
        logger.info(f"Generating templated redesign for {business_name} using Claude...")
        os.makedirs(output_dir, exist_ok=True)
        html_path = os.path.join(output_dir, "redesign.html")
        
        if not self.gemini_key:
            logger.error("GEMINI_API_KEY is missing.")
            return None
            
        prompt = f'''
        You are an elite Silicon Valley software engineer designing a premium, highly-converting website landing page for "{business_name}" in the "{niche}" niche.
        
        Information pulled from their old website:
        {old_text_content[:3000]}
        
        Write a complete, single-file pure React component using Tailwind CSS that I can drop directly into a Next.js App directory.
        Make it visually stunning. Use dark mode, glassmorphism (`backdrop-blur`), vivid gradients, and modern Framer Motion-style layout concepts (though output just valid Tailwind CSS since we can't install Framer here). Include a beautiful hero section, a services grid, and a testimonial section. Use lucide-react icons if needed (e.g. <svg> tags).
        
        Your response MUST be ONLY valid React code. Do NOT output markdown ticks (```jsx). Start exactly with "import React" or the component function. Do not include any text outside the code chunk itself.
        '''
        
        try:
            response = self.model.generate_content(
                contents=f"You must output ONLY raw React JSX string utilizing Tailwind classes. Do not use markdown wraps.\n\n{prompt}"
            )
            react_code = response.text.replace('```jsx', '').replace('```javascript', '').replace('```', '').strip()
            
            # Save the raw React code
            react_path = os.path.join(output_dir, "page.js")
            with open(react_path, "w") as f:
                f.write(react_code)
                
            # For backward compatibility with the preview modal currently reading .html,
            # we will still generate a quick static wrapper so it renders in the browser.
            html_wrapper = f"""
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <script src="https://cdn.tailwindcss.com"></script>
                <script src="https://unpkg.com/react@18/umd/react.development.js" crossorigin></script>
                <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js" crossorigin></script>
                <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
                <style>body {{ margin: 0; background: #0a0a0a; color: white; }}</style>
            </head>
            <body>
                <div id="root"></div>
                <script type="text/babel">
                    {react_code.replace('import React', '// import React').replace('export default', 'const App =')}
                    
                    const el_root = ReactDOM.createRoot(document.getElementById('root'));
                    el_root.render(<App />);
                </script>
            </body>
            </html>
            """
            
            with open(html_path, "w") as f:
                f.write(html_wrapper)
                
            return html_path
        except Exception as e:
            logger.error(f"Design generation failed: {e}")
            return None

    def capture_and_blur_screenshot(self, html_path, output_dir):
        """Opens the HTML in Playwright, takes a screenshot, and blurs it."""
        logger.info("Capturing and blurring screenshot...")
        screenshot_path = os.path.join(output_dir, "redesign_preview.png")
        blurred_path = os.path.join(output_dir, "blurred_preview.png")
        
        try:
            with sync_playwright() as p:
                try:
                    browser = p.chromium.launch(headless=True)
                    page = browser.new_page()
                    page.set_viewport_size({"width": 1280, "height": 800})
                    page.goto(f"file://{os.path.abspath(html_path)}", wait_until="networkidle")
                    
                    # Take screenshot
                    page.screenshot(path=screenshot_path)
                    browser.close()
                except Exception as inner_e:
                    logger.warning(f"Playwright Chromium launch failed (likely permission error). Creating fallback dummy image: {inner_e}")
                    img = Image.new('RGB', (1280, 800), color=(10, 10, 10))
                    img.save(screenshot_path)
                
            # Apply heavy 60% blur equivalents using GaussianBlur radius 25
            with Image.open(screenshot_path) as img:
                blurred_img = img.filter(ImageFilter.GaussianBlur(25)) 
                blurred_img.save(blurred_path)
                
            return blurred_path
        except Exception as e:
            logger.error(f"Screenshot/blur failed: {e}")
            return None
