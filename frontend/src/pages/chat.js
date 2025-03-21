  import React, { useState, useRef, useEffect } from "react";
  import { Helmet } from "react-helmet";
  import { useNavigate } from "react-router-dom";
  import { getAuth, signOut } from "firebase/auth";
  import { firebaseApp } from "../firebase-config";
  import { getFirestore, collection, doc, addDoc, onSnapshot } from "firebase/firestore";
  import axios from "axios";
  import NavigationHeader from "../components/NavigationHeader";
  import { useAuth } from "../contexts/authContext";

const Chat = () => {
  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a PDF document.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [uploadedDocument, setUploadedDocument] = useState(null);
  const [documentText, setDocumentText] = useState("");
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const navigate = useNavigate();

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

    const searchPaper = async () => {
  if (input.trim() === "") return;

  if (input.trim().toLowerCase() === "clear") {
    setMessages([{ type: "bot", text: "Hello! Enter a paper title, DOI, or ISBN to get started." }]);
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
        );
      } else {
        retractionNotice = <p style={{ color: "green" }}>✅ This paper does not appear to be retracted.</p>;
      }
  
      const formattedMessage = (
        <div>
          <h3>Paper Details</h3>
          <p><b>📌 Title:</b> {title}</p>
          <p><b>👥 Authors:</b></p>
          <ul style={{ paddingLeft: "2rem" }}>
            {authors.map((author, index) => (
              <li key={index} style={{ marginBottom: "0.3rem" }}>{author}</li>
            ))}
          </ul>
          <p><b>📊 Research Field:</b> {research_field.field}</p>
          <p><b>📅 Year:</b> {year}</p>
          <p><b>🔗 DOI:</b> {doi}</p>
          {retractionNotice}
          <p><b>📝 Suggested Citation:</b></p>
          <div style={{ 
            background: "#f5f5f5", 
            padding: "1rem", 
            borderRadius: "8px",
            fontFamily: "monospace" 
          }}>
            {response.data.paper.citation}
          </div>
        </div>
      );
  
      setMessages(prev => [...prev, { type: "bot", text: formattedMessage }]);
  
    } catch (error) {
      setMessages(prev => [...prev, {
        type: "bot",
        text: "Error analyzing paper. Please check the DOI and try again."
      }]);
    } finally {
      setIsLoading(false);
      setInput("");
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setMessages(prev => [...prev, { 
      type: "user", 
      text: `Uploading document: ${file.name}` 
    }]);
    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        "http://localhost:3002/api/upload-document",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      if (response.data.success) {
        setUploadedDocument(file.name);
        setDocumentText(response.data.extractedText);
        
        // Create a formatted message with metadata and references
        const metadata = response.data.metadata || {};
        const citationStyle = response.data.citationStyle;
        
        let metadataSection = "";
        if (Object.keys(metadata).length > 0) {
          metadataSection = (
            <div style={{ marginBottom: "1rem" }}>
              <h3>Document Metadata</h3>
              {metadata.title && <p><b>Title:</b> {metadata.title}</p>}
              {metadata.authors && metadata.authors.length > 0 && (
                <div>
                  <p><b>Authors:</b></p>
                  <ul style={{ paddingLeft: "2rem" }}>
                    {metadata.authors.map((author, idx) => (
                      <li key={idx}>{author}</li>
                    ))}
                  </ul>
                </div>
              )}
              {metadata.abstract && <p><b>Abstract:</b> {metadata.abstract}</p>}
              {metadata.keywords && metadata.keywords.length > 0 && (
                <p><b>Keywords:</b> {metadata.keywords.join(", ")}</p>
              )}
              {citationStyle && <p><b>Citation Style:</b> {citationStyle}</p>}
            </div>
          );
        }
        
        // Display references if available
        let referencesMessage = "";
        if (response.data.references && response.data.references.length > 0) {
          referencesMessage = (
            <div>
              <h3>Extracted References</h3>
              <ul style={{ paddingLeft: "2rem" }}>
                {response.data.references.map((ref, idx) => (
                  <li key={idx} style={{ marginBottom: "0.5rem" }}>
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          );
        }

        setMessages(prev => [...prev, { 
          type: "bot", 
          text: (
            <div>
              <p>✅ Document uploaded successfully: <b>{file.name}</b></p>
              <p>You can now ask questions about this document.</p>
              {metadataSection}
              {referencesMessage}
            </div>
          )
        }]);
      } else {
        setMessages(prev => [...prev, { 
          type: "bot", 
          text: "Error processing document. Please try again." 
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        type: "bot", 
        text: `Error uploading document: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChatWithDocument = async () => {
    if (input.trim() === "" || !documentText) return;
    
    setMessages(prev => [...prev, { type: "user", text: input }]);
    setIsLoading(true);
    
    try {
      const response = await axios.post("http://localhost:3002/api/chat", {
        message: input,
        paperContent: documentText
      });
      
      setMessages(prev => [...prev, { 
        type: "bot", 
        text: response.data.reply 
      }]);
    } catch (error) {
      setMessages(prev => [...prev, { 
        type: "bot", 
        text: `Error: ${error.message}` 
      }]);
    } finally {
      setIsLoading(false);
      setInput("");
    }
  };

  const handleSubmit = () => {
    if (uploadedDocument) {
      handleChatWithDocument();
    } else {
      searchPaper();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <>
      <Helmet>
        <title>Research Paper Validator - VerifAI</title>
        <meta name="description" content="Validate and cite research papers" />
        <style>
          {`
            body {
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
          `}
        </style>
      </Helmet>
      <div style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        maxWidth: "1000px",
        margin: "0 auto",
        background: "white",
        boxShadow: "0 0 10px rgba(0,0,0,0.1)",
      }}>
        <div
          style={{
            padding: "1rem",
            borderBottom: "1px solid #e5e5e5",
            background: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            paddingLeft: "2rem",
            paddingRight: "2rem",
          }}
        >
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

        {/* Search Bar */}
        <div style={{
          padding: "1rem",
          borderTop: "1px solid #e5e5e5",
          background: "white",
        }}>
          {uploadedDocument && (
            <div style={{
              padding: "0.5rem",
              marginBottom: "0.5rem",
              background: "#f0f0f0",
              borderRadius: "8px",
              fontSize: "0.9rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <span>📄 Working with: <b>{uploadedDocument}</b></span>
              <button 
                onClick={() => {
                  setUploadedDocument(null);
                  setDocumentText("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#FF4D4D",
                  cursor: "pointer",
                  fontSize: "0.9rem"
                }}
              >
                Clear
              </button>
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
              placeholder={uploadedDocument ? "Ask about this document..." : "Enter paper title, DOI, or ISBN..."}
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
              onClick={() => fileInputRef.current.click()}
              style={{
                background: "#6E44FF",
                color: "white",
                border: "none",
                padding: "0.75rem",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "1rem",
                transition: "background-color 0.3s ease",
              }}
            >
              📄
            </button>
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.docx,.txt"
              style={{ display: "none" }}
            />
            
            <button
              onClick={handleSubmit}
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
              {uploadedDocument ? "Ask" : "Search"}
            </button>
          </div>
        </div>
      </div>
    </div>
  </>


    );
  };

  export default Chat;