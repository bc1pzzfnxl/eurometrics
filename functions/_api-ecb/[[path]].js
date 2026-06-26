export async function onRequest(context) {
  const url = new URL(context.request.url);
  // Translate the path from /_api-ecb/* to https://data-api.ecb.europa.eu/service/*
  const targetUrl = 'https://data-api.ecb.europa.eu' + url.pathname.replace(/^\/_api-ecb/, '/service') + url.search;

  // Copy request headers, override Host header to target API
  const headers = new Headers(context.request.headers);
  headers.set('Host', 'data-api.ecb.europa.eu');

  try {
    const response = await fetch(targetUrl, {
      method: context.request.method,
      headers: headers,
      body: context.request.body
    });
    return response;
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to proxy request to ECB: ' + error.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
