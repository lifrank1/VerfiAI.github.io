import sys
import json
import fitz  # PyMuPDF for PDFs
import docx
import os
import re

def extract_text_from_pdf(pdf_path):
    """Extract text from a PDF file."""
    text = ""
    try:
        doc = fitz.open(pdf_path)
        for page in doc:
            text += page.get_text("text") + "\n"
    except Exception as e:
        return f"Error extracting PDF text: {e}"
    return text

def extract_text_from_docx(docx_path):
    """Extract text from a DOCX file."""
    text = ""
    try:
        doc = docx.Document(docx_path)
        for para in doc.paragraphs:
            text += para.text + "\n"
    except Exception as e:
        return f"Error extracting DOCX text: {e}"
    return text

def extract_text_from_txt(txt_path):
    """Extract text from a TXT file."""
    try:
        with open(txt_path, "r", encoding="utf-8") as file:
            return file.read()
    except Exception as e:
        return f"Error reading TXT file: {e}"

def extract_references(text):
    """
    Extracts references from the given text.
    - Detects numbered references (e.g., '1.', '2.', etc.).
    - Captures entire references across multiple lines.
    - Stops at the next reference number.
    """

    # Regex to find numbered references with text, handling multiple lines
    reference_pattern = re.compile(r"\n\s*(\d{1,3})\.\s*(.+?)(?=\n\s*\d{1,3}\.|$)", re.DOTALL)

    matches = reference_pattern.findall(text)
    
    structured_references = []
    for match in matches:
        ref_number, ref_content = match
        ref_content = ref_content.strip().replace("\n", " ")  # Flatten multiline refs
        structured_references.append(f"{ref_number}. {ref_content}")

    return structured_references

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No file path provided"}))
        return

    file_path = sys.argv[1]

    if not os.path.exists(file_path):
        print(json.dumps({"error": "File not found"}))
        return

    file_ext = os.path.splitext(file_path)[1].lower()
    extracted_text = ""

    if file_ext == ".pdf":
        extracted_text = extract_text_from_pdf(file_path)
    elif file_ext == ".docx":
        extracted_text = extract_text_from_docx(file_path)
    elif file_ext == ".txt":
        extracted_text = extract_text_from_txt(file_path)
    else:
        print(json.dumps({"error": "Unsupported file format"}))
        return

    references = extract_references(extracted_text)
    
    output = {"references": references}
    print(json.dumps(output, indent=4))  # Pretty print JSON for readability

if __name__ == "__main__":
    main()
