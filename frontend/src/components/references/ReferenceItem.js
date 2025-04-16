import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import ChatContext from '../chat/ChatContext';

const ReferenceItem = ({ reference, index, userID }) => {
  const [verificationResults, setVerificationResults] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [hasVerified, setHasVerified] = useState(false);
  const { saveReferenceToFirestore, user } = useContext(ChatContext);

  // Reset verification state when user login state changes
  useEffect(() => {
    setHasVerified(false);
  }, [userID, user?.userID]);

  // Execute verification on mount - simple and direct approach
  useEffect(() => {
    const verifyReference = async () => {
      if (hasVerified) return; // Prevent multiple verifications
      
      try {
        console.log(`Verifying reference ${index}:`, reference);
        setIsLoading(true);
        
        const response = await axios.post("https://verfiai.uc.r.appspot.com/api/verify-reference", {
          reference,
        });
        
        console.log(`Verification result for ${index}:`, response.data);
        setVerificationResults(response.data.results);
        setVerificationSuccess(response.data.verification_status === "verified");
        setHasVerified(true);
      } catch (error) {
        console.error(`Verification failed for reference ${index}:`, error);
      } finally {
        setIsLoading(false);
      }
    };

    verifyReference();
  }, [reference, index, hasVerified]); // Add hasVerified to dependencies

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
        is_retracted: false
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
          {isLoading ? (
            <div className="status-badge status-in_progress">
              <span className="status-icon">🔄</span>
              <span className="status-text">Verifying...</span>
            </div>
          ) : verificationSuccess ? (
            <>
              <div className="status-badge status-verified">
                <span className="status-icon">✅</span>
                <span className="status-text">Verified</span>
              </div>
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
            </>
          ) : (
            <div className="status-badge status-not_found">
              <span className="status-icon">⚠️</span>
              <span className="status-text">Not Found</span>
            </div>
          )}
        </div>
      </div>

      {/* Only show verification results when available and not loading */}
      {verificationResults && !isLoading && (
        <div className="results-container">
          <p className="results-heading">Verification Results:</p>

          {verificationResults.crossref && verificationResults.crossref.length > 0 && (
            <div className="results-section">
              <p className="results-section-title">Found on CrossRef:</p>
              <ul className="results-list">
                {verificationResults.crossref.map((item, idx) => (
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

          {verificationResults.arxiv && verificationResults.arxiv.length > 0 && (
            <div className="results-section">
              <p className="results-section-title">Found on ArXiv:</p>
              <ul className="results-list">
                {verificationResults.arxiv.map((item, idx) => (
                  <li key={idx} className="results-item">
                    <a href={item.link} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {verificationResults.semantic_scholar && verificationResults.semantic_scholar.length > 0 && (
            <div className="results-section">
              <p className="results-section-title">Found on Semantic Scholar:</p>
              <ul className="results-list">
                {verificationResults.semantic_scholar.map((item, idx) => (
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

          {verificationResults.retracted && verificationResults.retracted.length > 0 && (
            <div className="results-section">
              <p className="results-section-title retracted-title">
                Retraction Information:
              </p>
              <ul className="results-list">
                {verificationResults.retracted.map((item, idx) => (
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

          {((verificationResults.crossref && verificationResults.crossref.length === 0) &&
            (verificationResults.arxiv && verificationResults.arxiv.length === 0) &&
            (verificationResults.semantic_scholar && verificationResults.semantic_scholar.length === 0) &&
            (verificationResults.retracted && verificationResults.retracted.length === 0)) && (
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