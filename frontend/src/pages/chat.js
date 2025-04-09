import React, { useState, useRef, useEffect, useContext, useCallback } from "react";
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
  query,
  orderBy,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";
import axios from "axios";
import NavigationHeader from "../components/NavigationHeader";
import { useAuth } from "../contexts/authContext";
import "../styles/ReferenceVerification.css";
import "../styles/Chat.css";
import { Pie } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import ReactDOMServer from 'react-dom/server';

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

// Create a context to share active chat ID across components
const ChatContext = React.createContext({ activeChatId: null });

const serializeMessage = (message) => {
  if (!message) return message;
  
  // If message.text is a React element (JSX), convert it to a special format
  if (React.isValidElement(message.text)) {
    return {
      ...message,
      text: JSON.stringify({
        __isReactElement: true,
        jsx: ReactDOMServer.renderToString(message.text)
      })
    };
  }
  
  // For objects that aren't React elements but aren't strings either
  if (typeof message.text === 'object' && message.text !== null) {
    return {
      ...message,
      text: JSON.stringify({
        __isObject: true,
        data: message.text
      })
    };
  }
  
  return message;
};

const deserializeMessage = (message) => {
  if (!message || typeof message.text !== 'string') return message;
  
  try {
    // Check if it might be a serialized object
    if (message.text.startsWith('{') && message.text.endsWith('}')) {
      const parsed = JSON.parse(message.text);
      
      // Handle React elements
      if (parsed.__isReactElement) {
        return {
          ...message,
          text: <div dangerouslySetInnerHTML={{ __html: parsed.jsx }} />
        };
      }
      
      // Handle regular objects
      if (parsed.__isObject) {
        return {
          ...message,
          text: parsed.data
        };
      }
    }
  } catch (e) {
    // If parsing fails, just return the original message
    console.log("Failed to parse message text:", e);
  }
  
  return message;
};

const VerificationStatsButton = ({ references, user }) => {
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
  const { saveReferenceToFirestore } = useContext(ChatContext);

  // Start verification when component mounts
  useEffect(() => {
    if (references.length > 0) {
      console.log(`VerificationStatsButton: Starting verification for ${references.length} references, User logged in: ${user ? 'Yes' : 'No'}`);
      verifyAllReferences();
    }
  }, [references]);

  const verifyAllReferences = async () => {
    setVerificationStats(prev => ({ ...prev, loading: true }));
    console.log("Starting batch verification of all references");
    
    try {
      const results = await Promise.all(
        references.map(async (reference, index) => {
          try {
            console.log(`Verifying reference ${index + 1}/${references.length}`);
            const response = await axios.post('http://localhost:3002/api/verify-reference', {
              reference
            });
            console.log(`Reference ${index + 1} verification result:`, response.data.verification_status);
            return {
              reference,
              status: response.data.verification_status
            };
          } catch (error) {
            console.error(`Error verifying reference ${index + 1}:`, error);
            return {
              reference,
              status: 'failed'
            };
          }
        })
      );

      console.log("All references verification complete:", results);
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

      console.log("Verification stats calculated:", stats);
      setVerificationStats({ ...stats, loading: false });
    } catch (error) {
      console.error("Error in batch verification:", error);
      setVerificationStats(prev => ({ 
        ...prev, 
        loading: false,
        failed: true 
      }));
    }
  };

  // Save all verified references
  const saveAllVerifiedReferences = async () => {
    // Check if user is logged in
    if (!user || !user.userID) {
      alert("Please log in to save references");
      return 0;
    }

    const verifiedRefs = references.filter((ref) => {
      const result = verificationResults.find(vr => 
        vr.reference.title === ref.title && 
        vr.reference.doi === ref.doi
      );
      return result && result.status === 'verified';
    });
    
    if (verifiedRefs.length === 0) {
      alert("No verified references to save");
      return 0;
    }
    
    console.log("Saving all verified references. Count:", verifiedRefs.length);
    console.log("User ID:", user.userID);
    
    // Save all verified references to Firestore
    let savedCount = 0;
    try {
      for (const ref of verifiedRefs) {
        const citationData = {
          title: ref.title || ref.unstructured || "Untitled Reference",
          authors: ref.authors || [],
          year: ref.year || null,
          doi: ref.doi || null,
          research_field: { field: "Reference" },
          is_retracted: false
        };
        
        if (saveReferenceToFirestore && user && user.userID) {
          await saveReferenceToFirestore(citationData, user.userID);
          savedCount++;
        }
      }
      
      // Show success message
      alert(`Successfully saved ${savedCount} citations!`);
      
      // Close the stats window after saving
      setIsOpen(false);
      
      return savedCount;
    } catch (error) {
      console.error("Error saving references:", error);
      alert(`Saved ${savedCount} references before encountering an error. Please try again.`);
      return savedCount;
    }
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
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }}>
      <button
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => !isOpen && setIsHovered(false)}
        onClick={() => setIsOpen(!isOpen)}
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
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 1000,
          width: '200px',
          textAlign: 'center'
        }}>
          <p>View References Status</p>
          <p>{verificationStats.verified} Verified, {verificationStats.notVerified + verificationStats.unverifiable} Unverified</p>
        </div>
      )}

      {/* Full view when clicked */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          zIndex: 1000,
          width: '500px',
          maxWidth: '90vw'
        }}>
          <button 
            onClick={() => setIsOpen(false)} 
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'none',
              border: 'none',
              fontSize: '1.2rem',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>

          <h3 style={{ textAlign: 'center', marginBottom: '1.5rem' }}>References Verification</h3>

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

                {/* Save All Verified References button */}
                {verificationStats.verified > 0 && (
                  <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <button
                      onClick={saveAllVerifiedReferences}
                      style={{
                        background: '#28a745',
                        color: 'white',
                        border: 'none',
                        padding: '0.5rem 1rem',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      Save All Verified References
                    </button>
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

const ReferenceItem = ({ reference, index, userID }) => {
  const [verificationStatus, setVerificationStatus] = useState("pending"); // Always start at pending
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

  // Start verification on component mount with no conditions
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

const Chat = () => {
  // Chat session state
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [showNewChatInput, setShowNewChatInput] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');
  
  // Add missing state variables for title editing
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [activeChatTitle, setActiveChatTitle] = useState('New Chat');
  
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
  
  // Log user state for debugging
  useEffect(() => {
    console.log("User auth state:", user);
    console.log("Active chat ID:", activeChatId);
  }, [user, activeChatId]);

  // Auto-create a new chat when user is logged in but has no active chat
  useEffect(() => {
    const createInitialChat = async () => {
      if (user && user.userID && chatSessions.length === 0 && !activeChatId) {
        try {
          console.log("Trying to create initial chat");
          const db = getFirestore(firebaseApp);
          const userRef = doc(db, "users", user.userID);
          const chatSessionsRef = collection(userRef, "chatSessions");
          
          // Check if user already has chat sessions
          const snapshot = await getDocs(chatSessionsRef);
          if (snapshot.empty) {
            console.log("No existing chats found, creating first chat");
            // Create a new "Untitled" chat session
            const newChatRef = await addDoc(chatSessionsRef, {
              title: "Untitled",
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              userID: user.userID
            });
            
            // Create initial message
            const messagesRef = collection(userRef, "chatSessions", newChatRef.id, "messages");
            await addDoc(messagesRef, {
              type: "bot",
              text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis.",
              timestamp: serverTimestamp()
            });
            
            console.log("Setting active chat to newly created:", newChatRef.id);
            setActiveChatId(newChatRef.id);
          } else {
            console.log("Found existing chats:", snapshot.size);
          }
        } catch (error) {
          console.error("Error creating initial chat session:", error);
        }
      }
    };
    
    createInitialChat();
  }, [user, user?.userID, chatSessions.length, activeChatId]);

  // Load chat sessions when user is authenticated
  useEffect(() => {
    if (!user || !user.userID) return;

    const db = getFirestore(firebaseApp);
    const userRef = doc(db, "users", user.userID);
    const chatSessionsRef = collection(userRef, "chatSessions");
    const chatSessionsQuery = query(chatSessionsRef, orderBy("updatedAt", "desc"));

    const unsubscribe = onSnapshot(chatSessionsQuery, (snapshot) => {
      const sessionsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log("Loaded chat sessions:", sessionsData.length);
      setChatSessions(sessionsData);
      
      // If no active chat but we have sessions, select the first one
      if (!activeChatId && sessionsData.length > 0) {
        console.log("Selecting first chat session:", sessionsData[0].id);
        setActiveChatId(sessionsData[0].id);
        setActiveChatTitle(sessionsData[0].title || "Untitled Chat");
      }
    });

    return () => unsubscribe();
  }, [user, user?.userID, activeChatId]);

  // Load messages when active chat changes
  useEffect(() => {
    if (user && user.userID && activeChatId) {
      // Update the active chat title
      const activeChat = chatSessions.find(chat => chat.id === activeChatId);
      if (activeChat) {
        setActiveChatTitle(activeChat.title || "Untitled Chat");
      }
      
      loadChatMessages();
      loadChatCitations();
    }
  }, [user, user?.userID, activeChatId, chatSessions]);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Load messages for the active chat session
  const loadChatMessages = async () => {
    if (!user || !user.userID || !activeChatId) {
      console.log("Cannot load messages - missing user or active chat");
      return;
    }

    try {
      console.log("Loading messages for chat:", activeChatId);
      const db = getFirestore(firebaseApp);
      const messagesRef = collection(db, "users", user.userID, "chatSessions", activeChatId, "messages");
      const messagesQuery = query(messagesRef, orderBy("timestamp", "asc"));
      
      const snapshot = await getDocs(messagesQuery);
      
      if (snapshot.empty) {
        console.log("No messages found, setting default welcome message");
        setMessages([{
          type: "bot",
          text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis."
        }]);
        return;
      }
      
      const loadedMessages = snapshot.docs.map(doc => {
        const data = doc.data();
        return deserializeMessage({
          id: doc.id,
          type: data.type,
          text: data.text,
          timestamp: data.timestamp
        });
      });
      
      console.log(`Loaded ${loadedMessages.length} messages for chat ${activeChatId}`);
      setMessages(loadedMessages);
    } catch (error) {
      console.error("Error loading chat messages:", error);
    }
  };

  // Load citations for the active chat
  const loadChatCitations = async () => {
    if (!user || !user.userID || !activeChatId) return;

    try {
      const db = getFirestore(firebaseApp);
      const citationsRef = collection(db, "users", user.userID, "chatSessions", activeChatId, "citations");
      const citationsQuery = query(citationsRef, orderBy("timestamp", "desc"));
      
      const snapshot = await getDocs(citationsQuery);
      const citationsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`Loaded ${citationsData.length} citations for chat ${activeChatId}`);
      setCitations(citationsData);
    } catch (error) {
      console.error("Error loading chat citations:", error);
    }
  };

  // Functions for chat title editing
  const handleEditTitleClick = () => {
    const activeChat = chatSessions.find(chat => chat.id === activeChatId);
    if (activeChat) {
      setEditTitle(activeChat.title || 'Untitled');
      setActiveChatTitle(activeChat.title || 'Untitled');
    }
    setIsEditingTitle(true);
  };

  const handleTitleUpdate = () => {
    if (editTitle.trim() !== '') {
      if (activeChatId) {
        renameChatSession(activeChatId, editTitle.trim());
        setActiveChatTitle(editTitle.trim());
      }
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleTitleUpdate();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  // Create a new chat session
  const createNewChatSession = async (title = "Untitled", isAuto = false) => {
    if (!user || !user.userID) {
      if (!isAuto) alert("Please log in to save chat sessions.");
      return null;
    }

    try {
      console.log("Creating new chat session with title:", title);
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", user.userID);
      const chatSessionsRef = collection(userRef, "chatSessions");
      
      const newChatRef = await addDoc(chatSessionsRef, {
        title: title,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userID: user.userID
      });
      
      // Create initial message
      const messagesRef = collection(userRef, "chatSessions", newChatRef.id, "messages");
      await addDoc(messagesRef, {
        type: "bot",
        text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis.",
        timestamp: serverTimestamp()
      });
      
      // Only set the active chat ID if we're creating manually or don't have one already
      if (!isAuto || !activeChatId) {
        console.log("Setting active chat to newly created:", newChatRef.id);
        setActiveChatId(newChatRef.id);
      }
      
      // Clear input field and hide new chat input if showing
      if (!isAuto) {
        setNewChatTitle('');
        setShowNewChatInput(false);
      }
      
      return newChatRef.id;
    } catch (error) {
      console.error("Error creating new chat session:", error);
      if (!isAuto) alert("Error creating chat session. Please try again.");
      return null;
    }
  };

  // Delete a chat session
  const deleteChatSession = async (chatId) => {
    if (!user || !user.userID) return;

    if (window.confirm("Are you sure you want to delete this chat?")) {
      try {
        const db = getFirestore(firebaseApp);
        const chatRef = doc(db, "users", user.userID, "chatSessions", chatId);
        
        // Delete the chat document
        await deleteDoc(chatRef);
        
        // If the deleted chat was active, select another chat
        if (chatId === activeChatId) {
          // Find the next available chat
          const nextChat = chatSessions.find(chat => chat.id !== chatId);
          if (nextChat) {
            setActiveChatId(nextChat.id);
          } else {
            setActiveChatId(null);
            // Reset messages to default
            setMessages([{
              type: "bot",
              text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis."
            }]);
          }
        }
      } catch (error) {
        console.error("Error deleting chat session:", error);
        alert("Error deleting chat. Please try again.");
      }
    }
  };

  // Save messages to Firestore for the active chat
  const saveMessageToFirestore = async (message) => {
    if (!user || !user.userID) {
      console.log("User not logged in, not saving message");
      return;
    }
    
    let chatId = activeChatId;
    
    // If no active chat exists, create a new one
    if (!chatId) {
      console.log("No active chat, creating new chat before saving message");
      chatId = await createNewChatSession("Untitled", true);
      if (!chatId) {
        console.error("Failed to create new chat session");
        return;
      }
    }
    
    try {
      console.log(`Saving message to chat ${chatId}:`, message.type);
      const db = getFirestore(firebaseApp);
      const messagesRef = collection(db, "users", user.userID, "chatSessions", chatId, "messages");

      // Serialize the message properly before saving
      const serializedMessage = serializeMessage({
        ...message,
        timestamp: serverTimestamp()
      });
      
      await addDoc(messagesRef, serializedMessage);
      
      // Update the chat session's updatedAt timestamp
      const chatRef = doc(db, "users", user.userID, "chatSessions", chatId);
      await updateDoc(chatRef, {
        updatedAt: serverTimestamp()
      });
      
      console.log("Message saved successfully");
    } catch (error) {
      console.error("Error saving message to Firestore:", error);
    }
  };

  // Rename a chat session
  const renameChatSession = async (chatId, newTitle) => {
    if (!user || !user.userID) return;

    try {
      const db = getFirestore(firebaseApp);
      const chatRef = doc(db, "users", user.userID, "chatSessions", chatId);
      
      await updateDoc(chatRef, {
        title: newTitle,
        updatedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error renaming chat session:", error);
      alert("Error renaming chat. Please try again.");
    }
  };

  // Function to handle paper search
  const searchPaper = async (e) => {
    e.preventDefault();
    if (!input) return;

    // Check if we have an active chat session
    if (user && user.userID && !activeChatId) {
      const newChatId = await createNewChatSession(input, true);
      if (!newChatId) return;
    }

    // Add user's message to UI immediately
    const userMessage = {
      type: "user",
      text: input,
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    // Save user message to Firestore
    await saveMessageToFirestore(userMessage);
    
    setIsLoading(true);
    setInput("");

    try {
      console.log("📌 Sending API request to analyze paper with input:", input);
      const response = await axios.post("http://localhost:3002/api/analyze-paper", {
        doi: input,  // Changed from 'identifier' to 'doi' to match server expectation
      });

      console.log("📌 API response received:", response);
      const { data } = response;
      console.log("📌 API response data:", data);
      
      // Check if the data is inside a 'paper' object (from successful response)
      // or directly at the top level (from error response)
      const paperData = data.paper || data;
      
      // Format the bot response as rich content
      const botMessage = {
        type: "bot",
        text: (
          <div className="bot-response">
            <h3>Paper Information</h3>
            {data.success === false ? (
              <p className="error-message">❌ {data.error || "Could not find paper information"}</p>
            ) : (
              <>
                <p>
                  <strong>Title:</strong> {paperData.title || "Not available"}
                </p>
                <p>
                  <strong>DOI:</strong> {paperData.doi || "Not available"}
                </p>
                <p>
                  <strong>Publication Year:</strong> {paperData.year || "Not available"}
                </p>
                <p>
                  <strong>Authors:</strong>{" "}
                  {paperData.authors && paperData.authors.length > 0 
                    ? paperData.authors.join(", ") 
                    : "Not available"}
                </p>

                {paperData.is_retracted && (
                  <div className="retraction-notice">
                    <p>
                      <strong>⚠️ Retraction Notice:</strong> This paper has been retracted.
                    </p>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <h3>References</h3>
                  {paperData.references && paperData.references.length > 0 && (
                    <VerificationStatsButton 
                      references={paperData.references} 
                      user={user} 
                    />
                  )}
                </div>
                
                {paperData.references && paperData.references.length > 0 ? (
                  <ul className="references-list">
                    {paperData.references.map((ref, index) => (
                      <ReferenceItem
                        key={index}
                        reference={ref}
                        index={index}
                        userID={user?.userID}
                      />
                    ))}
                  </ul>
                ) : (
                  <p>No references available for this paper.</p>
                )}
              </>
            )}
          </div>
        ),
      };
      
      // Save the formatted bot response to Firestore
      await saveMessageToFirestore(botMessage);
      
      // Update UI with the bot response
      setMessages([...updatedMessages, botMessage]);
    } catch (error) {
      console.error("❌ Error analyzing paper:", error);
      console.error("❌ Error response:", error.response?.data);
      
      // Create error message
      const errorMessage = {
        type: "bot",
        text: `Error analyzing paper: ${error.response?.data?.error || error.message || "Unknown error"}. Please try again with a different identifier.`
      };
      
      // Save error message to Firestore
      await saveMessageToFirestore(errorMessage);
      
      // Update UI with error message
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to handle file uploads
  const uploadDocument = async () => {
    if (!uploadedFile) {
      alert("Please select a file to upload first.");
      return;
    }

    // Create new chat session if there's no active one
    if (user && user.userID && !activeChatId) {
      const newChatId = await createNewChatSession("Untitled", true);
      if (!newChatId) return;
    }

    // Add user's message to UI immediately
    const userMessage = {
      type: "user",
      text: `Uploading document: ${uploadedFile.name}`,
    };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    
    // Save user message to Firestore
    await saveMessageToFirestore(userMessage);

    setIsLoading(true);

    const formData = new FormData();
    formData.append("file", uploadedFile);

    try {
      const response = await axios.post(
        "http://localhost:3002/api/upload-document",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total
            );
            setUploadProgress(percentCompleted);
          },
        }
      );

      const { data } = response;
      
      // Format the bot response as rich content
      const botMessage = {
        type: "bot",
        text: (
          <div className="bot-response">
            <h3>Document Analysis</h3>
            <p>
              <strong>Title:</strong> {data.title || "Not detected"}
            </p>
            <p>
              <strong>Extracted DOI:</strong> {data.doi || "Not detected"}
            </p>
            <p>
              <strong>Authors:</strong>{" "}
              {data.authors ? data.authors.join(", ") : "Not detected"}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h3>References</h3>
              {data.references && data.references.length > 0 && (
                <VerificationStatsButton 
                  references={data.references} 
                  user={user} 
                />
              )}
            </div>
            
            {data.references && data.references.length > 0 ? (
              <ul className="references-list">
                {data.references.map((ref, index) => (
                  <ReferenceItem
                    key={index}
                    reference={ref}
                    index={index}
                    userID={user?.userID}
                  />
                ))}
              </ul>
            ) : (
              <p>No references were detected in this document.</p>
            )}
          </div>
        ),
      };
      
      // Save the formatted bot response to Firestore
      await saveMessageToFirestore(botMessage);
      
      // Update UI with the bot response
      setMessages([...updatedMessages, botMessage]);
      
      // Reset file and progress
      setUploadedFile(null);
      setUploadProgress(0);
    } catch (error) {
      console.error("Error uploading document:", error);
      
      // Create error message
      const errorMessage = {
        type: "bot",
        text: `Error analyzing document: ${error.response?.data?.error || error.message || "Unknown error"}. Please try a different file or format.`
      };
      
      // Save error message to Firestore
      await saveMessageToFirestore(errorMessage);
      
      // Update UI with error message
      setMessages([...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
      setUploadProgress(0);
    }
  };

  // Input handlers
  const handleInputChange = (e) => {
    setInput(e.target.value);
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleFileButtonClick = () => {
    fileInputRef.current.click();
  };
  
  // Reusable function for saving references to Firestore
  const saveReferenceToFirestore = useCallback(async (citationData, userId) => {
    if (!userId) {
      console.error("No user ID provided when trying to save reference");
      alert("Please log in to save citations");
      return false;
    }
    
    // Use current activeChatId or create a new chat if none exists
    let chatId = activeChatId;
    if (!chatId) {
      const newChatId = await createNewChatSession("Untitled", true);
      if (!newChatId) {
        alert("Could not create a chat session to save the citation");
        return false;
      }
      chatId = newChatId;
    }
    
    try {
      console.log(`Saving reference to Firestore. User ID: ${userId}, Chat ID: ${chatId}`);
      const db = getFirestore(firebaseApp);
      const userRef = doc(db, "users", userId);
      const citationsRef = collection(userRef, "chatSessions", chatId, "citations");

      await addDoc(citationsRef, {
        ...citationData,
        timestamp: new Date(),
        userID: userId
      });
      
      // Refresh citations after saving
      loadChatCitations();
      
      return true;
    } catch (error) {
      console.error("Error saving reference:", error);
      return false;
    }
  }, [activeChatId]);
  
  // UI for the three-panel layout
  return (
    <ChatContext.Provider value={{ 
      activeChatId, 
      saveReferenceToFirestore,
      user: user || { userID: null } // Ensure user is never null
    }}>
      <div className="chat-container">
        <Helmet>
          <title>VerifAI - Chat</title>
        </Helmet>
        
        <NavigationHeader user={user} />
        
        {/* Debug info - remove after fixing */}
        {process.env.NODE_ENV === 'development' && (
          <div style={{ 
            position: 'fixed', 
            top: '60px', 
            right: '10px', 
            zIndex: 1000, 
            background: 'rgba(0,0,0,0.7)', 
            color: 'lime', 
            padding: '10px', 
            borderRadius: '5px',
            maxWidth: '300px',
            fontSize: '12px'
          }}>
            <div>User: {user && user.userID ? `Logged in (${user.userID.substring(0,8)}...)` : 'Not logged in'}</div>
            <div>Active Chat: {activeChatId ? activeChatId.substring(0,8) + '...' : 'None'}</div>
            <div>Chat Sessions: {chatSessions.length}</div>
          </div>
        )}
        
        <div className="chat-interface">
          <div className="sidebar">
            <div className="new-chat-section">
              {showNewChatInput ? (
                <div className="new-chat-input-container">
                  <input
                    type="text"
                    placeholder="Enter chat title..."
                    value={newChatTitle}
                    onChange={(e) => setNewChatTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        createNewChatSession(newChatTitle || "Untitled");
                      } else if (e.key === 'Escape') {
                        setShowNewChatInput(false);
                        setNewChatTitle('');
                      }
                    }}
                    autoFocus
                  />
                  <button 
                    onClick={() => createNewChatSession(newChatTitle || "Untitled")}
                    className="chat-action-button"
                  >
                    Create
                  </button>
                  <button 
                    onClick={() => {
                      setShowNewChatInput(false);
                      setNewChatTitle('');
                    }}
                    className="chat-action-button cancel"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowNewChatInput(true)}
                  className="new-chat-button"
                >
                  <span>+</span> New Chat
                </button>
              )}
            </div>
            
            <div className="chat-sessions-list">
              {chatSessions.map((chat) => (
                <div 
                  key={chat.id} 
                  className={`chat-session-item ${chat.id === activeChatId ? 'active' : ''}`}
                  onClick={() => {
                    setActiveChatId(chat.id);
                    setActiveChatTitle(chat.title || "Untitled Chat");
                  }}
                >
                  <div className="chat-session-title">
                    {chat.title || "Untitled Chat"}
                  </div>
                  <button 
                    className="delete-chat-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteChatSession(chat.id);
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="chat-main">
            <div className="chat-header">
              {isEditingTitle ? (
                <div className="edit-title-container">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={handleTitleUpdate}
                    onKeyDown={handleTitleKeyDown}
                    autoFocus
                    className="edit-title-input"
                  />
                </div>
              ) : (
                <div className="chat-title" onClick={handleEditTitleClick}>
                  {activeChatTitle || "New Chat"}
                  <span className="edit-icon">✎</span>
                </div>
              )}
            </div>
            
            <div className="messages-container">
              {messages.map((message, index) => (
                <div key={index} className={`message ${message.type}`}>
                  <div className="message-content">{message.text}</div>
                </div>
              ))}
              <div ref={messagesEndRef} />
              
              {isLoading && (
                <div className="message bot">
                  <div className="message-content">
                    <div className="loading-indicator">
                      <div className="dot"></div>
                      <div className="dot"></div>
                      <div className="dot"></div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="chat-controls">
              <form onSubmit={searchPaper} className="input-form">
                <input
                  type="text"
                  value={input}
                  onChange={handleInputChange}
                  placeholder="Enter DOI, ArXiv ID, or paper title..."
                  className="chat-input"
                  disabled={isLoading}
                />
                
                <button
                  type="submit"
                  className="send-button"
                  disabled={isLoading || !input.trim()}
                >
                  Search
                </button>
                
                <div className="upload-container">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    accept=".pdf,.docx,.doc,.txt"
                  />
                  
                  <button
                    type="button"
                    onClick={handleFileButtonClick}
                    className="upload-button"
                    disabled={isLoading}
                  >
                    📁
                  </button>
                  
                  {uploadedFile && (
                    <div className="upload-info">
                      <span className="filename">{uploadedFile.name}</span>
                      <button
                        type="button"
                        onClick={uploadDocument}
                        className="upload-submit"
                        disabled={isLoading}
                      >
                        Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => setUploadedFile(null)}
                        className="upload-cancel"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </form>
              
              {uploadProgress > 0 && uploadProgress < 100 && (
                <div className="upload-progress">
                  <div
                    className="progress-bar"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              )}
            </div>
          </div>
          
          <div className="citations-panel">
            <h3>Your Saved Citations</h3>
            {citations.length > 0 ? (
              <ul className="citations-list">
                {citations.map((citation, index) => (
                  <li key={citation.id} className="citation-item">
                    <div className="citation-title">{citation.title}</div>
                    {citation.authors && (
                      <div className="citation-authors">
                        {Array.isArray(citation.authors)
                          ? citation.authors.join(", ")
                          : citation.authors}
                      </div>
                    )}
                    {citation.year && (
                      <div className="citation-year">{citation.year}</div>
                    )}
                    {citation.doi && (
                      <div className="citation-doi">
                        <a
                          href={`https://doi.org/${citation.doi}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {citation.doi}
                        </a>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-citations">
                No citations saved yet. Verify references and click "Save" to add them here.
              </p>
            )}
          </div>
        </div>
      </div>
    </ChatContext.Provider>
  );
};

export default Chat;
