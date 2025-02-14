import sys
import requests
from bs4 import BeautifulSoup

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
        soup = BeautifulSoup(response.text, "xml")
        entries = soup.find_all("entry")

        return [{"title": entry.title.text.strip(), "link": entry.id.text.strip()} for entry in entries] if entries else []
    return []

def search_semantic_scholar(query):
    """Search Semantic Scholar API for research papers."""
    base_url = "https://api.semanticscholar.org/graph/v1/paper/search"
    params = {"query": query, "limit": 5}

    response = requests.get(base_url, params=params)
    if response.status_code == 200:
        data = response.json()
        return [{"title": paper.get("title", "Unknown Title"), "link": f"https://www.semanticscholar.org/paper/{paper['paperId']}"} for paper in data.get("data", [])]
    return []

def search_retracted_papers(query):
    """Check if a paper is retracted using CrossRef Retraction Watch API."""
    base_url = "https://api.crossref.org/works"
    params = {"query.title": query, "filter": "type:retraction"}

    response = requests.get(base_url, params=params)
    if response.status_code == 200:
        data = response.json()
        return [{"title": item["title"][0], "doi": item["DOI"]} for item in data.get("message", {}).get("items", [])]
    return []

def main():
    if len(sys.argv) < 2:
        print("Error: Missing query argument")
        return
    
    query = sys.argv[1]

    results = {
        "arxiv": search_arxiv(query),
        "semantic_scholar": search_semantic_scholar(query),
        "retracted": search_retracted_papers(query)
    }

    print(results)

if __name__ == "__main__":
    main()
