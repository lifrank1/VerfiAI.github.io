import React, { createContext } from 'react';

// Create a context to share chat-related data across components
const ChatContext = createContext({
  activeChatId: null,
  saveReferenceToFirestore: async () => false,
  user: { userID: null }
});

export default ChatContext; 