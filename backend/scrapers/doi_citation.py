import json
import requests
import torch
import os
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Read API key directly from .env file
with open(os.path.join(os.path.dirname(__file__), '.env'), 'r') as f:
    HUGGINGFACE_API_KEY = f.read().split('=')[1].strip()

def get_paper_by_doi(doi):
    """Fetch paper details from Crossref using DOI"""
    doi = doi.replace("https://doi.org/", "").strip()
    
    url = f"https://api.crossref.org/works/{doi}"
    headers = {
        "User-Agent": "VerifAI/1.0"
    }
    
    try:
        response = requests.get(url, headers=headers)
        if response.status_code == 200:
            data = response.json()['message']
            return {
                'title': data.get('title', [''])[0],
                'authors': [
                    f"{author.get('given', '')} {author.get('family', '')}"
                    for author in data.get('author', [])
                ],
                'year': str(data.get('published-print', {}).get('date-parts', [['']])[0][0]),
                'doi': doi,
                'abstract': data.get('abstract', '')
            }
    except Exception as e:
        print(f"Error fetching DOI: {e}")
    return None

def classify_research_field(paper_info):
    """Classify the research field of the paper using a pre-trained classifier"""
    model_name = "distilbert-base-uncased"
    
    # Load the tokenizer and model with authentication
    tokenizer = AutoTokenizer.from_pretrained(model_name, use_auth_token=HUGGINGFACE_API_KEY)
    model = AutoModelForSequenceClassification.from_pretrained(model_name, use_auth_token=HUGGINGFACE_API_KEY)
    
    # Prepare the input text
    text = f"{paper_info['title']} {paper_info.get('abstract', '')}"
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    
    # Perform inference
    with torch.no_grad():
        outputs = model(**inputs)
        predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
        predicted_class = torch.argmax(predictions, dim=-1).item()
    
    # Define the research fields this model classifies into
    fields = [
        "Machine Learning Algorithms", 
        "Natural Language Processing", 
        "Computer Vision and Image Processing", 
        "Robotics and Autonomous Systems", 
        "Other"
    ]
    
    return {
        'field': fields[predicted_class],
        'confidence': float(predictions[0][predicted_class])
    }

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
            return [
                {
                    "title": item["title"][0],
                    "doi": item["DOI"]
                }
                for item in items
            ]
    except Exception as e:
        print(f"Retraction check error: {e}")
    
    return []

def main(doi):
    """Main function to get paper details, check retraction, and classify research field"""
    try:
        paper_info = get_paper_by_doi(doi)
        if not paper_info:
            return {
                'success': False,
                'error': 'Paper not found'
            }
        
        # Check if the paper is retracted by title
        retracted_results = search_retracted_papers(paper_info['title'])
        is_retracted = len(retracted_results) > 0
        
        classification = classify_research_field(paper_info)
        paper_info['research_field'] = classification
        
        # Add retraction info to output
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
