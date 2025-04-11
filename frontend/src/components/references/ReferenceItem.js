import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import ChatContext from '../chat/ChatContext';

const ReferenceItem = ({ reference, index, userID }) => {
  const [verificationStatus, setVerificationStatus] = useState("pending");
  const [results, setResults] = useState(null);
  const { activeChatId, saveReferenceToFirestore } = useContext(ChatContext);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationStarted, setVerificationStarted] = useState(false);
  
  // Force re-render at regular intervals during verification
  const [, forceUpdate] = useState(0);
  
  useEffect(() => {
    let intervalId;
    if (verificationStatus === "in_progress") {
      // Force re-render every second while verifying to ensure UI updates
      intervalId = setInterval(() => {
        forceUpdate(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [verificationStatus]);

  // Start verification on component mount with no dependencies on userID
  useEffect(() => {
    console.log(`ReferenceItem mounted: Index=${index}, UserID=${userID ? 'present' : 'absent'}`);
    
    // Only start verification if we haven't already
    if (!verificationStarted) {
      const timer = setTimeout(() => {
        console.log(`Starting verification for reference ${index}`);
        setVerificationStatus("in_progress");
        setIsVerifying(true);
        setVerificationStarted(true);
      }, 200 * (index + 1)); // Staggered start times for better UI
      
      return () => clearTimeout(timer);
    }
  }, [index, verificationStarted]);

  // Handle verification process
  useEffect(() => {
    if (isVerifying) {
      console.log(`Performing verification API call for reference ${index}, userID: ${userID || 'none'}`);
      
      const performVerification = async () => {
        try {
          console.log(`Verification API call starting for reference ${index}:`, reference);
          const response = await axios.post("http://localhost:3002/api/verify-reference", {
            reference,
          });
          console.log(`Verification API response for ${index}:`, response.data);

          // Update UI with results
          setVerificationStatus(response.data.verification_status);
          setResults(response.data.results);
        } catch (error) {
          console.error(`Verification failed for reference ${index}:`, error);
          setVerificationStatus("failed");
        } finally {
          setIsVerifying(false);
        }
      };

      performVerification();
    }
  }, [isVerifying, reference, index]);

  const handleSaveReference = async () => {
    if (!userID) {
      alert("Please log in to save citations");
      return;
    }
    
    try {
      const citationData = {
        title: reference.title || reference.unstructured || "Untitled Reference",
        authors: reference.authors || [],
        year: reference.year || null,
        doi: reference.doi || null,
        research_field: { field: "Reference" },
        is_retracted: verificationStatus === "retracted"
      };
      
      const success = await saveReferenceToFirestore(citationData, userID);
      
      if (success) {
        alert("Citation saved successfully!");
      }
    } catch (error) {
      console.error("Error saving reference:", error);
      alert("Error saving citation. Please try again.");
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
              <a
                href={`https://doi.org/${reference.doi}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {reference.doi}
              </a>
            </p>
          )}
        </div>

        <div className="reference-status-container" style={{ pointerEvents: 'auto' }}>
          <div className={`status-badge status-${verificationStatus}`}>
            <span className="status-icon">{status.icon}</span>
            <span className="status-text">{status.text}</span>
          </div>

          {/* Save Button (only if verified) */}
          {verificationStatus === "verified" && (
            <button
              onClick={handleSaveReference}
              className="verify-button"
              style={{
                cursor: 'pointer',
                background: '#6E44FF',
                color: 'white',
                border: 'none',
                padding: '4px 8px',
                borderRadius: '4px'
              }}
            >
              Save
            </button>
          )}
        </div>
      </div>

      {/* Verification results */}
      {results && verificationStatus !== "failed" && verificationStatus !== "pending" && (
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

export default ReferenceItem; 