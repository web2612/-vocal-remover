// Cloudflare Pages Functions - Production API Gateway Reverse Proxy
// Transparently proxies /api/* requests from Cloudflare Pages to the PHP Multi-Provider Backend

interface Env {
  PROVIDER_GATEWAY_URL?: string;
  ADMIN_SECRET_KEY?: string;
}

export const onRequest: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const url = new URL(request.url);

  // If a provider gateway backend is configured via Pages Environment Variables
  const gatewayUrl = env.PROVIDER_GATEWAY_URL;

  if (gatewayUrl) {
    const targetUrl = gatewayUrl.replace(/\/$/, '') + url.pathname + url.search;

    const proxyHeaders = new Headers(request.headers);
    // Remove Cloudflare-specific connecting IP and host headers for upstream cleanliness
    proxyHeaders.delete('cf-connecting-ip');
    proxyHeaders.delete('cf-ray');
    proxyHeaders.delete('cf-visitor');

    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
        redirect: 'follow',
      });

      const responseHeaders = new Headers(response.headers);
      // Ensure CORS allow-origin is properly passed through
      if (!responseHeaders.has('Access-Control-Allow-Origin')) {
        responseHeaders.set('Access-Control-Allow-Origin', url.origin);
        responseHeaders.set('Access-Control-Allow-Credentials', 'true');
      }

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (err: any) {
      return new Response(
        JSON.stringify({
          code: 'unavailable',
          message: 'Audio processing gateway is temporarily unreachable. Switching to browser processing.',
          details: err?.message,
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  // Gateway URL not set in Pages environment variables
  return new Response(
    JSON.stringify({
      code: 'unavailable',
      message: 'Audio processing server is not configured. Switching to browser processing.',
    }),
    {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};
