import React from 'react';
import ReactDOMServer from 'react-dom/server';

// Serializes a message for storage in Firestore
export const serializeMessage = (message) => {
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

// Deserializes a message from Firestore
export const deserializeMessage = (message) => {
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