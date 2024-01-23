import React, { useState } from "react";
import axios from "axios";

function Uploader({ onUploadSuccess }) {
  const [file, setFile] = useState(null);

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      console.log("No file selected for upload");
      return;
    }

    console.log("Uploading file:", file);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        "http://localhost:3001/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const translate = await axios.post(
        "http://localhost:3001/translate",
        {
          urn: response.data.urn,
          rootFilename: file.name,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      onUploadSuccess(translate.data.urn);
    } catch (error) {
      console.error("Error during file upload:", error);
      alert("Error uploading file");
    }
  };

  return (
    <div>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleUpload}>Upload</button>
    </div>
  );
}

export default Uploader;
