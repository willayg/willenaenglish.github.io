const B2 = require('backblaze-b2');

const b2 = new B2({
  applicationKeyId: process.env.B2_KEY_ID,
  applicationKey: process.env.B2_APP_KEY,
});
const BUCKET_NAME = process.env.B2_BUCKET_NAME;

exports.handler = async (event, context) => {
  const { filename, audioBase64 } = JSON.parse(event.body);

  try {
    await b2.authorize();
    const buckets = await b2.listBuckets();
    const bucketId = buckets.data.buckets.find(b => b.bucketName === BUCKET_NAME).bucketId;

    // Check if file exists
    const files = await b2.listFileNames({ bucketId, maxFileCount: 1000 });
    const file = files.data.files.find(f => f.fileName === filename);
    if (file) {
      return {
        statusCode: 200,
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
      body: JSON.stringify({ url: `https://f000.backblazeb2.com/file/${BUCKET_NAME}/${filename}` })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};