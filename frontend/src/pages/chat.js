import React, { useState, useRef, useEffect } from "react";
import { Helmet } from "react-helmet";

const Chat = () => {
  const [messages, setMessages] = useState([
    {
      type: "bot",
      text: "Hello! This is a dummy chat output. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = () => {
    if (input.trim() === "") return;
    const newUserMessage = { type: "user", text: input };
    setMessages((prev) => [...prev, newUserMessage]);
    setInput("");
    // Insert a dummy bot reply after a short delay
    setTimeout(() => {
      const newBotMessage = { type: "bot", text: "This is a dummy response." };
      setMessages((prev) => [...prev, newBotMessage]);
    }, 500);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  return (
    <>
      <Helmet>
        <title>Chat - VerifAI</title>
        <meta name="description" content="Chat with VerifAI" />
      </Helmet>
      <div className="chat-container">
        <div className="chat-header">Chat Interface</div>
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
        <div className="chat-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message here..."
          />
          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </>
  );
};

export default Chat;
