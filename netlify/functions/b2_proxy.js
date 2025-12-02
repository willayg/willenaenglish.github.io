// netlify/functions/b2_proxy.js
const {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
} = require("@aws-sdk/client-s3");

// ────────────────────────────────────────────────────────────
// 1.  Read ENV variables (set these in Netlify UI)
// ────────────────────────────────────────────────────────────
const accessKeyId     = process.env.B2_S3_KEY_ID;
const secretAccessKey = process.env.B2_S3_SECRET_KEY;
const region          = process.env.B2_S3_REGION;          // us-east-005
const endpoint        = process.env.B2_S3_ENDPOINT;        // https://s3.us-east-005.backblazeb2.com
const bucket          = process.env.B2_S3_BUCKET;          // willena

// ────────────────────────────────────────────────────────────
// 2.  Create an S3 client that points to Backblaze
// ────────────────────────────────────────────────────────────
const s3 = new S3Client({
  region,
  endpoint,                 // custom B2 S3 URL
  credentials: { accessKeyId, secretAccessKey },
  forcePathStyle: true,     // required by Backblaze B2
});

// Helper: universal JSON response
const jsonResponse = (statusCode, bodyObj) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  },
  body: JSON.stringify(bodyObj),
});

// ────────────────────────────────────────────────────────────
// 3.  The Function Handler
// ────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  try {
    // ──────── LIST FILES ────────
    if (event.httpMethod === "GET") {
      const list = await s3.send(
        new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1000 })
      );

      const files = (list.Contents || []).map((f) => ({
        key: f.Key,
        size: f.Size,
        lastModified: f.LastModified,
        url: `${endpoint}/file/${bucket}/${encodeURIComponent(f.Key)}`,
      }));

      return jsonResponse(200, { files });
    }

    // ──────── UPLOAD FILE ────────
    if (event.httpMethod === "POST") {
      // Expect JSON: { "filename": "name.ext", "base64": "AAA..." }
      let body;
      try {
        body = JSON.parse(event.body);
      } catch {
        return jsonResponse(400, { error: "Invalid JSON in request body." });
      }

      const { filename, base64 } = body || {};
      if (!filename || !base64)
        return jsonResponse(400, { error: "Missing filename or base64 fields." });

      const buffer = Buffer.from(base64, "base64");

      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: filename,
          Body: buffer,
          ContentType: "application/octet-stream",
        })
      );

      const fileUrl = `${endpoint}/file/${bucket}/${encodeURIComponent(filename)}`;
      return jsonResponse(200, { message: "Upload successful", url: fileUrl });
    }

    // ──────── Unsupported Methods ────────
    return jsonResponse(405, { error: "Method Not Allowed" });
  } catch (err) {
    console.error("B2 S3 Proxy Error:", err);
    return jsonResponse(500, { error: err.message || "Internal Server Error" });
  }
};
