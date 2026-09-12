// api/sync.js — Serverless Endpoint for Cross-Device Account Synchronization
// Bahá'í-Bibliothek & Botschaften-Archiv

const crypto = require('crypto');

function hashKey(str) {
    return crypto.createHash('sha256').update(String(str).trim().toLowerCase()).digest('hex').slice(0, 24);
}

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // ─── POST: Account / Vault in die Cloud synchronisieren ───
        if (req.method === 'POST') {
            let body = req.body;
            if (typeof body === 'string') {
                try {
                    body = JSON.parse(body);
                } catch (e) {}
            }

            const vault = body.vault || body;
            const syncKey = (body.syncKey || '').trim();

            if (!vault || (!vault.data && !vault.bookmarks && !Array.isArray(vault))) {
                return res.status(400).json({ ok: false, error: 'Ungültiges Vault-Format' });
            }

            const vaultPayload = {
                format: 'bahai-bib-vault',
                version: '2.0',
                updatedAt: new Date().toISOString(),
                user: vault.user || null,
                data: vault.data || {
                    bookmarks: vault.bookmarks || [],
                    compilations: vault.compilations || [],
                    history: vault.history || [],
                    highlights: vault.highlights || []
                }
            };

            const jsonString = JSON.stringify(vaultPayload);

            // 1. Dauerhafte Speicherung über dpaste (365 Tage Gültigkeit)
            const form = new URLSearchParams();
            form.append('content', jsonString);
            form.append('expiry_days', '365');
            form.append('format', 'url');

            let dpasteId = '';
            try {
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
                console.warn('dpaste upload fallback:', e.message);
            }

            const syncCode = dpasteId ? `BHA-${dpasteId}` : (syncKey ? `BHA-${syncKey}` : '');

            // 2. Echtzeit-PubSub via ntfy (für sofortiges Live-Sync zwischen aktiven Geräten)
            const targetTopic = syncKey ? hashKey(syncKey) : (dpasteId ? hashKey(dpasteId) : null);
            if (targetTopic) {
                try {
                    await fetch(`https://ntfy.sh/bahai_sync_${targetTopic}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Title': 'Bahá’í-Bibliothek Sync'
                        },
                        body: JSON.stringify({
                            syncCode: syncCode,
                            dpasteId: dpasteId,
                            vault: vaultPayload,
                            timestamp: Date.now()
                        })
                    });
                } catch (e) {
                    console.warn('ntfy publish fallback:', e.message);
                }
            }

            return res.status(200).json({
                ok: true,
                syncCode: syncCode,
                syncUrl: syncCode ? `https://bahaibibliothek.vercel.app/?sync=${syncCode}` : '',
                updatedAt: vaultPayload.updatedAt
            });
        }

        // ─── GET: Account / Vault aus der Cloud abrufen ───
        if (req.method === 'GET') {
            const rawCode = (req.query.code || req.query.key || '').trim();
            if (!rawCode) {
                return res.status(400).json({ ok: false, error: 'Kein Sync-Code oder Schlüssel übergeben.' });
            }

            const cleanCode = rawCode.replace(/^BHA-/i, '').trim();

            // 1. Zuerst versuchen wir den Live-Kanal auf ntfy
            const topicHash = hashKey(cleanCode);
            try {
                const ntfyRes = await fetch(`https://ntfy.sh/bahai_sync_${topicHash}/json?poll=1`);
                if (ntfyRes.ok) {
                    const text = await ntfyRes.text();
                    const lines = text.trim().split('\n').filter(Boolean);
                    if (lines.length > 0) {
                        const lastMsg = JSON.parse(lines[lines.length - 1]);
                        if (lastMsg && lastMsg.message) {
                            const parsed = JSON.parse(lastMsg.message);
                            if (parsed.vault) {
                                return res.status(200).json({
                                    ok: true,
                                    source: 'channel',
                                    vault: parsed.vault,
                                    syncCode: parsed.syncCode || rawCode
                                });
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn('ntfy read fallback:', e.message);
            }

            // 2. Fallback auf dauerhaften dpaste-Vault (365 Tage)
            try {
                const dpRes = await fetch(`https://dpaste.com/${cleanCode}.txt`);
                if (dpRes.ok) {
                    const text = await dpRes.text();
                    const parsed = JSON.parse(text);
                    if (parsed && (parsed.data || parsed.bookmarks)) {
                        return res.status(200).json({
                            ok: true,
                            source: 'vault',
                            vault: parsed,
                            syncCode: rawCode
                        });
                    }
                }
            } catch (e) {
                console.warn('dpaste read fallback:', e.message);
            }

            return res.status(404).json({
                ok: false,
                error: 'Kein Studienkonto unter diesem Code gefunden oder der Code ist abgelaufen.'
            });
        }

        return res.status(405).json({ ok: false, error: 'Method not allowed' });
    } catch (err) {
        console.error('Sync handler error:', err);
        return res.status(500).json({ ok: false, error: err.message });
    }
};
