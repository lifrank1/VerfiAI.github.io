import React, { useRef, useEffect } from 'react';

const ChatMessages = ({ messages, isLoading }) => {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
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
  );
};

export default ChatMessages; 