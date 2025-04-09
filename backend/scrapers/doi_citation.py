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
    print(f"📌 Original DOI string: '{doi}'")
    
    # Check if DOI is empty
    if not doi or doi.strip() == "":
        print("❌ Empty DOI provided")
        return None
    
    # Clean up DOI
    doi = doi.replace("https://doi.org/", "").strip()
    print(f"📌 Processed DOI: '{doi}'")
    
    url = f"https://api.crossref.org/works/{doi}"
    headers = {
        "User-Agent": "VerifAI/1.0"
    }
    
    print(f"📌 Making request to CrossRef API: {url}")
    
    try:
        response = requests.get(url, headers=headers)
        print(f"📌 Response status code: {response.status_code}")
        
        if response.status_code == 200:
            print("📌 Successful response from CrossRef API")
            data = response.json()['message']
            
            # Log data structure for debugging
            print(f"📌 Data keys: {list(data.keys())}")
            
            # Extract references if available
            references = []
            if 'reference' in data:
                print(f"📌 Found {len(data['reference'])} references")
                for ref in data.get('reference', []):
                    reference_item = {
                        'key': ref.get('key', ''),
                        'doi': ref.get('DOI', ''),
                        'title': '',
                        'authors': [],
                        'year': '',
                        'unstructured': ref.get('unstructured', ''),
                        'verification_status': 'pending'  # Initial status
                    }
                    
                    # Extract title
                    if 'article-title' in ref:
                        reference_item['title'] = ref['article-title']
                    elif 'unstructured' in ref:
                        reference_item['title'] = ref['unstructured']
                    
                    # Extract authors
                    if 'author' in ref:
                        reference_item['authors'] = ref['author'].split(',')
                    
                    # Extract year
                    if 'year' in ref:
                        reference_item['year'] = ref['year']
                    
                    references.append(reference_item)
            else:
                print("📌 No references found in the paper data")
            
            # Extract year safely
            year = ""
            if 'published-print' in data and 'date-parts' in data['published-print']:
                parts = data['published-print']['date-parts']
                if parts and parts[0] and len(parts[0]) > 0:
                    year = str(parts[0][0])
                    print(f"📌 Extracted year: {year}")
                else:
                    print("❌ Could not extract year from date-parts")
            else:
                print("❌ No published-print or date-parts found")
            
            # Extract title safely
            title = ""
            if 'title' in data and data['title']:
                title = data['title'][0]
                print(f"📌 Extracted title: {title}")
            else:
                print("❌ No title found")
            
            # Extract authors safely
            authors = []
            if 'author' in data:
                for author in data.get('author', []):
                    author_name = f"{author.get('given', '')} {author.get('family', '')}"
                    authors.append(author_name)
                print(f"📌 Extracted {len(authors)} authors")
            else:
                print("❌ No authors found")
            
            result = {
                'title': title,
                'authors': authors,
                'year': year,
                'doi': doi,
                'abstract': data.get('abstract', ''),
                'references': references
            }
            
            print("📌 Successfully constructed paper info")
            return result
        else:
            print(f"❌ CrossRef API returned non-200 status: {response.status_code}")
            print(f"❌ Response content: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error fetching DOI: {e}")
        # Print exception type and traceback
        import traceback
        print(f"❌ Exception type: {type(e).__name__}")
        print("❌ Traceback:")
        traceback.print_exc()
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
        "Natural Language Processing",
        "Computer Vision and Image Processing", 
        "Robotics and Autonomous Systems",
        "Machine Learning",
        "Deep Learning",
        "Cybersecurity",
        "Data Mining",
        "Cloud Computing",
        "Internet of Things",
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
    print(f"📌 DOI_CITATION.PY: Processing DOI '{doi}'")
    
    try:
        print("📌 Calling get_paper_by_doi()")
        paper_info = get_paper_by_doi(doi)
        
        if not paper_info:
            print("❌ Paper not found for the given DOI")
            return {'success': False, 'error': 'Paper not found'}
            
        print("📌 Paper found, processing additional information")
        
        try:
            print("📌 Classifying research field")
            classification = classify_research_field(paper_info)
            paper_info['research_field'] = classification
            print(f"📌 Research field classified as: {classification['field']}")
        except Exception as e:
            print(f"❌ Error classifying research field: {e}")
            paper_info['research_field'] = {'field': 'Unknown', 'confidence': 0}
        
        try:
            print("📌 Generating citation")
            citation = generate_field_specific_citation(paper_info, paper_info['research_field']['field'])
            paper_info['citation'] = citation
            print(f"📌 Citation generated: {citation}")
        except Exception as e:
            print(f"❌ Error generating citation: {e}")
            paper_info['citation'] = "Citation generation failed"
        
        try:
            print("📌 Checking if paper is retracted")
            retracted_results = search_retracted_papers(paper_info['title'])
            is_retracted = len(retracted_results) > 0
            print(f"📌 Paper retracted: {is_retracted}")
            
            # Add retraction info to output
            paper_info['is_retracted'] = is_retracted
            if is_retracted:
                paper_info['retraction_info'] = retracted_results
                print(f"📌 Retraction info: {retracted_results}")
        except Exception as e:
            print(f"❌ Error checking retraction status: {e}")
            paper_info['is_retracted'] = False
        
        print("📌 Successfully processed paper information")
        return {
            'success': True,
            'paper': paper_info
        }
    
    except Exception as e:
        print(f"❌ Main processing error: {e}")
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e)
        }

def generate_field_specific_citation(paper_info, field):
    """Generate appropriate citation format based on research field"""
    
    citation_formats = {
        "Machine Learning Algorithms": "IEEE",
        "Natural Language Processing": "ACL",
        "Computer Vision and Image Processing": "IEEE",
        "Robotics and Autonomous Systems": "IEEE",
        "Other": "MLA"
    }
    
    format_type = citation_formats.get(field, "MLA")
    authors = " and ".join(paper_info['authors'])
    
    if format_type == "IEEE":
        return f"{authors}, \"{paper_info['title']},\" {paper_info['year']}. DOI: {paper_info['doi']}"
    elif format_type == "ACL":
        return f"{authors}. {paper_info['year']}. {paper_info['title']}. DOI: {paper_info['doi']}"
    else:  # MLA
        return f"{authors}. \"{paper_info['title']}.\" {paper_info['year']}, doi:{paper_info['doi']}"

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        result = main(sys.argv[1])
        print(json.dumps(result, indent=4))
