from transformers import pipeline
import requests

def search_isbn(isbn):
    """Search OpenLibrary API for book details using ISBN."""
    url = f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
    response = requests.get(url)
    if response.status_code == 200:
        data = response.json()
        key = f"ISBN:{isbn}"
        if key in data:
            book = data[key]
            return {
                "title": book.get("title", ""),
                "authors": [author["name"] for author in book.get("authors", [])],
                "publish_date": book.get("publish_date", ""),
                "publisher": book.get("publishers", [""])[0],
                "success": True
            }
    return {"success": False}

def generate_citation(book_info):
    """Generate citation using HuggingFace model."""
    pipe = pipeline("text2text-generation", model="scieditor/citation-generation-t5")
    
    input_text = f"generate citation for: {book_info['title']} by {', '.join(book_info['authors'])} published in {book_info['publish_date']} by {book_info['publisher']}"
    
    citation = pipe(input_text, max_length=512, num_return_sequences=1)[0]['generated_text']
    return citation

def main(isbn):
    book_info = search_isbn(isbn)
    if book_info["success"]:
        citation = generate_citation(book_info)
        return {
            "book_info": book_info,
            "citation": citation,
            "success": True
        }
    return {"success": False, "error": "Book not found"}

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        print(main(sys.argv[1]))
