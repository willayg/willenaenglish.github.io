const B2 = require('backblaze-b2');
const multiparty = require('multiparty');
const fs = require('fs');

const b2 = new B2({
  applicationKeyId: process.env.b2_key_id,
  applicationKey: process.env.b2_app_key,
});

exports.handler = async (event) => {
  try {
    await b2.authorize();

    // Get the bucket ID from the name
    const bucketInfo = await b2.getBucket({ bucketName: process.env.b2_bucket_name });
    const bucketId = bucketInfo.data.bucketId;

    if (event.httpMethod === 'GET') {
      const files = await b2.listFileNames({ bucketId });
      return {
        statusCode: 200,
        body: JSON.stringify(files.data.files),
      };
    }

    if (event.httpMethod === 'POST') {
      const form = new multiparty.Form();
      return new Promise((resolve, reject) => {
        form.parse({ headers: event.headers, body: Buffer.from(event.body, 'base64') }, async (err, fields, files) => {
          if (err) {
            return reject({
              statusCode: 500,
              body: JSON.stringify({ error: 'Form parsing error' }),
            });
          }

          const file = files.file[0];
          const uploadUrlRes = await b2.getUploadUrl({ bucketId });
          const uploadUrl = uploadUrlRes.data.uploadUrl;
          const uploadAuthToken = uploadUrlRes.data.authorizationToken;

          const fileData = fs.readFileSync(file.path);
          const fileName = file.originalFilename;

          await b2.uploadFile({
            uploadUrl,
            uploadAuthToken,
            fileName,
            data: fileData,
            mime: file.headers['content-type'],
          });

          return resolve({
            statusCode: 200,
            body: JSON.stringify({ message: 'File uploaded successfully' }),
          });
        });
      });
    }

    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Unknown error' }),
    };
  }
};
