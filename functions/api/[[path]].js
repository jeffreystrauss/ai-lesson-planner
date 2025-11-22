// Simplified Cloudflare Workers API for AI Lesson Planner

function generateId() {
  return crypto.randomUUID();
}

async function getSession(request, env) {
  try {
    const cookies = request.headers.get('Cookie') || '';
    const sessionMatch = cookies.match(/session=([^;]+)/);
    const sessionId = sessionMatch ? sessionMatch[1] : null;

    if (!sessionId) return null;

    const session = await env.DB.prepare(
      'SELECT * FROM sessions WHERE id = ? AND expires_at > datetime("now")'
    ).bind(sessionId).first();

    if (!session) return null;

    const user = await env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).bind(session.user_id).first();

    return user;
  } catch (error) {
    console.error('getSession error:', error);
    return null;
  }
}

function createSessionCookie(sessionId, maxAge = 7 * 24 * 60 * 60) {
  return `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}; Path=/`;
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': 'true',
      ...headers
    }
  });
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  console.log(`Request: ${request.method} ${path}`);

  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Credentials': 'true',
      }
    });
  }

  try {
    // ============= AUTH ROUTES =============
    
    if (path === '/api/auth/google' && request.method === 'GET') {
      const redirectUri = `${url.origin}/api/auth/google/callback`;
      const state = generateId();
      
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('state', state);

      return Response.redirect(authUrl.toString(), 302);
    }

    if (path === '/api/auth/google/callback' && request.method === 'GET') {
      const code = url.searchParams.get('code');

      if (!code) {
        return new Response('No code provided', { status: 400 });
      }

      // Exchange code for token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: `${url.origin}/api/auth/google/callback`,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (!tokens.access_token) {
        console.error('Token error:', tokens);
        return new Response('Failed to get access token: ' + JSON.stringify(tokens), { status: 400 });
      }

      // Get user info
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      const googleUser = await userResponse.json();

      // Check if user exists
      let user = await env.DB.prepare(
        'SELECT * FROM users WHERE google_id = ?'
      ).bind(googleUser.id).first();

      if (!user) {
        // Create new user
        const userId = generateId();
        await env.DB.prepare(
          'INSERT INTO users (id, email, google_id, name) VALUES (?, ?, ?, ?)'
        ).bind(userId, googleUser.email, googleUser.id, googleUser.name).run();
        
        user = await env.DB.prepare(
          'SELECT * FROM users WHERE google_id = ?'
        ).bind(googleUser.id).first();
      }

      // Create session
      const sessionId = generateId();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      
      await env.DB.prepare(
        'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
      ).bind(sessionId, user.id, expiresAt).run();

      // Redirect with session cookie
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/',
          'Set-Cookie': createSessionCookie(sessionId),
        },
      });
    }

    if (path === '/api/auth/me' && request.method === 'GET') {
      const user = await getSession(request, env);
      
      return jsonResponse({ 
        user: user ? { 
          id: user.id, 
          email: user.email, 
          name: user.name 
        } : null 
      });
    }

    if (path === '/api/auth/logout' && request.method === 'POST') {
      const cookies = request.headers.get('Cookie') || '';
      const sessionMatch = cookies.match(/session=([^;]+)/);
      const sessionId = sessionMatch ? sessionMatch[1] : null;

      if (sessionId) {
        await env.DB.prepare('DELETE FROM sessions WHERE id = ?')
          .bind(sessionId).run();
      }

      return jsonResponse({ success: true }, 200, {
        'Set-Cookie': 'session=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/',
      });
    }

    // ============= SETTINGS ROUTES =============
    
    if (path === '/api/settings' && request.method === 'GET') {
      const user = await getSession(request, env);
      if (!user) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const settings = await env.DB.prepare(
        'SELECT api_key, gpt_link FROM settings WHERE user_id = ?'
      ).bind(user.id).first();

      return jsonResponse(settings || {});
    }

    if (path === '/api/settings' && request.method === 'POST') {
      const user = await getSession(request, env);
      if (!user) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const { apiKey, gptLink } = await request.json();

      await env.DB.prepare(`
        INSERT INTO settings (user_id, api_key, gpt_link, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(user_id) DO UPDATE SET
          api_key = excluded.api_key,
          gpt_link = excluded.gpt_link,
          updated_at = datetime('now')
      `).bind(user.id, apiKey || null, gptLink || null).run();

      return jsonResponse({ success: true });
    }

    // ============= LESSON GENERATION =============
    
    if (path === '/api/generate' && request.method === 'POST') {
      const user = await getSession(request, env);
      if (!user) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const { subject, gradeLevel, learningObjective, useApiKey } = await request.json();

      // Get user's API key
      let apiKey = env.OPENAI_API_KEY || null;
      
      if (useApiKey) {
        const settings = await env.DB.prepare(
          'SELECT api_key FROM settings WHERE user_id = ?'
        ).bind(user.id).first();
        
        if (settings?.api_key) {
          apiKey = settings.api_key;
        }
      }

      if (!apiKey) {
        return jsonResponse({ error: 'No API key configured' }, 400);
      }

      // Call OpenAI API
      const prompt = `You are an expert educational consultant specializing in integrating AI ethically into lesson plans.

Create a comprehensive lesson plan with the following details:
- Subject: ${subject}
- Grade Level: ${gradeLevel}
- Learning Objective: ${learningObjective}

Your response must be a valid JSON object with this exact structure:
{
  "title": "Brief descriptive title",
  "subject": "${subject}",
  "gradeLevel": "${gradeLevel}",
  "learningObjective": "${learningObjective}",
  "aiIntegration": {
    "approach": "One-sentence summary of AI integration approach",
    "description": "Detailed description of how AI will be used",
    "rationale": [
      "Reason 1 referencing Bloom's Taxonomy or Kirkpatrick's Model",
      "Reason 2 about learning outcomes",
      "Reason 3 about critical thinking",
      "Reason 4 about real-world preparation"
    ],
    "ethicalConsiderations": [
      "Transparency consideration",
      "Verification consideration",
      "Original thinking consideration",
      "Equity consideration"
    ]
  },
  "activities": [
    {
      "phase": "Phase name with duration",
      "activity": "Description of activity",
      "studentRole": "What students do",
      "teacherRole": "What teacher does"
    }
  ],
  "assessmentStrategy": "Description of how learning will be assessed using Kirkpatrick's model",
  "pedagogicalFrameworks": [
    "Framework 1 explanation",
    "Framework 2 explanation"
  ],
  "toolSuggestions": [
    "Tool 1 with purpose",
    "Tool 2 with purpose"
  ]
}

IMPORTANT: Return ONLY the JSON object, no additional text or markdown formatting.`;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            {
              role: 'system',
              content: 'You are an educational AI assistant that creates detailed, pedagogically sound lesson plans. Always respond with valid JSON only.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        return jsonResponse({ error: `OpenAI API error: ${response.status}` }, 500);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse JSON response
      let lessonPlan = JSON.parse(content);
      lessonPlan.id = generateId();
      lessonPlan.createdAt = new Date().toISOString();

      return jsonResponse({ lessonPlan });
    }

    // ============= LESSON PLANS CRUD =============
    
    if (path === '/api/plans' && request.method === 'GET') {
      const user = await getSession(request, env);
      if (!user) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const plans = await env.DB.prepare(
        'SELECT * FROM lesson_plans WHERE user_id = ? ORDER BY created_at DESC'
      ).bind(user.id).all();

      const parsedPlans = plans.results.map(p => ({
        ...JSON.parse(p.plan_data),
        dbId: p.id,
      }));

      return jsonResponse({ plans: parsedPlans });
    }

    if (path === '/api/plans' && request.method === 'POST') {
      const user = await getSession(request, env);
      if (!user) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const lessonPlan = await request.json();
      const planId = generateId();

      await env.DB.prepare(`
        INSERT INTO lesson_plans (id, user_id, title, subject, grade_level, learning_objective, plan_data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        planId,
        user.id,
        lessonPlan.title,
        lessonPlan.subject,
        lessonPlan.gradeLevel,
        lessonPlan.learningObjective,
        JSON.stringify(lessonPlan)
      ).run();

      return jsonResponse({ success: true, id: planId });
    }

    // ============= COMMUNITY PLANS =============
    
    if (path === '/api/community-plans' && request.method === 'GET') {
      const plans = await env.DB.prepare(
        'SELECT * FROM community_plans ORDER BY shared_at DESC LIMIT 50'
      ).all();

      const parsedPlans = plans.results.map(p => ({
        ...JSON.parse(p.plan_data),
        dbId: p.id,
        sharedBy: p.shared_by,
        sharedAt: p.shared_at,
      }));

      return jsonResponse({ plans: parsedPlans });
    }

    if (path === '/api/community-plans' && request.method === 'POST') {
      const user = await getSession(request, env);
      if (!user) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }

      const lessonPlan = await request.json();
      const planId = generateId();
      const username = user.email.split('@')[0];

      await env.DB.prepare(`
        INSERT INTO community_plans (id, user_id, shared_by, title, subject, grade_level, learning_objective, plan_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        planId,
        user.id,
        username,
        lessonPlan.title,
        lessonPlan.subject,
        lessonPlan.gradeLevel,
        lessonPlan.learningObjective,
        JSON.stringify(lessonPlan)
      ).run();

      return jsonResponse({ success: true, id: planId });
    }

    // 404 Not Found
    return jsonResponse({ error: 'Not Found' }, 404);

  } catch (error) {
    console.error('Worker error:', error);
    return jsonResponse({ 
      error: 'Internal Server Error', 
      message: error.message,
      stack: error.stack 
    }, 500);
  }
}
