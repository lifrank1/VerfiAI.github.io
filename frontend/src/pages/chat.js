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
      text: "Hello! I'm VerifAI. How can I assist you today?",
    },
  ]);
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

  const sendMessage = async () => {
    if (input.trim() === "") return;

    const newUserMessage = { type: "user", text: input };
    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");

    try {
      // Show loading message
      const loadingMessage = { type: "bot", text: "..." };
      setMessages((prev) => [...prev, loadingMessage]);

      // Make API call to Deepseek
      const response = await axios.post(
        "https://api.deepseek.com/v1/chat/completions",
        {
          model: "deepseek-chat",
          messages: [{ role: "user", content: input }],
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.REACT_APP_DEEPSEEK_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      // Remove loading message and add AI response
      setMessages((prev) => prev.slice(0, -1)); // Remove loading message
      const aiResponse = {
        type: "bot",
        text: response.data.choices[0].message.content,
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      console.error("Error calling Deepseek API:", error);
      // Remove loading message and show error
      setMessages((prev) => prev.slice(0, -1));
      const errorMessage = {
        type: "bot",
        text: "Sorry, I encountered an error. Please try again.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <Helmet>
        <title>Chat - VerifAI</title>
        <meta name="description" content="Chat with VerifAI" />
        <style>
          {`
            body {
              margin: 0;
              padding: 0;
              background-color: #E6E6FA;
              height: 100vh;
              font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            }
          `}
        </style>
      </Helmet>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          maxWidth: "1000px",
          margin: "0 auto",
          background: "white",
          boxShadow: "0 0 10px rgba(0,0,0,0.1)",
        }}
      >
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
        </div>

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
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message here..."
              style={{
                flex: 1,
                padding: "0.75rem",
                borderRadius: "8px",
                border: "1px solid #e5e5e5",
                resize: "none",
                minHeight: "20px",
                maxHeight: "200px",
                fontFamily: "inherit",
                fontSize: "1rem",
                outline: "none",
                ":focus": {
                  borderColor: "#6E44FF",
                },
              }}
              rows={1}
            />
            <button
              onClick={sendMessage}
              style={{
                background: "#FF4D4D",
                color: "white",
                border: "none",
                padding: "0.75rem 1.5rem",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "1rem",
                transition: "background-color 0.3s ease",
                ":hover": {
                  backgroundColor: "#FF1A1A",
                },
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Chat;
