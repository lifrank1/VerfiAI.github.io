import React, { useState, useRef } from 'react';

const ChatInput = ({ 
  input, 
  setInput, 
  isLoading, 
  searchPaper, 
  uploadedFile,
  setUploadedFile,
  uploadDocument,
  uploadProgress
}) => {
  const fileInputRef = useRef(null);

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

  return (
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
  );
};

export default ChatInput; 