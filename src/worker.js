import { routeAgentRequest } from "agents";
export { ChatAgent } from "./agent.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 0. Route Agents SDK requests
    if (url.pathname.startsWith('/agents/')) {
      const response = routeAgentRequest(request, env);
      if (response) return response;
    }

    // 1. Handle CORS Preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
          'Access-Control-Max-Age': '86400',
        }
      });
    }

    // 2. Intercept API requests starting with /_api-ecb and proxy them to the ECB API
    if (url.pathname.startsWith('/_api-ecb')) {
      const targetUrl = 'https://data-api.ecb.europa.eu' + url.pathname.replace(/^\/_api-ecb/, '/service') + url.search;
      
      // Clean headers to forward to ECB API
      const forwardHeaders = new Headers();
      forwardHeaders.set('Host', 'data-api.ecb.europa.eu');
      
      const allowedHeaders = ['accept', 'accept-language', 'user-agent', 'content-type'];
      for (const header of allowedHeaders) {
        if (request.headers.has(header)) {
          forwardHeaders.set(header, request.headers.get(header));
        }
      }

      // Build safe fetch options (exclude body for GET/HEAD methods)
      const fetchOptions = {
        method: request.method,
        headers: forwardHeaders,
        cf: {
          // Cache successful GET requests at the Edge for 1 hour (3600s)
          cacheTtl: request.method === 'GET' ? 3600 : 0,
          cacheEverything: request.method === 'GET',
        }
      };

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        fetchOptions.body = request.body;
      }

      try {
        console.log(JSON.stringify({
          message: 'Proxying request to ECB',
          method: request.method,
          pathname: url.pathname
        }));

        const response = await fetch(targetUrl, fetchOptions);
        
        // Wrap response to attach CORS headers
        const corsHeaders = new Headers(response.headers);
        corsHeaders.set('Access-Control-Allow-Origin', '*');
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: corsHeaders
        });
      } catch (error) {
        console.error(JSON.stringify({
          message: 'Failed to proxy request to ECB',
          error: error.message,
          pathname: url.pathname,
          method: request.method
        }));
        return new Response(JSON.stringify({ error: 'Failed to proxy request to ECB: ' + error.message }), {
          status: 502,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }

    // 3. Serve static assets for all other routes
    try {
      const response = await env.ASSETS.fetch(request);
      // Clone response and append no-transform to prevent Cloudflare Auto Minify from corrupting binary base64 in scripts
      const newResponse = new Response(response.body, response);
      const cc = response.headers.get('Cache-Control') || '';
      newResponse.headers.set('Cache-Control', cc ? `${cc}, no-transform` : 'no-transform');
      return newResponse;
    } catch (error) {
      console.error(JSON.stringify({
        message: 'Failed to serve static asset',
        error: error.message,
        pathname: url.pathname
      }));
      return new Response('Internal server error', { status: 500 });
    }
  }
};
