import React, { useState, useRef, useEffect, useCallback } from "react";
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
import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

// Import custom components
import ChatContext from "../components/chat/ChatContext";
import { serializeMessage, deserializeMessage } from "../components/chat/MessageSerialization";
import ReferenceItem from "../components/references/ReferenceItem";
import VerificationStatsButton from "../components/references/VerificationStatsButton";
import ChatSidebar from "../components/chat/ChatSidebar";
import ChatMessages from "../components/chat/ChatMessages";
import ChatInput from "../components/chat/ChatInput";
import ChatHeader from "../components/chat/ChatHeader";
import CitationsPanel from "../components/chat/CitationsPanel";

// Register ChartJS components
ChartJS.register(ArcElement, Tooltip, Legend);

const Chat = () => {
  // Chat session state
  const [chatSessions, setChatSessions] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
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

  // Refs for UI interaction
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
            // If there are existing chats but no active chat ID, select the first one
            if (!activeChatId) {
              const firstChat = snapshot.docs[0];
              console.log("Setting active chat to first existing:", firstChat.id);
              setActiveChatId(firstChat.id);
            }
          }
        } catch (error) {
          console.error("Error creating initial chat session:", error);
        }
      }
    };
    
    // Wait a short time after initial render to avoid disrupting other components
    const timer = setTimeout(() => {
      createInitialChat();
    }, 500);
    
    return () => clearTimeout(timer);
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
      
      setActiveChatTitle(newTitle);
    } catch (error) {
      console.error("Error renaming chat session:", error);
      alert("Error renaming chat. Please try again.");
    }
  };

  // Function to handle paper search
  const searchPaper = async (e) => {
    e.preventDefault();
    if (!input) return;

    // Check if user wants to clear chat
    if (input.trim().toLowerCase() === "clear") {
      setMessages([
        {
          type: "bot",
          text: "Hello! Enter a paper title, DOI, or ISBN to get started. You can also upload a document for analysis.",
        },
      ]);
      setInput("");
      return;
    }
    
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

  // File upload functions from main
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      setUploadedFile(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
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
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
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

  // Function to handle key press (Enter to search)
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      searchPaper(e);
    }
  };

  // UI for the three-panel layout
  return (
    <ChatContext.Provider value={{ 
      activeChatId: activeChatId || null, // Ensure this is never undefined
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
            top: '70px', /* Adjust to be below navbar */
            right: '10px', 
            zIndex: 999, /* High but below navbar */
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
          {/* Chat Sidebar */}
          <ChatSidebar 
            chatSessions={chatSessions}
            activeChatId={activeChatId}
            setActiveChatId={setActiveChatId}
            setActiveChatTitle={setActiveChatTitle}
            createNewChatSession={createNewChatSession}
            deleteChatSession={deleteChatSession}
          />
          
          <div className="chat-main">
            {/* Chat Header */}
            <ChatHeader 
              activeChatTitle={activeChatTitle}
              renameChatSession={renameChatSession}
              activeChatId={activeChatId}
            />
            
            {/* Chat Messages */}
            <ChatMessages 
              messages={messages}
              isLoading={isLoading}
              messagesEndRef={messagesEndRef}
            />
            
            {/* Chat Input */}
            <ChatInput 
              input={input}
              setInput={setInput}
              isLoading={isLoading}
              searchPaper={searchPaper}
              uploadedFile={uploadedFile}
              setUploadedFile={setUploadedFile}
              uploadDocument={uploadDocument}
              uploadProgress={uploadProgress}
              handleKeyPress={handleKeyPress}
              triggerFileInput={triggerFileInput}
              fileInputRef={fileInputRef}
              handleFileChange={handleFileChange}
            />
          </div>
          
          {/* Citations Panel */}
          <CitationsPanel citations={citations} />
        </div>
      </div>
    </ChatContext.Provider>
  );
};

export default Chat;
