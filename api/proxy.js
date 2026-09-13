// api/proxy.js — Vercel Serverless Function to embed authoritative Bahá'í websites
// Resolves X-Frame-Options restrictions while preserving styles, images, and links.

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const targetUrl = req.query.url;
    if (!targetUrl) {
        return res.status(400).send('Fehlender URL-Parameter (?url=)');
    }

    try {
        const parsed = new URL(targetUrl);
        const allowedDomains = [
            'bahai.org',
            'www.bahai.org',
            'reference.bahai.org',
            'bibliothek.bahai.de',
            'bahaiprayers.org',
            'news.bahai.org',
            'bic.org',
            'ruhi.org',
            'www.ruhi.org'
        ];

        const isAllowed = allowedDomains.some(d => parsed.hostname === d || parsed.hostname.endsWith('.' + d));
        if (!isAllowed) {
            return res.status(403).send('Domain nicht für Web-Einbettung freigegeben.');
        }

        const upstreamResponse = await fetch(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        if (!upstreamResponse.ok) {
            return res.status(upstreamResponse.status).send(`Fehler beim Laden der Originalseite: HTTP ${upstreamResponse.status} ${upstreamResponse.statusText}`);
        }

        let html = await upstreamResponse.text();

        // Inject <base href="..."> with target="_blank" so all relative assets (CSS, images, fonts, doc-data.json)
        // resolve to the original site correctly even when viewing sub-pages or sections like /1#647533678
        let cleanUrl = targetUrl.split('?')[0].split('#')[0];
        let baseHref = cleanUrl;
        if (baseHref.endsWith('/')) {
            // Already directory
        } else {
            const lastSlash = baseHref.lastIndexOf('/');
            if (lastSlash !== -1) {
                const lastSegment = baseHref.substring(lastSlash + 1);
                // If ending with numeric chapter or pagination (e.g. /1), base is parent directory
                if (/^\d+$/.test(lastSegment)) {
                    baseHref = baseHref.substring(0, lastSlash + 1);
                } else {
                    baseHref = baseHref + '/';
                }
            } else {
                baseHref = baseHref + '/';
            }
        }

        const baseTag = `<base href="${escapeAttr(baseHref)}" target="_blank">`;
        
        // Clean authentic paper presentation without forcing unreadable dark-on-dark styles
        const iframeEnhancementStyle = `
            <style id="cosmos-proxy-enhancements">
                html, body {
                    background-color: #ffffff !important;
                    color: #1a1a1a !important;
                    -webkit-font-smoothing: antialiased;
                }
            </style>
        `;

        if (html.includes('<head>')) {
            html = html.replace('<head>', `<head>\n  ${baseTag}\n  ${iframeEnhancementStyle}`);
        } else if (html.includes('<HEAD>')) {
            html = html.replace('<HEAD>', `<HEAD>\n  ${baseTag}\n  ${iframeEnhancementStyle}`);
        } else {
            html = `${baseTag}\n${iframeEnhancementStyle}\n${html}`;
        }

        // Send modified HTML without X-Frame-Options restriction
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400');
        
        // Remove frame restrictions
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.setHeader('Content-Security-Policy', "frame-ancestors *;");

        return res.status(200).send(html);
    } catch (err) {
        return res.status(500).send(`Serverless Proxy Fehler: ${err.message}`);
    }
};

function escapeAttr(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
