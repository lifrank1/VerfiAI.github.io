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
  getDocs,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import axios from "axios";
import NavigationHeader from "../components/NavigationHeader";
import { useAuth } from "../contexts/authContext";
import "../styles/ReferenceVerification.css";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import config from '../config';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const VerificationStatsButton = ({ references, user, saveReferenceToFirestore }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [verificationStats, setVerificationStats] = useState({
    verified: 0,
    notVerified: 0,
    unverifiable: 0,
    unverifiableRefs: [],
    loading: false
  });
  const [verificationResults, setVerificationResults] = useState([]);

  const verifyAllReferences = async () => {
    setVerificationStats(prev => ({ ...prev, loading: true }));
    
    const results = await Promise.all(
      references.map(async (reference) => {
        try {
          const response = await axios.post(`${config.API_BASE_URL}/api/verify-reference`, {
            reference
          });
          return {
            reference,
            status: response.data.verification_status
          };
        } catch (error) {
          console.error('Error verifying reference:', error);
          return {
            reference,
            status: 'failed'
          };
        }
      })
    );

    setVerificationResults(results);

    const stats = results.reduce((acc, { status, reference }) => {
      if (status === 'verified') acc.verified++;
      else if (status === 'not_found' || status === 'failed') {
        acc.unverifiable++;
        acc.unverifiableRefs.push(reference);
      }
      else acc.notVerified++;
      return acc;
    }, { verified: 0, notVerified: 0, unverifiable: 0, unverifiableRefs: [] });

    setVerificationStats({ ...stats, loading: false });
  };

  const chartData = {
    labels: ['Verified', 'Not Verified', 'Unverifiable'],
    datasets: [{
      data: [
        verificationStats.verified,
        verificationStats.notVerified,
        verificationStats.unverifiable
      ],
      backgroundColor: [
        'rgba(75, 192, 192, 0.6)',
        'rgba(255, 206, 86, 0.6)',
        'rgba(255, 99, 132, 0.6)'
      ],
      borderColor: [
        'rgba(75, 192, 192, 1)',
        'rgba(255, 206, 86, 1)',
        'rgba(255, 99, 132, 1)'
      ],
      borderWidth: 1
    }]
  };

  const handleChartClick = async (event, elements) => {
    if (!elements || !elements.length) return;
    
    const clickedIndex = elements[0].index;
    // 0 = Verified, 1 = Not Verified, 2 = Unverifiable
    if (clickedIndex === 0) { // Only handle clicks on the "Verified" section
      const verifiedRefs = references.filter((ref) => {
        const result = verificationResults.find(vr => 
          vr.reference.title === ref.title && 
          vr.reference.doi === ref.doi
        );
        return result && result.status === 'verified';
      });
      
      // Save all verified references to Firestore
      for (const ref of verifiedRefs) {
        const citationData = {
          title: ref.title || "Untitled Reference",
          authors: ref.authors || [],
          year: ref.year || null,
          doi: ref.doi || null,
          research_field: { field: "Reference" },
          is_retracted: false
        };
        await saveReferenceToFirestore(citationData, user.userID);
      }
    }
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom',
      },
      title: {
        display: true,
        text: 'Reference Verification Status',
        color: '#333',
        font: { size: 16 }
      }
    },
    onClick: handleChartClick
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onMouseEnter={() => {
          setIsHovered(true);
          if (!verificationStats.verified && !verificationStats.loading) {
            verifyAllReferences();
          }
        }}
        onMouseLeave={() => !isOpen && setIsHovered(false)}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!verificationStats.verified && !verificationStats.loading) {
            verifyAllReferences();
          }
        }}
        style={{
          background: '#6E44FF',
          color: 'white',
          border: 'none',
          padding: '0.5rem',
          borderRadius: '50%',
          width: '30px',
          height: '30px',
          cursor: 'pointer',
          marginLeft: '10px'
        }}
      >
        📊
      </button>

      {/* Hover preview */}
      {isHovered && !isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'white',
          padding: '1rem',
          borderRadius: '8px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          zIndex: 1000,
          width: '200px'
        }}>
          <div style={{ textAlign: 'center' }}>
            {verificationStats.loading ? (
              <p>Verifying references...</p>
            ) : (
              <p>Click to see full verification details</p>
            )}
          </div>
        </div>
      )}

      {/* Full modal when clicked */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: '2rem',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          zIndex: 1000,
          maxWidth: '600px',
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto'
        }}>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>

          {verificationStats.loading ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>
              <p>Verifying references...</p>
            </div>
          ) : (
            <>
              <div style={{ maxWidth: '400px', margin: '0 auto' }}>
                <Pie data={chartData} options={options} />
              </div>
              
              <div style={{ marginTop: '2rem' }}>
                <h4>Verification Summary</h4>
                <p>Total References: {references.length}</p>
                <p>Verified: {verificationStats.verified}</p>
                <p>Not Verified: {verificationStats.notVerified}</p>
                <p>Unverifiable: {verificationStats.unverifiable}</p>

                {verificationStats.unverifiableRefs.length > 0 && (
                  <div style={{ marginTop: '1rem' }}>
                    <h4>Unverifiable Citations:</h4>
                    <ul style={{ 
                      listStyle: 'none', 
                      padding: 0,
                      maxHeight: '200px',
                      overflowY: 'auto'
                    }}>
                      {verificationStats.unverifiableRefs.map((ref, idx) => (
                        <li key={idx} style={{
                          padding: '0.5rem',
                          margin: '0.5rem 0',
                          background: '#fff5f5',
                          borderRadius: '4px'
                        }}>
                          <strong>{ref.title || 'Untitled Reference'}</strong>
                          {ref.authors && (
                            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                              Authors: {Array.isArray(ref.authors) ? ref.authors.join(', ') : ref.authors}
                            </p>
                          )}
                          {ref.year && <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>Year: {ref.year}</p>}
                          {ref.doi && (
                            <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>
                              DOI: <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noopener noreferrer">{ref.doi}</a>
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

const ReferenceItem = ({ reference, index, userID, autoVerify }) => {
  const [verificationStatus, setVerificationStatus] = useState(
    reference.verification_status || "pending"
  );
  const [results, setResults] = useState(null);

  const verifyReference = async () => {
    try {
      setVerificationStatus("in_progress");

      const response = await axios.post(`${config.API_BASE_URL}/api/verify-reference`, {
        reference,
      });

      setVerificationStatus(response.data.verification_status);
      setResults(response.data.results);
    } catch (error) {
      console.error("Error verifying reference:", error);
      setVerificationStatus("failed");
    }
  };

  // Auto-verify on mount if autoVerify is true
  useEffect(() => {
    if (autoVerify && verificationStatus === "pending") {
      verifyReference();
    }
  }, [autoVerify, verificationStatus]);

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
              <a
                href={`https://doi.org/${reference.doi}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {reference.doi}
              </a>
            </p>
          )}
          {reference.similarity_percentage !== undefined && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              margin: '0.25rem 0',
              fontSize: '0.9rem',
              color: '#333'
            }}>
              <span>Reliability: {reference.similarity_percentage}%</span>
              <div 
                style={{ 
                  position: 'relative',
                  marginLeft: '0.5rem',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  const tooltip = e.currentTarget.querySelector('.tooltip');
                  tooltip.style.visibility = 'visible';
                  tooltip.style.opacity = 1;
                }}
                onMouseLeave={(e) => {
                  const tooltip = e.currentTarget.querySelector('.tooltip');
                  tooltip.style.visibility = 'hidden';
                  tooltip.style.opacity = 0;
                }}
              >
                <span>🔍</span>
                <div 
                  className="tooltip"
                  style={{
                    position: 'absolute',
                    bottom: '100%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    backgroundColor: '#333',
                    color: 'white',
                    padding: '0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.8rem',
                    width: '300px',
                    textAlign: 'center',
                    visibility: 'hidden',
                    opacity: 0,
                    transition: 'opacity 0.2s, visibility 0.2s',
                    zIndex: 1000,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                  }}
                >
                  Reliability Score Calculation:
                  <br />
                  final_score = (0.7 × title_sim + 0.3 × content_sim) × 2
                  <br />
                  <br />
                  • title_sim: Similarity between titles
                  <br />
                  • content_sim: Similarity between title + abstract
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="reference-status-container">
          <div className={`status-badge status-${verificationStatus}`}>
            <span className="status-icon">{status.icon}</span>
            <span className="status-text">{status.text}</span>
          </div>

          {/* Verify Button (only if pending and not auto-verifying) */}
          {verificationStatus === "pending" && !autoVerify && (
            <button onClick={verifyReference} className="verify-button">
              Verify
            </button>
          )}

          {/* Save Button (only if verified) */}
          {verificationStatus === "verified" && (
            <button
              onClick={() => saveReferenceToFirestore(reference, userID)}
              className="verify-button"
              disabled={!userID}
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

const Chat = () => {
  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Hello! Enter a paper title, DOI, or ISBN to get started.",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const [searchProgress, setSearchProgress] = useState(0);
  const [chatHistories, setChatHistories] = useState([]);
  const [currentChatId, setCurrentChatId] = useState(null);
  const [editingChatId, setEditingChatId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [chatInputs, setChatInputs] = useState([]); // Store user inputs for replay

  const messagesEndRef = useRef(null);
  const navigate = useNavigate();
  const user = useAuth();
  const [citations, setCitations] = useState([]);

  // Listen for real-time updates to chat histories
  useEffect(() => {
    const fetchChatHistories = () => {
      if (!user || !user.userID) return;

      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const chatsRef = collection(userRef, "chats");

      // Listen for real-time updates
      const unsubscribe = onSnapshot(chatsRef, (querySnapshot) => {
        const chatData = querySnapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        setChatHistories(chatData);
      });

      return () => unsubscribe();
    };

    fetchChatHistories();
  }, [user]);

  // Load chat from Firestore and replay the conversation
  const loadChat = async (chatId) => {
    if (!user || !user.userID) return;

    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const chatDoc = doc(userRef, "chats", chatId);
      const chatSnap = await getDoc(chatDoc);

      if (chatSnap.exists()) {
        const chatData = chatSnap.data();
        setCurrentChatId(chatId);
        
        // Set the existing messages from the chat history
        setMessages(chatData.messages);
        
        // Extract user inputs from the chat history for replay if needed
        const userInputs = chatData.messages
          .filter(msg => msg.type === "user")
          .map(msg => msg.text);
        
        setChatInputs(userInputs);
      }
    } catch (error) {
      console.error("Error loading chat:", error);
    }
  };

  // Modify searchPaper to accept input parameter
  const searchPaper = async (inputText = input) => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setSearchProgress(0);

    try {
      const userMessage = { type: "user", text: inputText };
      await handleNewMessage(userMessage);

      let response;
      if (isISBN(inputText)) {
        response = await axios.post(`${config.API_BASE_URL}/api/isbn-citation`, {
          isbn: inputText,
        });
      } else {
        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setSearchProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 500);

        response = await axios.post(`${config.API_BASE_URL}/api/analyze-paper`, {
          doi: inputText,
        });

        clearInterval(progressInterval);
        setSearchProgress(100);
      }

      const paper = response.data.paper;
      console.log("Received paper:", paper);

      // Format the response message
      const formattedMessage = (
        <div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            marginBottom: '1rem'
          }}>
            <h3 style={{ margin: 0 }}>Paper Details</h3>
            <VerificationStatsButton 
              references={paper.references || []} 
              user={user}
              saveReferenceToFirestore={saveCitationToFirestore}
            />
          </div>
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
            <b>📊 Research Field:</b> {paper.research_field?.field || "Unspecified"}
          </p>
          <p>
            <b>📅 Year:</b> {paper.year}
          </p>
          <p>
            <b>🔗 DOI:</b> {paper.doi}
          </p>
          {paper.is_retracted ? (
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
          )}
          {paper.references && paper.references.length > 0 && (
            <div className="references-container">
              <h4 className="references-title">
                References ({paper.references.length})
              </h4>
              <ul className="references-list">
                {paper.references.map((ref, idx) => (
                  <ReferenceItem
                    key={idx}
                    reference={ref}
                    index={idx}
                    userID={user && user.userID}
                    autoVerify={true}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      );

      const botMessage = { type: "bot", text: formattedMessage };
      await handleNewMessage(botMessage);
    } catch (error) {
      const errorMessage = {
        type: "bot",
        text: "Error analyzing paper. Please check the DOI and try again.",
      };
      await handleNewMessage(errorMessage);
    } finally {
      setIsLoading(false);
      setInput("");
    }
  };

  // Modify handleNewMessage to only save user inputs
  const handleNewMessage = async (newMessage) => {
    try {
      const updatedMessages = [...messages, newMessage];
      setMessages(updatedMessages);

      if (!user || !user.userID) return; // Don't save if not logged in

      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);

      if (currentChatId) {
        // Update existing chat
        const chatDoc = doc(userRef, "chats", currentChatId);
        await updateDoc(chatDoc, {
          messages: updatedMessages,
          timestamp: new Date()
        });
      } else {
        // Create a new chat only if there isn't one
        const title = newMessage.type === "user" 
          ? newMessage.text.substring(0, 30) + "..."
          : "New Chat";
        
        const chatsRef = collection(userRef, "chats");

        const newChat = {
          title: title,
          messages: updatedMessages,
          timestamp: new Date(),
          userID: user.userID,
        };

        const docRef = await addDoc(chatsRef, newChat);
        setCurrentChatId(docRef.id);
      }
    } catch (error) {
      console.error("Error saving message:", error);
    }
  };

  // Delete chat from Firestore
  const deleteChat = async (chatId) => {
    if (!user || !user.userID) return;

    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const chatDoc = doc(userRef, "chats", chatId);
      await deleteDoc(chatDoc);
      
      if (currentChatId === chatId) {
        setMessages([{
          type: "bot",
          text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis.",
        }]);
        setCurrentChatId(null);
      }
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  // Delete all chats
  const deleteAllChats = async () => {
    if (!user || !user.userID) return;

    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const chatsRef = collection(userRef, "chats");
      
      const snapshot = await getDocs(chatsRef);
      const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      setMessages([{
        type: "bot",
        text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis.",
      }]);
      setCurrentChatId(null);
    } catch (error) {
      console.error("Error deleting all chats:", error);
    }
  };

  // Delete all citations
  const deleteAllCitations = async () => {
    if (!user || !user.userID) return;
    
    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const citationsRef = collection(userRef, "citations");
      
      // Get all citations
      const snapshot = await getDocs(citationsRef);
      
      // Delete each citation
      const deletePromises = snapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      
      await Promise.all(deletePromises);
      console.log("All citations deleted successfully!");
    } catch (error) {
      console.error("Error deleting all citations:", error);
    }
  };

  // Listen for real-time updates to citations
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

    // This effect will run whenever the user changes
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

  // Basic ISBN validation
  const isISBN = (input) => {
    return /^(?:\d{10}|\d{13})$/.test(input.replace(/-/g, ""));
  };

  // Save any paper-like object to Firestore
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

  // Delete a citation by ID
  const deleteCitation = async (citationId) => {
    if (!user || !user.userID) return;
    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const citationDocRef = doc(userRef, "citations", citationId);
      await deleteDoc(citationDocRef);
      console.log("Citation deleted successfully!");
    } catch (error) {
      console.error("Error deleting citation:", error);
    }
  };

  // Press Enter to search
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      searchPaper();
    }
  };

  // Update chat title in Firestore
  const updateChatTitle = async (chatId, newTitle) => {
    if (!user || !user.userID) return;

    try {
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const chatDoc = doc(userRef, "chats", chatId);
      
      await updateDoc(chatDoc, {
        title: newTitle
      });
    } catch (error) {
      console.error("Error updating chat title:", error);
    }
  };

  const handleEditStart = (chat) => {
    setEditingChatId(chat.id);
    setEditTitle(chat.title);
  };

  const handleEditSave = async (chatId) => {
    if (editTitle.trim() !== '') {
      await updateChatTitle(chatId, editTitle.trim());
    }
    setEditingChatId(null);
    setEditTitle("");
  };

  const handleEditKeyPress = (e, chatId) => {
    if (e.key === 'Enter') {
      handleEditSave(chatId);
    }
  };

  return (
    <>
      <NavigationHeader />
      <Helmet>
        <title>VerifAI - Chat</title>
        <style>
          {`
            @keyframes gradient-animation {
              0% { background-position: 0% 50%; }
              50% { background-position: 100% 50%; }
              100% { background-position: 0% 50%; }
            }
            .progress-bar {
              width: 100%;
              height: 100%;
              background: #6E44FF;
              border-radius: 2px;
              transition: width 0.3s ease;
            }
            .sidebar {
              background: #f8f9fa;
              border-right: 1px solid #e9ecef;
              height: calc(100vh - 6rem);
              position: fixed;
              top: 6rem;
              width: 300px;
              display: flex;
              flex-direction: column;
              padding: 1.5rem 1rem;
              overflow-y: auto;
            }
            .main-content {
              margin-left: 300px;
              margin-right: 300px;
              height: calc(100vh - 6rem);
              display: flex;
              flex-direction: column;
              padding: 1.5rem;
              background: #fff;
              position: relative;
            }
            .chat-messages {
              flex: 1;
              overflow-y: auto;
              padding: 1rem;
              display: flex;
              flex-direction: column;
              gap: 1rem;
              scroll-behavior: smooth;
              margin-bottom: 25px;
            }
            .message {
              max-width: 80%;
              padding: 1rem;
              border-radius: 12px;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .user-message {
              background: #6E44FF;
              color: white;
              margin-left: auto;
            }
            .bot-message {
              background: #f7f7f8;
              color: #333;
              margin-right: auto;
            }
            .input-area {
              position: fixed;
              bottom: 0;
              left: 300px;
              right: 300px;
              padding: 1.5rem;
              background: #fff;
              border-top: 1px solid #e9ecef;
              box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
              z-index: 100;
            }
            .search-section {
              display: flex;
              gap: 1rem;
              margin-bottom: 0.5rem;
              background: #f8f9fa;
              padding: 1rem;
              border-radius: 8px;
              border: 1px solid #e9ecef;
              margin: 0 auto;
              max-width: 800px;
            }
            .button {
              padding: 0.8rem 1.5rem;
              background: #6E44FF;
              color: white;
              border: none;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s ease;
              white-space: nowrap;
            }
            .input {
              flex: 1;
              padding: 0.8rem 1.2rem;
              border-radius: 8px;
              border: 1px solid #e9ecef;
              font-size: 1rem;
              transition: border-color 0.2s ease;
              margin: 0;
            }
            .input:focus {
              outline: none;
              border-color: #6E44FF;
            }
            .progress-container {
              width: 100%;
              height: 4px;
              background: #e9ecef;
              border-radius: 2px;
              overflow: hidden;
              margin-top: 0.5rem;
            }
            .sidebar-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 1.5rem;
              padding-bottom: 1rem;
              border-bottom: 1px solid #e9ecef;
            }
            .sidebar-title {
              margin: 0;
              background: linear-gradient(270deg, #6E44FF, #FF4D4D);
              background-size: 200% auto;
              color: transparent;
              -webkit-background-clip: text;
              background-clip: text;
              animation: gradient-animation 10s ease infinite;
              font-size: 1.5rem;
            }
            .chat-item {
              background: #fff;
              padding: 0.5rem;
              border-radius: 8px;
              margin-bottom: 1rem;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
              transition: all 0.2s ease;
              cursor: pointer;
            }
            .chat-item:hover {
              transform: translateY(-2px);
              box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            }
            .chat-item.active {
              background: #6E44FF;
              color: white;
            }
            .citation-item {
              background: #fff;
              padding: 1rem;
              border-radius: 8px;
              margin-bottom: 1rem;
              box-shadow: 0 2px 4px rgba(0,0,0,0.05);
            }
            .citation-title {
              color: #333;
              text-decoration: none;
              font-weight: bold;
              display: block;
              margin-bottom: 0.5rem;
            }
            .citation-title:hover {
              text-decoration: underline;
            }
            .citation-meta {
              color: #666;
              font-size: 0.9rem;
              margin-bottom: 0.5rem;
            }
            .delete-button {
              background: #dc3545;
              color: white;
              border: none;
              padding: 0.4rem 0.8rem;
              border-radius: 4px;
              cursor: pointer;
              transition: all 0.2s ease;
            }
            .delete-button:hover {
              background: #c82333;
            }
          `}
        </style>
      </Helmet>

      <div style={{ display: "flex", height: "100vh", background: "#fff" }}>
        {/* Chat History Sidebar */}
        <div className="sidebar" style={{ left: 0 }}>
          <div className="sidebar-header">
            <h1 className="sidebar-title">Chats</h1>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => {
                  setMessages([{
                    type: "bot",
                    text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis.",
                  }]);
                  setCurrentChatId(null);
                }}
                className="button"
                style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}
              >
                New Chat
              </button>
              {chatHistories.length > 0 && (
                <button
                  onClick={deleteAllChats}
                  className="delete-button"
                  style={{ fontSize: "0.8rem" }}
                >
                  Delete All
                </button>
              )}
            </div>
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {chatHistories.length > 0 ? (
              chatHistories.map((chat) => (
                <div
                  key={chat.id}
                  className={`chat-item ${currentChatId === chat.id ? 'active' : ''}`}
                  onClick={() => !editingChatId && loadChat(chat.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {editingChatId === chat.id ? (
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyPress={(e) => handleEditKeyPress(e, chat.id)}
                        onBlur={() => handleEditSave(chat.id)}
                        className="input"
                        autoFocus
                      />
                    ) : (
                      <p style={{ margin: 0, flex: 1 }}>
                        <b>{chat.title}</b>
                      </p>
                    )}
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        if (editingChatId === chat.id) {
                          handleEditSave(chat.id);
                        } else {
                          handleEditStart(chat);
                        }
                      }}
                      style={{
                        cursor: 'pointer',
                        fontSize: '1rem',
                        opacity: 0.7,
                        transition: 'opacity 0.2s'
                      }}
                      onMouseEnter={(e) => e.target.style.opacity = 1}
                      onMouseLeave={(e) => e.target.style.opacity = 0.7}
                    >
                      {editingChatId === chat.id ? '💾' : '✏️'}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.8rem", margin: "0.5rem 0" }}>
                    {new Date(chat.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChat(chat.id);
                    }}
                    className="delete-button"
                    style={{ fontSize: "0.8rem" }}
                  >
                    Delete
                  </button>
                </div>
              ))
            ) : (
              <p style={{ color: "#666", textAlign: "center" }}>No chat histories yet!</p>
            )}
          </div>
        </div>

        {/* Main content area */}
        <div className="main-content">
          <div className="chat-messages" ref={messagesEndRef}>
            {messages.map((message, index) => (
              <div
                key={index}
                className={`message ${message.type === "user" ? "user-message" : "bot-message"}`}
              >
                {message.text}
              </div>
            ))}
          </div>

          <div className="input-area">
            <div className="search-section">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter paper title, DOI, or ISBN..."
                className="input"
              />
              <button
                onClick={searchPaper}
                disabled={isLoading}
                className="button"
              >
                {isLoading ? "Searching..." : "Search"}
              </button>
            </div>

            {searchProgress > 0 && searchProgress < 100 && (
              <div className="progress-container">
                <div
                  className="progress-bar"
                  style={{ width: `${searchProgress}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Citations Sidebar */}
        <div className="sidebar" style={{ right: 0 }}>
          <div className="sidebar-header">
            <h1 className="sidebar-title">Citations</h1>
            {citations.length > 0 && (
              <button
                onClick={deleteAllCitations}
                className="delete-button"
                style={{ fontSize: "0.8rem" }}
              >
                Delete All
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", flex: 1 }}>
            {citations.length > 0 ? (
              citations.map((citation) => (
                <div key={citation.id} className="citation-item">
                  <a
                    href={citation.doi ? `https://doi.org/${citation.doi}` : `https://scholar.google.com/scholar?q=${encodeURIComponent(citation.title)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="citation-title"
                  >
                    {citation.title}
                  </a>
                  <p className="citation-meta">
                    {citation.authors && Array.isArray(citation.authors)
                      ? citation.authors.join(", ")
                      : "No authors available"}
                  </p>
                  <p className="citation-meta">Year: {citation.year}</p>
                  {citation.doi && (
                    <a
                      href={`https://doi.org/${citation.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#6E44FF", textDecoration: "none" }}
                    >
                      DOI
                    </a>
                  )}
                  <button
                    onClick={() => deleteCitation(citation.id)}
                    className="delete-button"
                    style={{ marginTop: "0.5rem" }}
                  >
                    Delete
                  </button>
                </div>
              ))
            ) : (
              <p style={{ color: "#666", textAlign: "center" }}>No citations saved yet!</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Chat;
