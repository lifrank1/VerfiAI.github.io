import React, { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet";
import { useNavigate } from "react-router-dom";
import { getAuth, signOut } from "firebase/auth";
import { firebaseApp } from "../firebase-config";
import axios from "axios";

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
      setMessages([
        { type: "bot", text: "Hello! Enter a paper title, DOI, or ISBN to get started." }
      ]);
      setInput("");
      return;
    }
  
    setMessages(prev => [...prev, { type: "user", text: input }]);
    setIsLoading(true);
  
    try {
      const response = await axios.post("http://localhost:3002/api/analyze-paper", {
        doi: input
      });
  
      const { is_retracted, retraction_info, title, authors, research_field, year, doi } = response.data.paper;
  
      let retractionNotice;
      if (is_retracted) {
        retractionNotice = (
          <div>
            <p style={{ color: "red", fontWeight: "bold" }}>🚨 This paper may be retracted!</p>
            <ul style={{ paddingLeft: "2rem" }}>
              {retraction_info.map((item, idx) => (
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
  
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      searchPaper();
      setInput("");  // This will clear the input field
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
            }}
          >
            VerifAI Chat
          </h1>
          <button
            onClick={handleLogout}
            style={{
              background: "transparent",
              border: "2px solid #FF4D4D",
              color: "#FF4D4D",
              padding: "0.5rem 1rem",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.9rem",
              transition: "all 0.3s ease",
              fontWeight: "500",
              ":hover": {
                background: "#FF4D4D",
                color: "white",
              },
            }}
          >
            Logout
          </button>
        </div>
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

        <div style={{
          padding: "1rem",
          borderTop: "1px solid #e5e5e5",
          background: "white",
        }}>
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
    </>
  );
};

export default Chat;