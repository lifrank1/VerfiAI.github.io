import React, { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { firebaseApp } from "../firebase-config";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  onSnapshot,
  deleteDoc,
} from "firebase/firestore";
import axios from "axios";
import NavigationHeader from "../components/NavigationHeader";
import { useAuth } from "../contexts/authContext";
import "../styles/ReferenceVerification.css";

const Chat = () => {
  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Hello! Enter a paper title, DOI, or ISBN to get started.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const user = useAuth(); // Retrieve the current user's UID
  const [citations, setCitations] = useState([]);

  useEffect(() => {
    const fetchCitations = () => {
      if (!user || !user.userID) return;

      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const citationsRef = collection(userRef, "citations");

      // Listen for real-time updates
      const unsubscribe = onSnapshot(citationsRef, (querySnapshot) => {
        // Include Firestore doc ID
        const citationsData = querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id, 
        }));
        setCitations(citationsData);
      });

      return () => unsubscribe();
    };

    fetchCitations();
  }, [user]);

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

  const searchPaper = async () => {
    if (input.trim() === "") return;

    if (input.trim().toLowerCase() === "clear") {
      setMessages([
        { type: "bot", text: "Hello! Enter a paper title, DOI, or ISBN to get started." },
      ]);
      setInput("");
      return;
    }

    setMessages((prev) => [...prev, { type: "user", text: input }]);
    setIsLoading(true);

    try {
      const response = await axios.post("http://localhost:3002/api/analyze-paper", {
        doi: input,
      });
      const paper = response.data.paper;

      let retractionNotice = paper.is_retracted ? (
        <div>
          <p style={{ color: "red", fontWeight: "bold" }}>🚨 This paper may be retracted!</p>
          <ul style={{ paddingLeft: "2rem" }}>
            {paper.retraction_info.map((item, idx) => (
              <li key={idx} style={{ marginBottom: "0.5rem" }}>
                <b>📌 Title:</b> {item.title}
                <br />
                <b>🔗 DOI:</b> {item.doi}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p style={{ color: "green" }}>✅ This paper does not appear to be retracted.</p>
      );

      const references = (
        <div className="references-container">
          <h4 className="references-title">
            References{" "}
            {paper.references && paper.references.length > 0
              ? `(${paper.references.length})`
              : ""}
          </h4>
          {paper.references && paper.references.length > 0 ? (
            <ul className="references-list">
              {paper.references.map((ref, idx) => (
                <ReferenceItem
                  key={idx}
                  reference={ref}
                  index={idx}
                  userID={user && user.userID}
                />
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
          <p>
            <b>📌 Title:</b> {paper.title}
          </p>
          <p>
            <b>👥 Authors:</b>
          </p>
          <ul style={{ paddingLeft: "2rem" }}>
            {paper.authors.map((author, index) => (
              <li key={index} style={{ marginBottom: "0.3rem" }}>
                {author}
              </li>
            ))}
          </ul>
          <p>
            <b>📊 Research Field:</b> {paper.research_field.field}
          </p>
          <p>
            <b>📅 Year:</b> {paper.year}
          </p>
          <p>
            <b>🔗 DOI:</b> {paper.doi}
          </p>
          {retractionNotice}
          {references}
        </div>
      );

      setMessages((prev) => [...prev, { type: "bot", text: formattedMessage }]);

      // Save main paper details to Firestore
      if (user && user.userID) {
        await saveCitationToFirestore(paper, user.userID);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        { type: "bot", text: "Error analyzing paper. Please check the DOI and try again." },
      ]);
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

  // ------------- NEW: DELETE CITATION -------------
  const deleteCitation = async (citationId) => {
    if (!user || !user.userID) return;
    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      // doc path: users/{userID}/citations/{citationId}
      const citationDocRef = doc(userRef, "citations", citationId);
      await deleteDoc(citationDocRef);
      console.log("Citation deleted successfully!");
    } catch (error) {
      console.error("Error deleting citation:", error);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      searchPaper();
    }
  };

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
          `}
        </style>
      </Helmet>

      <div
        style={{
          display: "flex",
          height: "100vh",
          margin: "0 auto",
          background: "white",
          boxShadow: "0 0 10px rgba(0,0,0,0.1)",
        }}
      >
        {/* Sidebar */}
        <div
          style={{
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
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "2px solid white",
              paddingBottom: "0.5rem",
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
          </div>

          <div
            style={{
              marginTop: "1rem",
              paddingTop: "0.5rem",
              overflowY: "auto",
              maxHeight: "85%",
            }}
          >
            {citations.length > 0 ? (
              citations.map((citation, idx) => (
                <div
                  key={citation.id}
                  style={{
                    marginBottom: "1rem",
                    background: "#fff",
                    padding: "0.5rem",
                    borderRadius: "8px",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  <p style={{ color: "#333" }}>
                    <b>{citation.title}</b>
                  </p>
                  <p style={{ color: "#555" }}>
                    {citation.authors && Array.isArray(citation.authors)
                      ? citation.authors.join(", ")
                      : "No authors available"}
                  </p>
                  <p style={{ color: "#555" }}>Year: {citation.year}</p>
                  {citation.doi && (
                    <p>
                      <a
                        href={`https://doi.org/${citation.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        DOI
                      </a>
                    </p>
                  )}

                  {/* DELETE BUTTON */}
                  <button
                    onClick={() => deleteCitation(citation.id)}
                    style={{
                      marginTop: "0.5rem",
                      backgroundColor: "#dc3545",
                      color: "white",
                      border: "none",
                      padding: "0.4rem 0.8rem",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Delete
                  </button>
                </div>
              ))
            ) : (
              <p>No citations saved yet!</p>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div
          style={{
            marginTop: "6rem",
            marginLeft: "300px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "1rem",
          }}
        >
          {/* Chat Messages */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
            ref={messagesEndRef}
          >
            {messages.map((message, index) => (
              <div
                key={index}
                style={{
                  display: "flex",
                  justifyContent:
                    message.type === "user" ? "flex-end" : "flex-start",
                  padding: "0.5rem 1rem",
                }}
              >
                <div
                  style={{
                    maxWidth: "80%",
                    padding: "1rem",
                    borderRadius: "12px",
                    background: message.type === "user" ? "#6E44FF" : "#f7f7f8",
                    color: message.type === "user" ? "white" : "#333",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  {message.text}
                </div>
              </div>
            ))}

            {isLoading && (
              <div
                style={{
                  padding: "1rem",
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                <div
                  style={{
                    width: "80%",
                    height: "4px",
                    background: "#f0f0f0",
                    borderRadius: "2px",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "30%",
                      height: "100%",
                      background: "#6E44FF",
                      animation: "loading 1s infinite linear",
                      borderRadius: "2px",
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Search Bar */}
          <div
            style={{
              padding: "1rem",
              borderTop: "1px solid #e5e5e5",
              background: "white",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                maxWidth: "800px",
                margin: "0 auto",
              }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    searchPaper();
                  }
                }}
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

// ---------------------------------------------------
// ReferenceItem component for each reference
// ---------------------------------------------------
const ReferenceItem = ({ reference, index, userID }) => {
  const [verificationStatus, setVerificationStatus] = useState(
    reference.verification_status || "pending"
  );
  const [results, setResults] = useState(null);

  const verifyReference = async () => {
    try {
      setVerificationStatus("in_progress");

      const response = await axios.post("http://localhost:3002/api/verify-reference", {
        reference,
      });

      setVerificationStatus(response.data.verification_status);
      setResults(response.data.results);
    } catch (error) {
      console.error("Error verifying reference:", error);
      setVerificationStatus("failed");
    }
  };

  // Save reference as a citation in Firestore
  const saveReferenceToFirestore = async (ref, userID) => {
    if (!userID) return; // Safety check

    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", userID);
      const citationsRef = collection(userRef, "citations");

      const newCitation = {
        title: ref.title || ref.unstructured || "Untitled Reference",
        authors: ref.authors || [],
        year: ref.year || null,
        doi: ref.doi || null,
        userID: userID,
        timestamp: new Date(),
      };

      await addDoc(citationsRef, newCitation);
      console.log("Reference saved to Firestore!");
    } catch (error) {
      console.error("Error saving reference:", error);
    }
  };

  // Status indicator configurations
  const statusInfo = {
    pending: { icon: "⚪", text: "Not Verified" },
    in_progress: { icon: "🔄", text: "Verifying..." },
    verified: { icon: "✅", text: "Verified" },
    not_found: { icon: "⚠️", text: "Not Found" },
    failed: { icon: "❌", text: "Verification Failed" },
    retracted: { icon: "🚫", text: "Retracted" },
  };

  const status = statusInfo[verificationStatus] || statusInfo.pending;

  return (
    <li className="reference-item">
      <div className="reference-header">
        <div className="reference-content">
          <p className="reference-title">
            [{index + 1}] {reference.title || reference.unstructured || "Untitled Reference"}
          </p>
          {reference.authors && reference.authors.length > 0 && (
            <p className="reference-authors">
              {Array.isArray(reference.authors)
                ? reference.authors.join(", ")
                : reference.authors}
            </p>
          )}
          {reference.year && <p className="reference-year">Year: {reference.year}</p>}
          {reference.doi && (
            <p className="reference-doi">
              DOI:{" "}
              <a href={`https://doi.org/${reference.doi}`} target="_blank" rel="noopener noreferrer">
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

          {/* Verify Button (only if pending) */}
          {verificationStatus === "pending" && (
            <button onClick={verifyReference} className="verify-button">
              Verify
            </button>
          )}

          {/* Save Button */}
          <button
            onClick={() => saveReferenceToFirestore(reference, userID)}
            className="save-button"
            disabled={!userID}
            style={{ marginTop: "0.5rem" }}
          >
            Save
          </button>
        </div>
      </div>

      {/* Verification results */}
      {results &&
        verificationStatus !== "failed" &&
        verificationStatus !== "pending" && (
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
                      <a
                        href={`https://doi.org/${item.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
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
                      <a href={item.link} target="_blank" rel="noopener noreferrer">
                        {item.title}
                      </a>
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
                      <a
                        href={`https://www.semanticscholar.org/paper/${item.paperId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {results.retracted && results.retracted.length > 0 && (
              <div className="results-section">
                <p className="results-section-title retracted-title">
                  Retraction Information:
                </p>
                <ul className="results-list">
                  {results.retracted.map((item, idx) => (
                    <li key={idx} className="results-item">
                      <span className="retracted-title">{item.title}</span> -{" "}
                      <a
                        href={`https://doi.org/${item.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        DOI: {item.doi}
                      </a>
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
