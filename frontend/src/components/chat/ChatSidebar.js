import React, { useState } from 'react';

const ChatSidebar = ({ 
  chatSessions, 
  activeChatId, 
  setActiveChatId, 
  setActiveChatTitle,
  createNewChatSession,
  deleteChatSession 
}) => {
  const [showNewChatInput, setShowNewChatInput] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');

  const handleCreateChat = () => {
    createNewChatSession(newChatTitle || "Untitled");
    setShowNewChatInput(false);
    setNewChatTitle('');
  };

  const handleCancelNewChat = () => {
    setShowNewChatInput(false);
    setNewChatTitle('');
  };

  return (
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
                  handleCreateChat();
                } else if (e.key === 'Escape') {
                  handleCancelNewChat();
                }
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={handleCreateChat}
                className="chat-action-button"
              >
                Create
              </button>
              <button 
                onClick={handleCancelNewChat}
                className="chat-action-button cancel"
              >
                Cancel
              </button>
            </div>
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
        {chatSessions.length > 0 ? (
          chatSessions.map((chat) => (
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
                aria-label="Delete chat"
              >
                ×
              </button>
            </div>
          ))
        ) : (
          <div style={{ padding: '20px', textAlign: 'center', color: '#666' }}>
            No chat sessions yet. Create a new chat to get started.
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar; 