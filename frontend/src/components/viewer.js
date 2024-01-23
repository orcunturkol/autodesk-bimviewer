/* global Autodesk */
import React, { useEffect, useRef } from "react";
import axios from "axios";

function Viewer({ modelUrn }) {
  const viewerDiv = useRef(null);
  let viewer = useRef(null);

  useEffect(() => {
    async function fetchTokenAndInitializeViewer() {
      try {
        const tokenResponse = await axios.get(
          "http://localhost:3001/forge-token"
        );
        const accessToken = tokenResponse.data.access_token;
        initializeViewer(accessToken);
      } catch (error) {
        console.error("Error fetching access token:", error);
      }
    }

    if (modelUrn) {
      fetchTokenAndInitializeViewer();
    }

    return () => {
      if (viewer.current) {
        viewer.current.finish();
        viewer.current = null;
      }
    };
  }, [modelUrn]);

  const initializeViewer = (token) => {
    if (window.Autodesk && window.Autodesk.Viewing) {
      const options = {
        env: "AutodeskProduction",
        accessToken: token,
        api: "derivativeV2",
      };

      window.Autodesk.Viewing.Initializer(options, () => {
        viewer.current = new window.Autodesk.Viewing.Private.GuiViewer3D(
          viewerDiv.current
        );
        viewer.current.start();

        const documentId = `urn:${modelUrn}`;
        window.Autodesk.Viewing.Document.load(
          documentId,
          onDocumentLoadSuccess,
          onDocumentLoadFailure
        );
      });
    }
  };

  const onDocumentLoadSuccess = (doc) => {
    const viewables = Autodesk.Viewing.Document.getSubItemsWithProperties(
      doc.getRoot(),
      { type: "geometry" },
      true
    );
    if (viewables.length === 0) {
      console.error("Document contains no viewables.");
      return;
    }

    viewer.current.loadDocumentNode(doc, viewables[0]);
  };

  const onDocumentLoadFailure = (error) => {
    console.error("Failed to load document:", error);
  };

  return <div ref={viewerDiv} style={{ width: "100%", height: "100vh" }} />;
}

export default Viewer;
