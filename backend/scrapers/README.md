# Scrapers
## Overview
The VerifAI Web Scraper checks if a research paper exists in major academic databases and verifies its credibility. It integrates with the backend API to fetch research paper details from:

1. ArXiv API 
2. Semantic Scholar API 
3. Retraction Watch 

This scraper helps verify  citations and detect AI-generated false references.

## Installation Requirement:
pip install requests beautifulsoup4
pip install lxml

# Sample run:
python3 backend/scrapers/check_paper.py "deep learning"
