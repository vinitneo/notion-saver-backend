// api/save.js
// This endpoint receives a page title + URL from the extension
// and creates a new entry in the user's chosen Notion database.

export default async function handler(req, res) {
  // Handle CORS preflight request (browsers send this before the real request)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { databaseId, title, url, token } = req.body;

  // Validate required fields
  if (!databaseId || !title || !token) {
    return res.status(400).json({ error: 'Missing required fields: databaseId, title, token' });
  }

  try {
    // Create a new page in the Notion database
    const notionResponse = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        parent: {
          database_id: databaseId,
        },
        properties: {
          // "Name" is the default title property in all Notion databases
          Name: {
            title: [
              {
                text: {
                  content: title,
                },
              },
            ],
          },
          // IMPORTANT: Your Notion database must have a property called "URL" of type "URL"
          // If your column has a different name, change "URL" below to match it exactly
          URL: {
            url: url || null,
          },
        },
      }),
    });

    const notionData = await notionResponse.json();

    if (!notionResponse.ok) {
      // Forward Notion's error message to help with debugging
      return res.status(500).json({
        error: notionData.message || 'Failed to create Notion page',
        details: notionData,
      });
    }

    // Success!
    return res.json({
      success: true,
      pageId: notionData.id,
      pageUrl: notionData.url,
    });
  } catch (err) {
    console.error('Save error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
