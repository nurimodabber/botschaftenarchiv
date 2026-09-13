// api/sync.js — Serverless Endpoint for Cross-Device Account Synchronization
// Bahá'í-Bibliothek & Botschaften-Archiv (v7.0)

const crypto = require('crypto');

// In-Memory-Cache fuer kurzzeitige Wiederverwendung innerhalb warmer Serverless-Instanzen
const memoryCache = new Map();

function hashKey(str) {
    return crypto.createHash('sha256').update(String(str).trim().toLowerCase()).digest('hex').slice(0, 32);
}

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Sync-Key');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // ─── POST / PUT: Account / Vault in die Cloud synchronisieren ───
        if (req.method === 'POST' || req.method === 'PUT') {
            let body = req.body;
            if (typeof body === 'string') {
                try {
                    body = JSON.parse(body);
                } catch (e) {}
            }

            const vault = body.vault || body;
            let syncKey = (body.syncKey || req.headers['x-sync-key'] || '').trim();

            // Falls Authorization-Header (Bearer Token von Clerk) vorhanden ist
            const authHeader = req.headers.authorization || '';
            if (!syncKey && authHeader.startsWith('Bearer ')) {
                const token = authHeader.substring(7);
                try {
                    // Verwende den Hash des Tokens oder Claims als Schlüssel
                    syncKey = hashKey(token);
                } catch (e) {}
            }

            if (!vault || (!vault.data && !vault.bookmarks && !vault.ciphertext && !vault.encrypted && !Array.isArray(vault))) {
                return res.status(400).json({ ok: false, error: 'Ungültiges Vault-Format' });
            }

            const vaultPayload = vault.encrypted ? {
                format: 'bahai-bib-vault',
                version: '4.0',
                encrypted: true,
                updatedAt: new Date().toISOString(),
                user: vault.user || null,
                iv: vault.iv,
                salt: vault.salt,
                ciphertext: vault.ciphertext
            } : {
                format: 'bahai-bib-vault',
                version: '4.0',
                updatedAt: new Date().toISOString(),
                user: vault.user || null,
                data: vault.data || {
                    bookmarks: vault.bookmarks || [],
                    compilations: vault.compilations || [],
                    history: vault.history || [],
                    highlights: vault.highlights || [],
                    settings: vault.settings || {}
                }
            };

            const targetKey = syncKey ? hashKey(syncKey) : hashKey(JSON.stringify(vaultPayload.user || 'anon'));
            const jsonString = JSON.stringify(vaultPayload);

            // 1. In-Memory Cache
            memoryCache.set(targetKey, {
                payload: vaultPayload,
                timestamp: Date.now()
            });

            // 2. Vercel KV / Upstash Redis falls konfiguriert
            const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
            const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
            if (kvUrl && kvToken) {
                try {
                    await fetch(`${kvUrl}/set/vault_${targetKey}`, {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${kvToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify([jsonString, 'EX', 60 * 60 * 24 * 365]) // 1 Jahr TTL
                    });
                } catch (e) {
                    console.warn('KV storage warning:', e.message);
                }
            }

            // 3. Fallback: dpaste-Speicher für langlebigen Cross-Device-Transfer
            let dpasteId = '';
            try {
                const form = new URLSearchParams();
                form.append('content', jsonString);
                form.append('expiry_days', '365');
                form.append('format', 'url');

                const dpRes = await fetch('https://dpaste.com/api/v2/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: form
                });
                if (dpRes.ok) {
                    const dpUrl = (await dpRes.text()).trim();
                    dpasteId = dpUrl.split('/').filter(Boolean).pop();
                }
            } catch (e) {
                console.warn('dpaste upload fallback warning:', e.message);
            }

            const syncCode = dpasteId ? `BHA-${dpasteId}` : (syncKey ? `BHA-${syncKey.slice(0, 10)}` : '');

            return res.status(200).json({
                ok: true,
                synced: true,
                syncKey: targetKey,
                syncCode: syncCode,
                updatedAt: vaultPayload.updatedAt,
                timestamp: Date.now()
            });
        }

        // ─── GET: Account / Vault aus der Cloud abrufen ───
        if (req.method === 'GET') {
            const rawCode = (req.query.code || req.query.key || req.headers['x-sync-key'] || '').trim();
            if (!rawCode) {
                return res.status(400).json({ ok: false, error: 'Kein Sync-Code oder Schlüssel übergeben.' });
            }

            const cleanCode = rawCode.replace(/^BHA-/i, '').trim();
            const targetKey = hashKey(cleanCode);

            // 1. Zuerst prüfen wir den Memory Cache
            if (memoryCache.has(targetKey)) {
                const cached = memoryCache.get(targetKey);
                return res.status(200).json({
                    ok: true,
                    source: 'cache',
                    vault: cached.payload,
                    updatedAt: cached.payload.updatedAt
                });
            }

            // 2. Vercel KV / Upstash Redis
            const kvUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
            const kvToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
            if (kvUrl && kvToken) {
                try {
                    const kvRes = await fetch(`${kvUrl}/get/vault_${targetKey}`, {
                        headers: { Authorization: `Bearer ${kvToken}` }
                    });
                    if (kvRes.ok) {
                        const kvData = await kvRes.json();
                        if (kvData && kvData.result) {
                            const parsed = JSON.parse(kvData.result);
                            memoryCache.set(targetKey, { payload: parsed, timestamp: Date.now() });
                            return res.status(200).json({
                                ok: true,
                                source: 'kv',
                                vault: parsed,
                                updatedAt: parsed.updatedAt
                            });
                        }
                    }
                } catch (e) {
                    console.warn('KV read warning:', e.message);
                }
            }

            // 3. dpaste Fallback
            try {
                const dpRes = await fetch(`https://dpaste.com/${cleanCode}.txt`);
                if (dpRes.ok) {
                    const text = await dpRes.text();
                    const parsed = JSON.parse(text);
                    if (parsed && (parsed.data || parsed.bookmarks || parsed.ciphertext || parsed.encrypted)) {
                        memoryCache.set(targetKey, { payload: parsed, timestamp: Date.now() });
                        return res.status(200).json({
                            ok: true,
                            source: 'vault',
                            vault: parsed,
                            syncCode: rawCode
                        });
                    }
                }
            } catch (e) {
                console.warn('dpaste read warning:', e.message);
            }

            return res.status(404).json({
                ok: false,
                error: 'Kein Studienkonto unter diesem Code gefunden oder die Sitzung ist neu initialisiert.'
            });
        }

        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    } catch (err) {
        console.error('Sync handler error:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
};
