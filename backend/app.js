const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const qs = require("qs");
const axios = require("axios");
const fs = require("fs");

const app = express();
const port = 3001;
const bucketKey = "my_unique_bucket_key";

app.use(cors());
app.use(express.json());

// Configure multer for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

const upload = multer({ storage: storage });

// Function to get Forge token
async function getForgeToken() {
  const client_id = "zuAGt3mTR1c363JsxFoZDCA7YdjDk26E";
  const client_secret = "L9Ny3wauqmByzZ93";
  const grant_type = "client_credentials";
  const scope = "data:read data:write data:create bucket:create bucket:read";

  const data = qs.stringify({ client_id, client_secret, grant_type, scope });

  try {
    const response = await axios.post(
      "https://developer.api.autodesk.com/authentication/v1/authenticate",
      data,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return response.data.access_token;
  } catch (error) {
    console.error("Error getting Autodesk Forge token:", error);
    throw error;
  }
}
app.get("/create-bucket", async (req, res) => {
  const token = await getForgeToken();
  const data = {
    bucketKey: bucketKey,
    policyKey: "transient", // 'transient', 'temporary', or 'persistent'
  };

  try {
    await axios({
      method: "post",
      url: "https://developer.api.autodesk.com/oss/v2/buckets",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      data: data,
    });
    res.send("Bucket created successfully");
  } catch (error) {
    console.error("Error creating bucket:", error);
    res.status(500).send("Error creating bucket");
  }
});
app.post("/upload", upload.single("file"), async (req, res) => {
  if (req.file) {
    const token = await getForgeToken();
    const filePath = req.file.path;
    const fileName = req.file.filename;

    try {
      const fileData = fs.readFileSync(filePath);
      // Obtain signed URL
      const signedUrlResponse = await axios({
        method: "get",
        url: `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${fileName}/signeds3upload?minutesExpiration=10`,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      const signedUrl = signedUrlResponse.data.urls[0];

      // Create a read stream from the file
      const fileSize = fs.statSync(filePath).size; // Get the size of the file
      const fileStream = fs.createReadStream(filePath); // Create a read stream
      // Upload the file using the signed URL
      await axios.put(signedUrl, fileStream, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": fileSize,
        },
      });

      // Finalize the upload
      const uploadKey = signedUrlResponse.data.uploadKey; // Extract the upload key from the signed URL response
      const finalizeUploadResponse = await axios.post(
        `https://developer.api.autodesk.com/oss/v2/buckets/${bucketKey}/objects/${encodeURIComponent(
          fileName
        )}/signeds3upload`,
        {
          ossbucketKey: bucketKey,
          ossSourceFileObjectKey: fileName,
          access: "full",
          uploadKey: uploadKey,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );
      // Convert the objectId to a Base64-encoded URN
      const objectId = finalizeUploadResponse.data.objectId;
      const urn = Buffer.from(objectId).toString("base64").replace(/=/g, "");

      res.status(200).json({ urn });
    } catch (error) {
      console.error("Error uploading file to Forge OSS:", error);
      res.status(500).send("Error uploading file");
    }
  } else {
    res.status(400).send("No file uploaded.");
  }
});

app.get("/forge-token", async (req, res) => {
  try {
    const token = await getForgeToken();
    res.json({ access_token: token });
  } catch (error) {
    res.status(500).send("Error retrieving access token");
  }
});
app.post("/translate", async (req, res) => {
  const token = await getForgeToken();
  const urn = req.body.urn; // Base64-encoded URN of the uploaded file
  const rootFilename = req.body.rootFilename; // Root filename of your design (e.g., "Suspension.iam")

  try {
    const response = await axios.post(
      "https://developer.api.autodesk.com/modelderivative/v2/designdata/job",
      {
        input: {
          urn: urn,
          rootFilename: rootFilename,
          compressedUrn: true,
        },
        output: {
          formats: [
            {
              type: "svf2",
              views: ["2d", "3d"],
            },
          ],
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          "x-ads-force": true,
        },
      }
    );
    res.send(response.data);
  } catch (error) {
    console.error("Error starting translation job:", error);
    res.status(500).send("Error starting translation job");
  }
});
app.get("/translation-status/:urn", async (req, res) => {
  const token = await getForgeToken();
  const urn = req.params.urn; // URL safe Base64-encoded URN

  try {
    const response = await axios.get(
      `https://developer.api.autodesk.com/modelderivative/v2/designdata/${urn}/manifest`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
    res.send(response.data);
  } catch (error) {
    console.error("Error checking translation status:", error);
    res.status(500).send("Error checking translation status");
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
