import React, { useState } from "react";
import Uploader from "./components/uploader";
import Viewer from "./components/viewer";

function App() {
  const [modelUrn, setModelUrn] = useState(null);

  const handleUploadSuccess = (urn) => {
    console.log("URN:", urn);
    setModelUrn(urn);
  };

  return (
    <div>
      <Uploader onUploadSuccess={handleUploadSuccess} />
      <Viewer modelUrn={modelUrn} />
    </div>
  );
}

export default App;
