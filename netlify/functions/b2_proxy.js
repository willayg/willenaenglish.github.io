const B2 = require('backblaze-b2');

const b2 = new B2({
  applicationKeyId: process.env.b2_key_id,
  applicationKey: process.env.b2_app_key,
});
const BUCKET_NAME = process.env.b2_bucket_name || "willena";

console.log('b2_key_id:', process.env.b2_key_id);
console.log('b2_app_key:', process.env.b2_app_key ? 'set' : 'not set');
console.log('b2_bucket_name:', process.env.b2_bucket_name);

exports.handler = async (event, context) => {
  const { filename, audioBase64 } = JSON.parse(event.body);

  try {
    await b2.authorize();
    const buckets = await b2.listBuckets();
    console.log('Buckets found:', buckets.data.buckets.map(b => b.bucketName));
    const bucket = buckets.data.buckets.find(b => b.bucketName === BUCKET_NAME);
    if (!bucket) {
      return {
        statusCode: 404,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Bucket not found" })
      };
    }
    const bucketId = bucket.bucketId;

    // Check if file exists
    const files = await b2.listFileNames({ bucketId, maxFileCount: 1000 });
    const file = files.data.files.find(f => f.fileName === filename);
    if (file) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ url: `https://f000.backblazeb2.com/file/${BUCKET_NAME}/${filename}` })
      };
    }

    // Upload if not exists
    const uploadUrlRes = await b2.getUploadUrl({ bucketId });
    await b2.uploadFile({
      uploadUrl: uploadUrlRes.data.uploadUrl,
      uploadAuthToken: uploadUrlRes.data.authorizationToken,
      fileName: filename,
      data: Buffer.from(audioBase64, 'base64'),
      mime: 'audio/mpeg',
    });

    return {
      statusCode: 200,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ url: `https://f000.backblazeb2.com/file/${BUCKET_NAME}/${filename}` })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: err.message })
    };
  }
};