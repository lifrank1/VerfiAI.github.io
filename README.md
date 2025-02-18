# VerifAI

## Table of Contents
- [Project Summary](#project-summary)
- [Installation](#installation)
- [Technology Stack](technology-stack)

## Project Summary  

**VerifAI** is an open-source AI-driven tool designed to enhance academic integrity by verifying research citations. It analyzes a paper’s references to determine:  

✅ Whether the paper actually cites the referenced sources  
✅ If the referenced sources are real, AI-generated, or retracted  
✅ The validity of claims attributed to each reference  

### Why VerifAI?  
- **Free & Open-Source** – Unlike paid alternatives like CiteSure, VerifAI is accessible to everyone  
- **Retracted Paper Detection** – Flags references that have been formally retracted  
- **AI-Generated Content Identification** – Identifies citations that may be hallucinated by AI models  
- **Condensed Source Suggestion** – Recommends compact sources when multiple references are similar  
- **Academic Integrity Support** – A comprehensive tool for students, researchers, and journal editors  

### Potential Use Cases  
 **Graduate Students** – Easily verify bibliography accuracy for theses and dissertations  
 **Academic Researchers** – Ensure research papers meet citation standards before submission  
 **Professors & Instructors** – Cross-check references in student work for accuracy  


## Installation
1) Clone the repository
2) Navigate to the terminal from the cloned repository
3) run 'npm install' to get the dependencies
4) run 'npm start' to start the localhost frontend server
5) Navigate to the backend folder from the terminal
6) run 'npm install' to get the dependencies for the backend
7) run 'node backend/server.js' to start the localhost backend server

## Technology Stack  

### 🔹 Front End  
- **React.js** – Dynamic and interactive UI  
- **Bootstrap.js** – Responsive and visually appealing design  

### 🔹 Back End  
- **Node.js with Express.js** – Handles server-side logic, API endpoints, and database interactions  

### 🔹 Database & Storage  
- **Firebase** – Manages user authentication and data storage  
- **AWS S3** – Handles large-scale file uploads  

### 🔹 Web Scraping & AI Processing  
- **BeautifulSoup** – Extracts citation data from web pages  
- **Hugging Face AI** – Classifies article genres to suggest relevant citations  

### 🔹 Containerization  
- **Docker** – Ensures consistent deployment across environments  

