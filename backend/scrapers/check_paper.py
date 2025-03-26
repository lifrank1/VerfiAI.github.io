import sys
import requests
import json
import re
from bs4 import BeautifulSoup

def is_doi(query):
    """Check if the query is a DOI"""
    # Simple DOI pattern check
    doi_pattern = re.compile(r'^10\.\d{4,9}/[-._;()/:A-Z0-9]+$', re.IGNORECASE)
    return bool(doi_pattern.match(query.strip()))

def search_arxiv(query):
    """Search ArXiv API for research papers."""
    base_url = "http://export.arxiv.org/api/query"
    params = {
        "search_query": f"all:{query}",
        "start": 0,
        "max_results": 5
    }

    response = requests.get(base_url, params=params)
    if response.status_code == 200:
        soup = BeautifulSoup(response.text, "lxml-xml")  # Explicitly use lxml parser
        entries = soup.find_all("entry")

        return [{"title": entry.title.text.strip(), "link": entry.id.text.strip()} for entry in entries] if entries else []
    return []

def search_semantic_scholar(query):
    """Search Semantic Scholar API for research papers."""
    base_url = "https://api.semanticscholar.org/graph/v1/paper/search"
    params = {
        "query": query,
        "limit": 5
    }
    
    headers = {
        "Accept": "application/json"
    }

    response = requests.get(base_url, params=params, headers=headers)
    if response.status_code == 200:
        data = response.json()
        return [{"title": paper.get("title", ""), "paperId": paper.get("paperId", "")} 
                for paper in data.get("data", [])] if "data" in data else []
    return []

def search_retracted_papers(query):
    """Check if a paper is retracted using CrossRef Retraction Watch API."""
    base_url = "https://api.crossref.org/works"
    
    # If query is a DOI, search directly
    if is_doi(query):
        params = {"filter": f"doi:{query},type:retraction"}
    else:
        params = {"query.title": query, "filter": "type:retraction"}

    response = requests.get(base_url, params=params)
    if response.status_code == 200:
        data = response.json()
        return [{"title": item["title"][0], "doi": item["DOI"]} for item in data.get("message", {}).get("items", [])]
    return []

def search_crossref_by_doi(doi):
    """Search for a paper by DOI in CrossRef"""
    if not is_doi(doi):
        return []
        
    base_url = f"https://api.crossref.org/works/{doi}"
    headers = {
        "User-Agent": "VerifAI/1.0"
    }
    
    try:
        response = requests.get(base_url, headers=headers)
        if response.status_code == 200:
            data = response.json()["message"]
            return [{
                "title": data.get("title", [""])[0],
                "doi": doi,
                "publisher": data.get("publisher", ""),
                "year": data.get("published-print", {}).get("date-parts", [[""]])[0][0] if "published-print" in data else ""
            }]
    except Exception as e:
        print(f"Error searching CrossRef: {e}")
    
    return []

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Missing query argument"}))
        return
    
    query = sys.argv[1]
    
    # Additional check for DOI-specific searches
    crossref_results = []
    if is_doi(query):
        crossref_results = search_crossref_by_doi(query)

    results = {
        "arxiv": search_arxiv(query),
        "semantic_scholar": search_semantic_scholar(query),
        "retracted": search_retracted_papers(query),
        "crossref": crossref_results
    }

    print(json.dumps(results))

if __name__ == "__main__":
    main()
