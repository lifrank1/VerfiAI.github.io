#!/usr/bin/env python
import argparse
import json
import os
import requests

def generate_input_target_semantic(item, style):
    """
    Given a paper's data (from Semantic Scholar) and a citation style,
    generate an input prompt and a target citation string.
    """
    # Extract title and authors.
    title = item.get("title", "")
    authors = item.get("authors", [])
    author_names = [author.get("name", "") for author in authors if "name" in author]
    authors_str = ", ".join(author_names) if author_names else "Unknown Authors"
    
    # Extract publication year.
    year = item.get("year", "n.d.")
    
    # Extract DOI if available.
    external_ids = item.get("externalIds", {})
    doi = external_ids.get("DOI", "N/A")
    
    # Build the input prompt.
    input_str = f"generate citation for: {title} by {authors_str} published in {year}"
    
    # Build the target citation in the desired style.
    style = style.lower()
    if style == "ieee":
        target_str = f"{authors_str}, \"{title}\", {year}. DOI: {doi}"
    elif style == "mla":
        target_str = f"{authors_str}. \"{title}.\" {year}, doi:{doi}."
    elif style == "apa":
        target_str = f"{authors_str} ({year}). {title}. doi:{doi}"
    else:
        target_str = f"{authors_str}, \"{title}\", {year}. DOI: {doi}"
    
    return input_str, target_str

def query_semantic_scholar(query, limit, api_key=None):
    """
    Query the Semantic Scholar API to search for papers using the provided query.
    Returns a list of paper items.
    """
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    params = {
        "query": query,
        "limit": limit,
        "fields": "title,authors,year,externalIds"
    }
    headers = {}
    if api_key:
        headers["x-api-key"] = api_key
    response = requests.get(url, params=params, headers=headers)
    if response.status_code == 200:
        data = response.json()
        # "data" holds the list of papers.
        return data.get("data", [])
    else:
        print(f"Error fetching data: HTTP {response.status_code}")
        try:
            error_data = response.json()
            print("Response:", json.dumps(error_data, indent=2))
        except Exception:
            pass
        return []

def main():
    parser = argparse.ArgumentParser(
        description="Generate training data for citation generation using Semantic Scholar API."
    )
    parser.add_argument("--query", type=str, required=True,
                        help="Search query for papers (e.g., 'neural networks').")
    parser.add_argument("--rows", type=int, default=50,
                        help="Number of results to fetch from the API.")
    parser.add_argument("--style", type=str, default="IEEE",
                        help="Citation style: IEEE, MLA, or APA.")
    parser.add_argument("--output", type=str, default="semantic_train.jsonl",
                        help="Output JSONL file for training data.")
    parser.add_argument("--api_key", type=str, default=None,
                        help="Optional Semantic Scholar API key for higher rate limits.")
    args = parser.parse_args()

    print(f"Searching Semantic Scholar for papers matching: {args.query}")
    items = query_semantic_scholar(args.query, args.rows, api_key=args.api_key)
    if not items:
        print("No items found. Exiting.")
        return

    count = 0
    with open(args.output, "w", encoding="utf-8") as f:
        for item in items:
            input_str, target_str = generate_input_target_semantic(item, args.style)
            title = item.get("title", "")
            if title:  # Ensure we only output items with a valid title.
                example = {"input": input_str, "target": target_str}
                f.write(json.dumps(example) + "\n")
                count += 1

    print(f"Generated {count} training examples in {args.output}")

if __name__ == "__main__":
    main()
