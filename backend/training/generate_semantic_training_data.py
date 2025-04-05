#!/usr/bin/env python
import argparse
import requests
import json
import os

def generate_input_target_semantic(item, style):
    # Extract title
    title = item.get("title", "")
    
    # Extract authors: Semantic Scholar returns a list of dicts with a "name" key.
    authors = item.get("authors", [])
    author_names = [author.get("name", "") for author in authors if "name" in author]
    authors_str = ", ".join(author_names) if author_names else "Unknown Authors"
    
    # Extract publication year
    year = item.get("year", "n.d.")
    
    # Extract DOI from externalIds if available
    external_ids = item.get("externalIds", {})
    doi = external_ids.get("DOI", "N/A")
    
    # Create input prompt (what you'll feed to the model)
    input_str = f"generate citation for: {title} by {authors_str} published in {year}"
    
    # Create target citation string based on desired style
    if style.lower() == "ieee":
        target_str = f"{authors_str}, \"{title}\", {year}. DOI: {doi}"
    elif style.lower() == "mla":
        target_str = f"{authors_str}. \"{title}.\" {year}, doi:{doi}."
    elif style.lower() == "apa":
        target_str = f"{authors_str} ({year}). {title}. doi:{doi}"
    else:
        target_str = f"{authors_str}, \"{title}\", {year}. DOI: {doi}"
        
    return input_str, target_str

def query_semantic_scholar(query, rows, api_key=None):
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    # Request externalIds instead of doi
    params = {
        "query": query,
        "limit": rows,
        "fields": "title,authors,year,externalIds"
    }
    headers = {}
    if api_key:
        headers["x-api-key"] = api_key
    
    response = requests.get(url, params=params, headers=headers)
    if response.status_code == 200:
        data = response.json()
        items = data.get("data", [])
        return items
    else:
        print(f"Error fetching from Semantic Scholar: HTTP {response.status_code}")
        try:
            error_data = response.json()
            print("Response:", json.dumps(error_data, indent=2))
        except Exception as e:
            print("Error parsing response:", e)
        return []

def main():
    parser = argparse.ArgumentParser(
        description="Generate training data for citation generation using Semantic Scholar API."
    )
    parser.add_argument("--query", type=str, required=True, help="Search query for papers.")
    parser.add_argument("--rows", type=int, default=50, help="Number of results to fetch.")
    parser.add_argument("--style", type=str, default="IEEE", help="Citation style: IEEE, MLA, or APA.")
    parser.add_argument("--output", type=str, default="semantic_train.jsonl", help="Output file name (JSONL format).")
    parser.add_argument("--api_key", type=str, default=None, help="Optional Semantic Scholar API key.")
    args = parser.parse_args()

    # Create output directory if it doesn't exist.
    output_dir = os.path.dirname(args.output)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)

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
            if title:  # Only output if a title exists
                example = {"input": input_str, "target": target_str}
                f.write(json.dumps(example) + "\n")
                count += 1

    print(f"Generated {count} training examples in {args.output}")

if __name__ == "__main__":
    main()
