import json
import requests
import torch
import os
import sys
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# Helper function for debug messages
def debug_print(message):
    """Print debug messages to stderr"""
    sys.stderr.write(f"{message}\n")
    sys.stderr.flush()

# Read API key directly from .env file
with open(os.path.join(os.path.dirname(__file__), '.env'), 'r') as f:
    HUGGINGFACE_API_KEY = f.read().split('=')[1].strip()

def get_paper_by_doi(doi):
    """Fetch paper details from Crossref using DOI"""
    debug_print(f"📌 Original DOI string: '{doi}'")
    
    # Check if DOI is empty
    if not doi or doi.strip() == "":
        debug_print("❌ Empty DOI provided")
        return None
    
    # Clean up DOI
    doi = doi.replace("https://doi.org/", "").strip()
    debug_print(f"📌 Processed DOI: '{doi}'")
    
    url = f"https://api.crossref.org/works/{doi}"
    headers = {
        "User-Agent": "VerifAI/1.0"
    }
    
    debug_print(f"📌 Making request to CrossRef API: {url}")
    
    try:
        response = requests.get(url, headers=headers)
        debug_print(f"📌 Response status code: {response.status_code}")
        
        if response.status_code == 200:
            debug_print("📌 Successful response from CrossRef API")
            data = response.json()['message']
            
            # Log data structure for debugging
            debug_print(f"📌 Data keys: {list(data.keys())}")
            
            # Extract references if available
            references = []
            if 'reference' in data:
                debug_print(f"📌 Found {len(data['reference'])} references")
                for ref in data.get('reference', []):
                    # Sanitize reference data to prevent JSON errors
                    reference_item = sanitize_reference_data(ref)
                    references.append(reference_item)
            else:
                debug_print("📌 No references found in the paper data")
            
            # Extract year safely
            year = ""
            if 'published-print' in data and 'date-parts' in data['published-print']:
                parts = data['published-print']['date-parts']
                if parts and parts[0] and len(parts[0]) > 0:
                    year = str(parts[0][0])
                    debug_print(f"📌 Extracted year: {year}")
                else:
                    debug_print("❌ Could not extract year from date-parts")
            else:
                debug_print("❌ No published-print or date-parts found")
            
            # Extract title safely
            title = ""
            if 'title' in data and data['title']:
                title = data['title'][0]
                debug_print(f"📌 Extracted title: {title}")
            else:
                debug_print("❌ No title found")
            
            # Extract authors safely
            authors = []
            if 'author' in data:
                for author in data.get('author', []):
                    author_name = f"{author.get('given', '')} {author.get('family', '')}"
                    authors.append(author_name)
                debug_print(f"📌 Extracted {len(authors)} authors")
            else:
                debug_print("❌ No authors found")
            
            result = {
                'title': title,
                'authors': authors,
                'year': year,
                'doi': doi,
                'abstract': data.get('abstract', ''),
                'references': references
            }
            
            debug_print("📌 Successfully constructed paper info")
            return result
        else:
            debug_print(f"❌ CrossRef API returned non-200 status: {response.status_code}")
            debug_print(f"❌ Response content: {response.text}")
            return None
    except Exception as e:
        debug_print(f"❌ Error fetching DOI: {e}")
        # Print exception type and traceback
        import traceback
        debug_print(f"❌ Exception type: {type(e).__name__}")
        debug_print("❌ Traceback:")
        traceback.print_exc(file=sys.stderr)
        return None

def sanitize_reference_data(ref):
    """Sanitize and validate reference data to prevent JSON errors"""
    try:
        # Create a clean reference item with default values
        reference_item = {
            'key': '',
            'doi': '',
            'title': '',
            'authors': [],
            'year': '',
            'unstructured': '',
            'verification_status': 'pending'  # Initial status
        }
        
        # Safely add key if present
        if 'key' in ref and ref['key']:
            reference_item['key'] = str(ref.get('key', '')).strip()
        
        # Safely handle DOI - make sure it's well-formed
        if 'DOI' in ref and ref['DOI']:
            # Clean up DOI by removing any non-DOI characters
            doi_raw = str(ref.get('DOI', '')).strip()
            # Regex to validate basic DOI format
            import re
            doi_pattern = re.compile(r'^10\.\d{4,9}/[-._;()/:A-Z0-9]+$', re.IGNORECASE)
            
            # If it's a valid DOI, keep it; otherwise, set to empty
            if doi_pattern.match(doi_raw):
                reference_item['doi'] = doi_raw
            else:
                debug_print(f"❌ Invalid DOI format: {doi_raw}")
                reference_item['doi'] = ''
        
        # Safely extract title
        if 'article-title' in ref:
            reference_item['title'] = str(ref['article-title']).strip()
        elif 'unstructured' in ref:
            reference_item['title'] = str(ref['unstructured']).strip()
        
        # Safely extract authors
        if 'author' in ref:
            # Handle both string and list formats
            if isinstance(ref['author'], str):
                author_parts = ref['author'].split(',')
                reference_item['authors'] = [author.strip() for author in author_parts if author.strip()]
            elif isinstance(ref['author'], list):
                reference_item['authors'] = [str(author).strip() for author in ref['author'] if author]
        
        # Safely extract year
        if 'year' in ref and ref['year']:
            # Try to ensure it's a valid year format
            year_str = str(ref.get('year', '')).strip()
            # Check if it's a plausible year (between 1800 and current year + 5)
            import datetime
            current_year = datetime.datetime.now().year
            try:
                year_int = int(year_str)
                if 1800 <= year_int <= current_year + 5:
                    reference_item['year'] = year_str
                else:
                    reference_item['year'] = ''
            except ValueError:
                reference_item['year'] = ''
        
        # Safely extract unstructured text
        if 'unstructured' in ref:
            reference_item['unstructured'] = str(ref.get('unstructured', '')).strip()
            
        return reference_item
    except Exception as e:
        debug_print(f"❌ Error sanitizing reference: {e}")
        # Return a safe default reference item
        return {
            'key': 'unknown',
            'doi': '',
            'title': 'Error processing reference',
            'authors': [],
            'year': '',
            'unstructured': '',
            'verification_status': 'pending'
        }

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
        debug_print(f"Retraction check error: {e}")
    
    return []

def main(doi):
    """Main function to get paper details, check retraction, and classify research field"""
    debug_print(f"📌 DOI_CITATION.PY: Processing DOI '{doi}'")
    
    try:
        debug_print("📌 Calling get_paper_by_doi()")
        paper_info = get_paper_by_doi(doi)
        
        if not paper_info:
            debug_print("❌ Paper not found for the given DOI")
            return {'success': False, 'error': 'Paper not found'}
            
        debug_print("📌 Paper found, processing additional information")
        
        try:
            debug_print("📌 Classifying research field")
            classification = classify_research_field(paper_info)
            paper_info['research_field'] = classification
            debug_print(f"📌 Research field classified as: {classification['field']}")
        except Exception as e:
            debug_print(f"❌ Error classifying research field: {e}")
            paper_info['research_field'] = {'field': 'Unknown', 'confidence': 0}
        
        try:
            debug_print("📌 Generating citation")
            citation = generate_field_specific_citation(paper_info, paper_info['research_field']['field'])
            paper_info['citation'] = citation
            debug_print(f"📌 Citation generated: {citation}")
        except Exception as e:
            debug_print(f"❌ Error generating citation: {e}")
            paper_info['citation'] = "Citation generation failed"
        
        try:
            debug_print("📌 Checking if paper is retracted")
            retracted_results = search_retracted_papers(paper_info['title'])
            is_retracted = len(retracted_results) > 0
            debug_print(f"📌 Paper retracted: {is_retracted}")
            
            # Add retraction info to output
            paper_info['is_retracted'] = is_retracted
            if is_retracted:
                paper_info['retraction_info'] = retracted_results
                debug_print(f"📌 Retraction info: {retracted_results}")
        except Exception as e:
            debug_print(f"❌ Error checking retraction status: {e}")
            paper_info['is_retracted'] = False
        
        debug_print("📌 Successfully processed paper information")
        return {
            'success': True,
            'paper': paper_info
        }
    
    except Exception as e:
        debug_print(f"❌ Main processing error: {e}")
        import traceback
        traceback.print_exc(file=sys.stderr)
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
        try:
            # Get the result from main function
            result = main(sys.argv[1])
            
            # Add validation to ensure JSON is properly formatted
            def validate_json_structure(obj):
                """Recursively validate and clean a JSON structure to ensure it's serializable"""
                if isinstance(obj, dict):
                    # Process each key-value pair in dictionary
                    return {k: validate_json_structure(v) for k, v in obj.items()}
                elif isinstance(obj, list):
                    # Process each item in list
                    return [validate_json_structure(item) for item in obj]
                elif isinstance(obj, (str, int, float, bool)) or obj is None:
                    # These types are JSON-serializable as is
                    return obj
                else:
                    # Convert any other type to string to ensure serializability
                    return str(obj)
            
            # Truncate references to prevent excessive output
            def truncate_for_console(obj, max_refs=5):
                """Truncate large arrays in the result for console output"""
                if not isinstance(obj, dict):
                    return obj
                
                result = obj.copy()
                
                # If this is the main result object with paper data
                if 'success' in result and 'paper' in result and result['success']:
                    # If paper has references, truncate them
                    if 'references' in result['paper'] and isinstance(result['paper']['references'], list):
                        refs = result['paper']['references']
                        if len(refs) > max_refs:
                            # Keep only the first max_refs references for output
                            debug_result = result.copy()
                            debug_result['paper'] = result['paper'].copy()
                            debug_result['paper']['references'] = refs[:max_refs].copy()
                            debug_result['paper']['references'].append({
                                'key': '...',
                                'title': f'[ {len(refs) - max_refs} more references truncated for console output ]',
                                'doi': '...',
                                'verification_status': 'pending'
                            })
                            debug_print(f"📌 Reference count: {len(refs)} (truncated to {max_refs} for debug output)")
                            return result
                
                return result
            
            # Validate the result before serializing
            validated_result = validate_json_structure(result)
            
            # Create debug version with truncated references for logging
            debug_result = truncate_for_console(validated_result)
            debug_print(f"📌 Result structure: {json.dumps(debug_result, separators=(',', ':'))[:200]}...truncated")
            
            # Use try-except to catch any JSON serialization errors
            try:
                # Print compact JSON with minimal indentation to stdout (no debug info)
                json_output = json.dumps(validated_result)
                print(json_output)
            except Exception as e:
                debug_print(f"❌ JSON serialization error: {e}")
                # Fallback: return a simplified error response that's guaranteed to be valid JSON
                error_response = {
                    "success": False,
                    "error": f"Failed to serialize response: {str(e)}"
                }
                print(json.dumps(error_response))
        except Exception as e:
            # Global exception handler for any other errors
            debug_print(f"❌ Global exception: {e}")
            print(json.dumps({
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }))
