import React, { useState } from 'react';

const ChatHeader = ({ activeChatTitle, renameChatSession, activeChatId }) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState(activeChatTitle || 'Untitled');

  const handleEditTitleClick = () => {
    setEditTitle(activeChatTitle || 'Untitled');
    setIsEditingTitle(true);
  };

  const handleTitleUpdate = () => {
    if (editTitle.trim() !== '') {
      if (activeChatId) {
        renameChatSession(activeChatId, editTitle.trim());
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

  return (
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
  );
};

export default ChatHeader; 