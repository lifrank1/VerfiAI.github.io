import React, { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { firebaseApp } from "../firebase-config";
import { getFirestore, collection, doc, addDoc, onSnapshot } from "firebase/firestore";
import axios from "axios";
import NavigationHeader from "../components/NavigationHeader";
import { useAuth } from "../contexts/authContext";
import "../styles/ReferenceVerification.css";

const Chat = () => {
  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();
  const user = useAuth(); // Retrieve the current user's UID
  const [citations, setCitations] = useState([]);

  useEffect(() => {
    const fetchCitations = () => {
      if (!user || !user.userID) return;
  
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID); // Access the user's document
      
      // Access the citations subcollection for the user
      const citationsRef = collection(userRef, "citations");
      
      // Set up a real-time listener to automatically update the citations list
      const unsubscribe = onSnapshot(citationsRef, (querySnapshot) => {
        const citationsData = querySnapshot.docs.map(doc => doc.data());
        setCitations(citationsData); // Update state with the latest citations
      });
  
      // Cleanup function to unsubscribe when the component unmounts
      return () => unsubscribe();
    };
  
    fetchCitations();
  }, [user]); // This effect will run whenever the user changes
  
  const handleLogout = async () => {
    const auth = getAuth(firebaseApp);
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const isISBN = (input) => {
    // Basic ISBN validation (both ISBN-10 and ISBN-13)
    return /^(?:\d{10}|\d{13})$/.test(input.replace(/-/g, ''));
  };  

  // New functions for file upload
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadedFile(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const uploadDocument = async () => {
    if (!uploadedFile) return;
    
    setIsLoading(true);
    setMessages(prev => [...prev, { 
      type: "user", 
      text: `Uploading document: ${uploadedFile.name}` 
    }]);

    const formData = new FormData();
    formData.append('file', uploadedFile);

    try {
      const response = await axios.post(
        "http://localhost:3002/api/upload-document", 
        formData, 
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percentCompleted);
          }
        }
      );

      const documentData = response.data;

      // Format the document analysis results
      const formattedMessage = (
        <div>
          <h3>Document Analysis</h3>
          <p><b>📄 File Name:</b> {documentData.file_name || uploadedFile.name}</p>
          <p><b>📋 File Type:</b> {documentData.file_type || uploadedFile.name.split('.').pop()}</p>
          
          {documentData.metadata && (
            <div>
              <h4>Metadata</h4>
              {documentData.metadata.title && <p><b>Title:</b> {documentData.metadata.title}</p>}
              {documentData.metadata.authors && (
                <div>
                  <p><b>Authors:</b></p>
                  <ul style={{ paddingLeft: "2rem" }}>
                    {documentData.metadata.authors.map((author, idx) => (
                      <li key={idx}>{author}</li>
                    ))}
                  </ul>
                </div>
              )}
              {documentData.metadata.abstract && (
                <p><b>Abstract:</b> {documentData.metadata.abstract}</p>
              )}
              {documentData.metadata.keywords && (
                <p><b>Keywords:</b> {documentData.metadata.keywords.join(', ')}</p>
              )}
            </div>
          )}
          
          {documentData.citation_style && (
            <p><b>Citation Style:</b> {documentData.citation_style}</p>
          )}
          
          {documentData.references && documentData.references.length > 0 && (
            <div className="references-container">
              <h4 className="references-title">References ({documentData.references.length})</h4>
              <ul className="references-list">
                {documentData.references.map((ref, idx) => (
                  <ReferenceItem 
                    key={idx} 
                    reference={{ unstructured: ref }} 
                    index={idx} 
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      );

      setMessages(prev => [...prev, { type: "bot", text: formattedMessage }]);
      
      // Save to Firestore if it's a valid document with metadata
      if (user && user.userID && documentData.metadata && documentData.metadata.title) {
        await saveCitationToFirestore({
          title: documentData.metadata.title,
          authors: documentData.metadata.authors || [],
          research_field: { field: "Document Upload" },
          year: new Date().getFullYear().toString(),
          doi: "N/A",
          is_retracted: false
        }, user.userID);
      }
      
      // Reset file input
      setUploadedFile(null);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
    } catch (error) {
      console.error("Error uploading document:", error);
      setMessages(prev => [...prev, { 
        type: "bot", 
        text: "Error analyzing the document. Please check the file format and try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const searchPaper = async () => {
    if (input.trim() === "") return;
  
    if (input.trim().toLowerCase() === "clear") {
      setMessages([{ type: "bot", text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis." }]);
      setInput("");
      return;
    }
  
    setMessages(prev => [...prev, { type: "user", text: input }]);
    setIsLoading(true);
  
    try {
      const response = await axios.post("http://localhost:3002/api/analyze-paper", { doi: input });
      const paper = response.data.paper;
  
      let retractionNotice = paper.is_retracted 
        ? (
            <div>
              <p style={{ color: "red", fontWeight: "bold" }}>🚨 This paper may be retracted!</p>
              <ul style={{ paddingLeft: "2rem" }}>
                {paper.retraction_info.map((item, idx) => (
                  <li key={idx} style={{ marginBottom: "0.5rem" }}>
                    <b>📌 Title:</b> {item.title}<br />
                    <b>🔗 DOI:</b> {item.doi}
                  </li>
                ))}
              </ul>
            </div>
          )
        : <p style={{ color: "green" }}>✅ This paper does not appear to be retracted.</p>;
  
      // Create references section with verification functionality
      const references = (
        <div className="references-container">
          <h4 className="references-title">References {paper.references && paper.references.length > 0 ? `(${paper.references.length})` : ''}</h4>
          {paper.references && paper.references.length > 0 ? (
            <ul className="references-list">
              {paper.references.map((ref, idx) => (
                <ReferenceItem key={idx} reference={ref} index={idx} />
              ))}
            </ul>
          ) : (
            <p>No references available for this paper.</p>
          )}
        </div>
      );
  
      const formattedMessage = (
        <div>
          <h3>Paper Details</h3>
          <p><b>📌 Title:</b> {paper.title}</p>
          <p><b>👥 Authors:</b></p>
          <ul style={{ paddingLeft: "2rem" }}>
            {paper.authors.map((author, index) => (
              <li key={index} style={{ marginBottom: "0.3rem" }}>{author}</li>
            ))}
          </ul>
          <p><b>📊 Research Field:</b> {paper.research_field.field}</p>
          <p><b>📅 Year:</b> {paper.year}</p>
          <p><b>🔗 DOI:</b> {paper.doi}</p> 
          {retractionNotice}
          {references}
        </div>
      );
  
      setMessages(prev => [...prev, { type: "bot", text: formattedMessage }]);
  
      // Save to Firestore
      if (user && user.userID) {
        await saveCitationToFirestore(paper, user.userID);
      }
  
    } catch (error) {
      setMessages(prev => [...prev, { type: "bot", text: "Error analyzing paper. Please check the DOI and try again." }]);
    } finally {
      setIsLoading(false);
      setInput("");
    }
  };
  
  const saveCitationToFirestore = async (paper, userID) => {
    if (!userID) return;
  
    try {
      const db = getFirestore(firebaseApp);
      
      const userRef = doc(db, "users", userID);

      const citationsRef = collection(userRef, "citations");
  
      const newCitation = {
        title: paper.title,
        authors: paper.authors,
        research_field: paper.research_field.field,
        year: paper.year,
        doi: paper.doi,
        retracted: paper.is_retracted,
        userID: userID,
        timestamp: new Date(),
      };
  
      await addDoc(citationsRef, newCitation);
      console.log("Citation saved to Firestore!");
    } catch (error) {
      console.error("Error saving citation:", error);
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      searchPaper();
    }
  };

  function Sidebar() {
    const [isOpen, setIsOpen] = useState(true);  // State to manage whether the citations box is open or not
  
    const handleToggle = () => {
      setIsOpen(!isOpen);  // Toggle the state
    }};

  return (
<>
<NavigationHeader />

  <Helmet>
    <title>Research Paper Validator - VerifAI</title>
    <meta name="description" content="Validate and cite research papers" />
    <style>
      {`
        body {
          margin-top: 6rem;
          margin: 0;
          padding: 0;
          background-color: #E6E6FA;
          height: 100vh;
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
        }
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .file-upload-container {
          display: flex;
          align-items: center;
          margin-bottom: 1rem;
        }
        .file-upload-button {
          background: #6E44FF;
          color: white;
          border: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.9rem;
          margin-right: 0.5rem;
        }
        .file-name {
          margin-left: 0.5rem;
          font-size: 0.9rem;
          color: #555;
        }
        .upload-progress {
          height: 4px;
          background: #f0f0f0;
          border-radius: 2px;
          margin-top: 0.5rem;
          overflow: hidden;
        }
        .upload-progress-bar {
          height: 100%;
          background: #6E44FF;
          border-radius: 2px;
          transition: width 0.3s ease;
        }
      `}
    </style>
  </Helmet>

  <div style={{
    display: "flex",
    height: "100vh",
    margin: "0 auto",
    background: "white",
    boxShadow: "0 0 10px rgba(0,0,0,0.1)",
  }}>

    {/* Sidebar */}
    <div style={{
       marginTop: "6rem",
       width: "300px",
       height: "100vh",
       backgroundColor: "#e5e5e5",  
       color: "white",
       padding: "1.5rem 1rem",
       display: "flex",
       flexDirection: "column",
       position: "fixed",
       top: "0",
       left: "0",
       bottom: "0",
    }}>
      {/* Header (VerifAI Chat + Logout Button) */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "2px solid white", // Underline effect
        paddingBottom: "0.5rem",
      }}>
        <h1
          style={{
            margin: 0,
            background: "linear-gradient(270deg, #6E44FF, #FF4D4D)",
            backgroundSize: "200% auto",
            color: "transparent",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            animation: "gradient-animation 10s ease infinite",
            fontSize: "1.5rem",
          }}
        >
          Citations
        </h1>

        {/* Logout Button */}
        
      </div>

      {/* Sidebar Content */}
        {/* Citations list */}
<div style={{ marginTop: "1rem", paddingTop: "0.5rem", overflowY: "auto", maxHeight: "85%" }}>
{citations.length > 0 ? (
  citations.map((citation, idx) => (
    <div key={idx} style={{
      marginBottom: "1rem",
      background: "#fff",
      padding: "0.5rem",
      borderRadius: "8px",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    }}>
      <p style={{ color: "#333"}}><b>{citation.title}</b></p>
      <p style={{ color: "#555" }}>{citation.authors && Array.isArray(citation.authors) ? citation.authors.join(", ") : "No authors available"}
      </p>
      <p style={{ color: "#555" }}>Year: {citation.year}</p>
      <p><a href={`https://doi.org/${citation.doi}`} target="_blank" rel="noopener noreferrer">DOI</a></p>
    </div>
  ))
) : (
  <p>No citations saved yet!</p>
)}
</div>
    </div>

    {/* Main content area  */}
    <div style={{
      marginTop: "6rem",
      marginLeft: "300px", // Adjusted to match sidebar width
      flex: 1,
      display: "flex",
      flexDirection: "column",
      padding: "1rem",
    }}>
      
      {/* Chat Messages */}
      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: "1rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }} ref={messagesEndRef}>
        {messages.map((message, index) => (
          <div key={index} style={{
            display: "flex",
            justifyContent: message.type === "user" ? "flex-end" : "flex-start",
            padding: "0.5rem 1rem",
          }}>
            <div style={{
              maxWidth: "80%",
              padding: "1rem",
              borderRadius: "12px",
              background: message.type === "user" ? "#6E44FF" : "#f7f7f8",
              color: message.type === "user" ? "white" : "#333",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}>
              {message.text}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{
            padding: "1rem",
            display: "flex",
            justifyContent: "center",
            alignItems: "center"
          }}>
            <div style={{
              width: "80%",
              height: "4px",
              background: "#f0f0f0",
              borderRadius: "2px",
              overflow: "hidden"
            }}>
              <div style={{
                width: "30%",
                height: "100%",
                background: "#6E44FF",
                animation: "loading 1s infinite linear",
                borderRadius: "2px"
              }}/>
            </div>
          </div>
        )}
      </div>

      {/* Search Bar with File Upload */}
      <div style={{
        padding: "1rem",
        borderTop: "1px solid #e5e5e5",
        background: "white",
      }}>
        {/* File Upload Section */}
        <div className="file-upload-container">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
            accept=".pdf,.docx,.txt"
          />
          <button 
            className="file-upload-button"
            onClick={triggerFileInput}
          >
            Upload Document
          </button>
          
          {uploadedFile && (
            <>
              <span className="file-name">{uploadedFile.name}</span>
              <button 
                className="file-upload-button"
                onClick={uploadDocument}
                style={{ marginLeft: '0.5rem' }}
              >
                Analyze
              </button>
            </>
          )}
        </div>
        
        {uploadProgress > 0 && uploadProgress < 100 && (
          <div className="upload-progress">
            <div 
              className="upload-progress-bar" 
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        )}

        <div style={{
          display: "flex",
          gap: "0.5rem",
          maxWidth: "800px",
          margin: "0 auto",
        }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Enter paper title, DOI, or ISBN..."
            style={{
              flex: 1,
              padding: "0.75rem",
              borderRadius: "8px",
              border: "1px solid #e5e5e5",
              fontSize: "1rem",
              outline: "none",
            }}
          />
          <button
            onClick={searchPaper}
            style={{
              background: "#FF4D4D",
              color: "white",
              border: "none",
              padding: "0.75rem 1.5rem",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "1rem",
              transition: "background-color 0.3s ease",
            }}
          >
            Search
          </button>
        </div>
      </div>
    </div>
  </div>
</>
  );
};

// ReferenceItem component for displaying and verifying individual references
const ReferenceItem = ({ reference, index }) => {
  const [verificationStatus, setVerificationStatus] = useState(reference.verification_status || 'pending');
  const [results, setResults] = useState(null);
  
  const verifyReference = async () => {
    try {
      setVerificationStatus('in_progress');
      
      const response = await axios.post('http://localhost:3002/api/verify-reference', {
        reference
      });
      
      setVerificationStatus(response.data.verification_status);
      setResults(response.data.results);
    } catch (error) {
      console.error('Error verifying reference:', error);
      setVerificationStatus('failed');
    }
  };
  
  // Status indicator configurations
  const statusInfo = {
    pending: { icon: '⚪', text: 'Not Verified' },
    in_progress: { icon: '🔄', text: 'Verifying...' },
    verified: { icon: '✅', text: 'Verified' },
    not_found: { icon: '⚠️', text: 'Not Found' },
    failed: { icon: '❌', text: 'Verification Failed' },
    retracted: { icon: '🚫', text: 'Retracted' }
  };
  
  const status = statusInfo[verificationStatus] || statusInfo.pending;
  
  return (
    <li className="reference-item">
      <div className="reference-header">
        <div className="reference-content">
          <p className="reference-title">
            {reference.title || reference.unstructured || 'Untitled Reference'}
          </p>
          {reference.authors && reference.authors.length > 0 && (
            <p className="reference-authors">
              {Array.isArray(reference.authors) ? reference.authors.join(', ') : reference.authors}
            </p>
          )}
          {reference.year && (
            <p className="reference-year">Year: {reference.year}</p>
          )}
          {reference.doi && (
            <p className="reference-doi">
              DOI: <a href={`https://doi.org/${reference.doi}`} target="_blank" rel="noopener noreferrer">
                {reference.doi}
              </a>
            </p>
          )}
        </div>
        
        <div className="reference-status-container">
          <div className={`status-badge status-${verificationStatus}`}>
            <span className="status-icon">{status.icon}</span>
            <span className="status-text">{status.text}</span>
          </div>
          
          {verificationStatus === 'pending' && (
            <button 
              onClick={verifyReference}
              className="verify-button"
            >
              Verify
            </button>
          )}
        </div>
      </div>
      
      {/* Display verification results if available */}
      {results && verificationStatus !== 'failed' && verificationStatus !== 'pending' && (
        <div className="results-container">
          <p className="results-heading">Verification Results:</p>
          
          {results.crossref && results.crossref.length > 0 && (
            <div className="results-section">
              <p className="results-section-title">Found on CrossRef:</p>
              <ul className="results-list">
                {results.crossref.map((item, idx) => (
                  <li key={idx} className="results-item">
                    <strong>{item.title}</strong>
                    {item.publisher && <span> - {item.publisher}</span>}
                    {item.year && <span> ({item.year})</span>}
                    <br />
                    <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noopener noreferrer">
                      DOI: {item.doi}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {results.arxiv && results.arxiv.length > 0 && (
            <div className="results-section">
              <p className="results-section-title">Found on ArXiv:</p>
              <ul className="results-list">
                {results.arxiv.map((item, idx) => (
                  <li key={idx} className="results-item">
                    <a href={item.link} target="_blank" rel="noopener noreferrer">{item.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {results.semantic_scholar && results.semantic_scholar.length > 0 && (
            <div className="results-section">
              <p className="results-section-title">Found on Semantic Scholar:</p>
              <ul className="results-list">
                {results.semantic_scholar.map((item, idx) => (
                  <li key={idx} className="results-item">
                    <a href={`https://www.semanticscholar.org/paper/${item.paperId}`} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {results.retracted && results.retracted.length > 0 && (
            <div className="results-section">
              <p className="results-section-title retracted-title">Retraction Information:</p>
              <ul className="results-list">
                {results.retracted.map((item, idx) => (
                  <li key={idx} className="results-item">
                    <span className="retracted-title">{item.title}</span> - 
                    <a href={`https://doi.org/${item.doi}`} target="_blank" rel="noopener noreferrer">DOI: {item.doi}</a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {((results.crossref && results.crossref.length === 0) &&
            (results.arxiv && results.arxiv.length === 0) && 
            (results.semantic_scholar && results.semantic_scholar.length === 0) &&
            (results.retracted && results.retracted.length === 0)) && (
            <p className="not-found-message">
              This reference was not found in any of the searched databases.
            </p>
          )}
        </div>
      )}
    </li>
  );
};

export default Chat;