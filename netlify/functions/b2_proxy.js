
// Only require backblaze-b2, do NOT require multiparty (not needed)
const B2 = require('backblaze-b2');

const b2 = new B2({
  applicationKeyId: process.env.b2_key_id,
  applicationKey: process.env.b2_app_key,
});

exports.handler = async function (event) {
  try {
    await b2.authorize(); // Required before any other call

    const bucketName = process.env.b2_bucket_name;

    // Find the bucket ID
    const allBuckets = await b2.listBuckets();
    const bucket = allBuckets.data.buckets.find(
      (b) => b.bucketName === bucketName
    );
    if (!bucket) {
      throw new Error(`Bucket "${bucketName}" not found`);
    }
    const bucketId = bucket.bucketId;

    // Handle upload
    if (event.httpMethod === 'POST') {
      const contentType = event.headers['content-type'] || event.headers['Content-Type'];
      const body = Buffer.from(event.body, 'base64');
      const fileName = event.queryStringParameters?.filename || 'untitled.dat';

      // Get upload URL
      const uploadAuth = await b2.getUploadUrl({ bucketId });

      // Upload file
      const uploadResponse = await b2.uploadFile({
        uploadUrl: uploadAuth.data.uploadUrl,
        uploadAuthToken: uploadAuth.data.authorizationToken,
        fileName,
        data: body,
        mime: contentType,
      });

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Upload successful', fileName }),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    // Handle list
    if (event.httpMethod === 'GET') {
      const files = await b2.listFileNames({ bucketId, maxFileCount: 100 });
      return {
        statusCode: 200,
        body: JSON.stringify(files.data.files),
        headers: { 'Content-Type': 'application/json' },
      };
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
      headers: { 'Content-Type': 'application/json' },
    };
  } catch (err) {
    console.error('B2 Proxy Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Unknown server error' }),
      headers: { 'Content-Type': 'application/json' },
    };
  }
};
