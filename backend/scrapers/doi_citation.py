import json
import requests
import torch
import os
import re
from transformers import GPT2LMHeadModel, GPT2Tokenizer, pipeline

# Set the local path to your fine-tuned GPT-2 citation-generation model.
FINE_TUNED_MODEL_PATH = "/Users/Carli/VerfiAI/backend/models/my_finetuned_citation_gpt2_model"


# Load the model and tokenizer from the local directory using local_files_only=True.
model = GPT2LMHeadModel.from_pretrained(FINE_TUNED_MODEL_PATH, local_files_only=True)
tokenizer = GPT2Tokenizer.from_pretrained(FINE_TUNED_MODEL_PATH, local_files_only=True)
# Set pad_token since GPT-2 doesn't have one by default.
tokenizer.pad_token = tokenizer.eos_token

# Now create the text-generation pipeline with the loaded model and tokenizer.
citation_generator = pipeline(
    "text-generation",
    model=model,
    tokenizer=tokenizer,
    pad_token_id=50256
)

def get_paper_by_doi(doi):
    """Fetch paper details from CrossRef using DOI."""
    doi = doi.replace("https://doi.org/", "").strip()
    url = f"https://api.crossref.org/works/{doi}"
    headers = {"User-Agent": "VerifAI/1.0"}
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()['message']
            # Extract references if available.
            references = []
            if 'reference' in data:
                for ref in data.get('reference', []):
                    reference_item = {
                        'key': ref.get('key', ''),
                        'doi': ref.get('DOI', ''),
                        'title': '',
                        'authors': [],
                        'year': '',
                        'unstructured': ref.get('unstructured', ''),
                        'verification_status': 'pending'
                    }
                    if 'article-title' in ref:
                        reference_item['title'] = ref['article-title']
                    elif 'unstructured' in ref:
                        reference_item['title'] = ref['unstructured']
                    
                    if 'author' in ref:
                        reference_item['authors'] = ref['author'].split(',')
                    
                    if 'year' in ref:
                        reference_item['year'] = ref['year']
                    
                    references.append(reference_item)
            
            return {
                'title': data.get('title', [''])[0],
                'authors': [f"{author.get('given', '')} {author.get('family', '')}".strip() 
                            for author in data.get('author', [])],
                'year': str(data.get('published-print', {}).get('date-parts', [['']])[0][0]),
                'doi': doi,
                'abstract': data.get('abstract', ''),
                'references': references
            }
    except Exception as e:
        print(f"Error fetching DOI from CrossRef: {e}")
    return None

def get_paper_by_doi_semantic(doi):
    """Fetch paper details from Semantic Scholar using DOI as a fallback."""
    doi = doi.replace("https://doi.org/", "").strip()
    base_url = f"https://api.semanticscholar.org/graph/v1/paper/DOI:{doi}?fields=title,authors,year,abstract"
    try:
        response = requests.get(base_url)
        if response.status_code == 200:
            data = response.json()
            authors = [author.get("name", "") for author in data.get("authors", [])]
            year = str(data.get("year", ""))
            title = data.get("title", "")
            abstract = data.get("abstract", "")
            # Skip references from Semantic Scholar for now.
            references = []
            return {
                'title': title,
                'authors': authors,
                'year': year,
                'doi': doi,
                'abstract': abstract,
                'references': references
            }
    except Exception as e:
        print(f"Error fetching DOI from Semantic Scholar: {e}")
    return None

def get_combined_metadata(doi):
    """Combine metadata from CrossRef and Semantic Scholar for a DOI."""
    crossref_data = get_paper_by_doi(doi)
    semantic_data = get_paper_by_doi_semantic(doi)
    
    if crossref_data is None:
        return semantic_data
    if semantic_data:
        if semantic_data.get("title") and len(semantic_data.get("title")) > len(crossref_data.get("title", "")):
            crossref_data["title"] = semantic_data["title"]
        if semantic_data.get("authors") and len(semantic_data.get("authors")) >= len(crossref_data.get("authors", [])):
            crossref_data["authors"] = semantic_data["authors"]
        if semantic_data.get("abstract") and not crossref_data.get("abstract"):
            crossref_data["abstract"] = semantic_data["abstract"]
        if semantic_data.get("year"):
            crossref_data["year"] = semantic_data["year"]
    return crossref_data

def search_retracted_papers(title):
    """
    Check if a paper is retracted using CrossRef (Retraction Watch) by searching the paper title.
    Returns a list of retracted papers that match the title, each with title and DOI.
    """
    base_url = "https://api.crossref.org/works"
    params = {
        "query.title": title,
        "filter": "type:retraction"
    }
    try:
        response = requests.get(base_url, params=params)
        if response.status_code == 200:
            data = response.json()
            items = data.get("message", {}).get("items", [])
            return [{"title": item["title"][0], "doi": item["DOI"]} for item in items]
    except Exception as e:
        print(f"Retraction check error: {e}")
    return []

def generate_citation_for_paper(paper_info):
    """
    Generate a citation for the paper using the fine-tuned GPT-2 model.
    Constructs a prompt that includes key metadata and generates a citation.
    """
    prompt = (
        f"Generate an IEEE citation for a paper with the following details:\n"
        f"Title: {paper_info['title']}\n"
        f"Authors: {', '.join(paper_info['authors'])}\n"
        f"Year: {paper_info['year']}\n"
        f"DOI: {paper_info['doi']}\n"
    )
    output = citation_generator(prompt, max_length=128, num_return_sequences=1)
    citation = output[0]["generated_text"].strip()
    return citation

def main(doi):
    """Main function to get paper details, check retraction status, and generate a citation."""
    try:
        paper_info = get_combined_metadata(doi)
        if not paper_info:
            return {'success': False, 'error': 'Paper not found'}
            
        citation = generate_citation_for_paper(paper_info)
        paper_info['citation'] = citation
        
        retracted_results = search_retracted_papers(paper_info['title'])
        is_retracted = len(retracted_results) > 0
        paper_info['is_retracted'] = is_retracted
        if is_retracted:
            paper_info['retraction_info'] = retracted_results
        
        return {
            'success': True,
            'paper': paper_info
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        result = main(sys.argv[1])
        print(json.dumps(result, indent=4))
