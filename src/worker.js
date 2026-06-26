export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Intercept API requests starting with /_api-ecb and proxy them to the ECB API
    if (url.pathname.startsWith('/_api-ecb')) {
      const targetUrl = 'https://data-api.ecb.europa.eu' + url.pathname.replace(/^\/_api-ecb/, '/service') + url.search;
      
      const headers = new Headers(request.headers);
      headers.set('Host', 'data-api.ecb.europa.eu');

      try {
        const response = await fetch(targetUrl, {
          method: request.method,
          headers: headers,
          body: request.body
        });
        return response;
      } catch (error) {
        return new Response(JSON.stringify({ error: 'Failed to proxy request to ECB: ' + error.message }), {
          status: 502,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Serve static assets for all other routes
    try {
      return await env.ASSETS.fetch(request);
    } catch (e) {
      return new Response('Asset not found', { status: 404 });
    }
  }
};
