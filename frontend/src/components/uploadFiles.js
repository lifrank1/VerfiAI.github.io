import React, { useState } from "react";
import axios from "axios";

const UploadFiles = () => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadStatus("Please select a file first.");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await axios.post("/api/upload-document", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setUploadStatus(`Upload successful! Extracted text: ${response.data.extractedText.substring(0, 100)}...`);
    } catch (error) {
      setUploadStatus("Upload failed. Try again.");
      console.error("Upload error:", error);
    }
  };

  return (
    <div>
      <h2>Upload Document</h2>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>
      <p>{uploadStatus}</p>
    </div>
  );
};

export default UploadFiles;
