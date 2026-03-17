import os
import json
import logging
import requests
from bs4 import BeautifulSoup
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ScoutAgent:
    def __init__(self):
        self.google_key = os.environ.get("GOOGLE_PLACES_API_KEY")
        self.firecrawl_key = os.environ.get("FIRECRAWL_API_KEY")
        genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))
        
    def find_businesses(self, industry, location, num_results=10):
        """Finds businesses using Google Places API."""
        logger.info(f"Scouting for {industry} in {location} using Google Places...")
        results = []
        
        if not self.google_key:
            logger.error("GOOGLE_PLACES_API_KEY missing.")
            return []

        try:
            headers = {
                "X-Goog-Api-Key": self.google_key,
                "X-Goog-FieldMask": "places.displayName,places.websiteUri,places.internationalPhoneNumber,places.rating,places.userRatingCount"
            }
            payload = {
                "textQuery": f"{industry} in {location}",
                "languageCode": "en",
                "pageSize": min(num_results, 20)
            }
            
            search_res = requests.post(
                'https://places.googleapis.com/v1/places:searchText',
                json=payload,
                headers=headers
            )
            search_res.raise_for_status()
            
            places = search_res.json().get("places", [])
            
            for p in places:
                url = p.get("websiteUri")
                name = p.get("displayName", {}).get("text", "Unknown Business")
                
                if not url: continue
                if any(x in url.lower() for x in ['yelp.', 'facebook.', 'linkedin.', 'angi.']): continue
                    
                results.append({
                    "name": name,
                    "website": url,
                    "phone": p.get("internationalPhoneNumber", ""),
                    "rating": p.get("rating", 0),
                    "reviews": p.get("userRatingCount", 0)
                })
                    
            logger.info(f"Found {len(results)} businesses via Google Places.")
            return results[:num_results]
        except Exception as e:
            logger.error(f"Google Places search failed: {e}")
            return []

    def scrape_website(self, url):
        """Scrapes website content prioritizing Firecrawl."""
        logger.info(f"Scraping {url}...")
        if self.firecrawl_key:
            try:
                from firecrawl import FirecrawlApp
                app = FirecrawlApp(api_key=self.firecrawl_key)
                scrape_result = app.scrape(url, formats=['markdown'])
                if hasattr(scrape_result, "get"):
                    return scrape_result.get('markdown', '')[:15000]
                return str(scrape_result)[:15000]
            except Exception as e:
                logger.warning(f"Firecrawl failed, falling back to basic requests: {e}")
                
        try:
            # Fallback
            headers = {'User-Agent': 'Mozilla/5.0'}
            response = requests.get(url, headers=headers, timeout=10)
            soup = BeautifulSoup(response.text, 'html.parser')
            for script in soup(["script", "style"]): script.extract()
            return soup.get_text(separator=' ', strip=True)[:10000]
        except Exception as e:
            logger.error(f"Failed to scrape {url}: {e}")
            return None

    def evaluate_lead(self, biz):
        """Analyzes website content using Gemini and scores the lead."""
        website_text = self.scrape_website(biz.get('website'))
        if not website_text: return None

        logger.info(f"Analyzing website for {biz['name']} using AI...")
        prompt = f'''
        Task 1: Determine if the website's content is "outdated" or poor.
        Task 2: Extract owner/manager email.
        Task 3: Extract a specific service/product.
        Task 4: Try to extract owner's First Name.
        Task 5: Does it mention an "after-hours receptionist" or 24/7 answering?
        
        Respond in strict JSON:
        - is_outdated (boolean)
        - outdated_reason (string)
        - owner_email (string/null)
        - owner_first_name (string/null)
        - specific_service (string/null)
        - has_after_hours_receptionist (boolean)
        
        Text: {website_text}
        '''
        
        try:
            model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"response_mime_type": "application/json"})
            response = model.generate_content(contents=prompt)
            analysis = json.loads(response.text)
            
            # Simple scoring logic: fewer reviews + outdated site + no after hours = hotter lead (lower score = hotter in this system, 0 is best)
            score = 100
            
            if analysis.get('is_outdated'): score -= 30
            if analysis.get('owner_email'): score -= 20
            if not analysis.get('has_after_hours_receptionist'): score -= 20
            
            # Less reviews implies more need for growth
            reviews = biz.get('reviews', 0)
            if reviews < 50: score -= 20
            elif reviews < 200: score -= 10
            
            tag = "HOT" if score <= 40 else "WARM" if score <= 70 else "COLD"
            
            return {
                "business_details": biz,
                "analysis": analysis,
                "score": max(0, min(100, score)),
                "tag": tag,
                "website_text": website_text
            }
        except Exception as e:
            logger.error(f"AI Analysis failed for {biz['name']}: {e}")
            return None

ResearchAgent = ScoutAgent
