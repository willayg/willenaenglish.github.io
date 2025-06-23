const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  console.log('Received event:', event.httpMethod, event.path);
  console.log('Event body:', event.body);
  console.log('Env:', {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_KEY: process.env.SUPABASE_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  });
  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use service role key for uploads
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    if (event.path.endsWith('/upload_teacher_file') && event.httpMethod === 'POST') {
      // Parse multipart/form-data (you may need a library like busboy or formidable)
      // For simplicity, let's assume you send base64 file data and filename in JSON

      try {
        const { fileName, fileDataBase64 } = JSON.parse(event.body);
        const buffer = Buffer.from(fileDataBase64, 'base64');
        const { data, error } = await supabase.storage
          .from('teacher-files')
          .upload(`uploads/${Date.now()}_${fileName}`, buffer, {
            contentType: 'application/octet-stream',
            upsert: false,
          });

        if (error) {
          throw error;
        }

        return { statusCode: 200, body: JSON.stringify({ path: data.path }) };
      } catch (err) {
        return { statusCode: 400, body: JSON.stringify({ error: err.message }) };
      }
    } else if (event.path.endsWith('/list_teacher_files') && event.httpMethod === 'GET') {
      const { prefix = '', limit = 20, offset = 0 } = event.queryStringParameters || {};

      const { data, error } = await supabase.storage
        .from('teacher-files')
        .list(prefix, {
          limit: Number(limit),
          offset: Number(offset),
          sortBy: { column: 'name', order: 'asc' }
        });

      if (error) {
        return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
      }

      const filesWithUrls = [];
      for (const file of data) {
        if (file.name) {
          const filePath = prefix ? `${prefix}/${file.name}` : file.name;
          const { data: signedData } = await supabase.storage
            .from('teacher-files')
            .createSignedUrl(filePath, 3600);
          filesWithUrls.push({
            name: file.name,
            path: filePath,
            url: signedData?.signedUrl || null,
            updated_at: file.updated_at,
            metadata: file.metadata
          });
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify(filesWithUrls)
      };
    } else if (event.path.endsWith('/save_worksheet') && event.httpMethod === 'POST') {
      try {
        const worksheet = JSON.parse(event.body);
        console.log('worksheet.words:', worksheet.words, typeof worksheet.words); // <--- Add this line

        // Always normalize worksheet.words to an array of trimmed strings
        if (typeof worksheet.words === "string") {
          worksheet.words = worksheet.words
            .split('\n')
            .map(w => w.trim())
            .filter(w => w.length > 0);
        } else if (Array.isArray(worksheet.words)) {
          worksheet.words = worksheet.words
            .map(w => typeof w === "string" ? w.trim() : "")
            .filter(w => w.length > 0);
        } else {
          worksheet.words = [];
        }

        // If language_point should be an array:
        if ('language_point' in worksheet) {
          if (typeof worksheet.language_point === "string") {
            worksheet.language_point = worksheet.language_point.trim() !== ""
              ? [worksheet.language_point.trim()]
              : [];
          } else if (!Array.isArray(worksheet.language_point)) {
            worksheet.language_point = [];
          }
        }

        const { data, error } = await supabase
          .from('worksheets')
          .insert([worksheet]);
        if (error) {
          return {
            statusCode: 400,
            body: JSON.stringify({ success: false, error: error.message })
          };
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, data })
        };
      } catch (err) {
        return {
          statusCode: 500,
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    } else if (event.path.endsWith('/list_worksheets') && event.httpMethod === 'GET') {
      try {
        const { data, error } = await supabase
          .from('worksheets')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) {
          return {
            statusCode: 500,
            body: JSON.stringify({ success: false, error: error.message })
          };
        }
        return {
          statusCode: 200,
          body: JSON.stringify({ success: true, data })
        };
      } catch (err) {
        return {
          statusCode: 500,
          body: JSON.stringify({ success: false, error: err.message })
        };
      }
    } else {
      return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
    }
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal server error' }) };
  }
};