/**
 * Omnisearch 2.0 - Hochgradig leistungsfaehige Volltext- & Recherchesuche
 * fuer das Baha'i-Schriften- und Botschaftenarchiv.
 * 
 * Funktionen:
 * - Exakte Phrasensuche ("...")
 * - Boolesche Operatoren (AND, OR, NOT/-)
 * - Feld-Filter (autor:, jahr:, typ:, saeule:)
 * - Baha'i-Transliteration & Orthografie (ae/oe/ue, Baha'u'llah == Bahaullah, etc.)
 * - BM25-inspiriertes Relevanz-Ranking mit Termdichte & Saettigung
 * - High-Density Snippet-Extraktion mit Satzgrenzen und Trefferanzahl
 * - Sofort-Vorschlaege (Autocomplete)
 */

window.SearchEngine = (function() {
    'use strict';

    // 1. Baha'i- und Sprach-Normalisierung
    function normalize(str) {
        if (!str) return '';
        return String(str)
            .replace(/ä|Ä/g, 'ae')
            .replace(/ö|Ö/g, 'oe')
            .replace(/ü|Ü/g, 'ue')
            .replace(/ß/g, 'ss')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/['\u2019`\u02bb\u2018"“”„«»]/g, '')
            .replace(/schoghi/g, 'shoghi')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function escapeRegex(s) {
        return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function escapeHtml(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 2. Intelligenter Query-Parser
    function parseQuery(raw) {
        const res = {
            raw: raw || '',
            phrases: [],
            mustTokens: [],
            shouldTokens: [],
            mustNotTokens: [],
            filters: {},
            allTokens: []
        };
        if (!raw || !raw.trim()) return res;

        let text = raw.trim();

        // 1. Exakte Phrasen in Anfuehrungszeichen ("...")
        const phraseRegex = /"([^"]+)"/g;
        let match;
        while ((match = phraseRegex.exec(text)) !== null) {
            const phrase = normalize(match[1]);
            if (phrase) res.phrases.push(phrase);
        }
        text = text.replace(phraseRegex, ' ');

        // 2. Feld-Filter (autor:..., jahr:..., typ:..., saeule:...)
        const fieldRegex = /(?:autor|author|verfasser|jahr|year|typ|type|anlass|saeule|pillar|segment):([^\s]+)/gi;
        while ((match = fieldRegex.exec(text)) !== null) {
            const field = match[0].split(':')[0].toLowerCase();
            const val = normalize(match[1]);
            if (['autor', 'author', 'verfasser'].includes(field)) res.filters.author = val;
            else if (['jahr', 'year'].includes(field)) res.filters.year = parseInt(val, 10) || val;
            else if (['typ', 'type', 'anlass'].includes(field)) res.filters.type = val;
            else if (['saeule', 'pillar', 'segment'].includes(field)) res.filters.pillar = val;
        }
        text = text.replace(fieldRegex, ' ');

        // 3. Tokens & Operatoren (+, -, OR)
        const rawTokens = text.split(/\s+/).filter(Boolean);
        const hasOr = rawTokens.some(t => t.toUpperCase() === 'OR');

        for (let i = 0; i < rawTokens.length; i++) {
            const t = rawTokens[i];
            if (t.toUpperCase() === 'OR') continue;

            if (t.startsWith('-') && t.length > 1) {
                const term = normalize(t.slice(1));
                if (term) res.mustNotTokens.push(term);
            } else if (t.startsWith('+') && t.length > 1) {
                const term = normalize(t.slice(1));
                if (term) res.mustTokens.push(term);
            } else {
                const term = normalize(t);
                if (term) {
                    if (hasOr) {
                        res.shouldTokens.push(term);
                    } else {
                        res.mustTokens.push(term);
                    }
                }
            }
        }

        const all = new Set();
        res.phrases.forEach(p => p.split(/\s+/).forEach(tok => all.add(tok)));
        res.mustTokens.forEach(tok => all.add(tok));
        res.shouldTokens.forEach(tok => all.add(tok));
        res.allTokens = Array.from(all).filter(t => t.length > 0);

        return res;
    }

    // 3. High-Density Context Snippet Extraktion (Blitzschnell & praezise)
    function findBestSnippet(rawText, normText, queryObj) {
        if (!rawText) return { snippetHtml: '', matchCount: 0, bestIndex: 0 };
        const tokens = queryObj.allTokens;
        const phrases = queryObj.phrases;

        let firstMatch = -1;
        let matchLen = 0;
        let totalCount = 0;

        // Phrasentreffer pruefen
        for (const phr of phrases) {
            let pos = 0;
            while ((pos = normText.indexOf(phr, pos)) !== -1) {
                totalCount++;
                if (firstMatch === -1 || pos < firstMatch) {
                    firstMatch = pos;
                    matchLen = phr.length;
                }
                pos += phr.length;
            }
        }

        // Tokentreffer pruefen
        for (const tok of tokens) {
            if (tok.length < 2) continue;
            let pos = 0;
            while ((pos = normText.indexOf(tok, pos)) !== -1) {
                totalCount++;
                if (firstMatch === -1 || pos < firstMatch) {
                    firstMatch = pos;
                    matchLen = tok.length;
                }
                pos += tok.length;
            }
        }

        if (firstMatch === -1) {
            const fallback = escapeHtml(rawText.slice(0, 160).replace(/\s+/g, ' ').trim());
            return {
                snippetHtml: fallback + (rawText.length > 160 ? '…' : ''),
                matchCount: 0,
                bestIndex: 0
            };
        }

        // Kontext-Fenster um den ersten/besten Treffer
        let start = Math.max(0, firstMatch - 65);
        let end = Math.min(rawText.length, firstMatch + matchLen + 145);

        // An Wortgrenzen ausrichten
        if (start > 0) {
            const spaceIdx = rawText.indexOf(' ', start);
            if (spaceIdx !== -1 && spaceIdx < start + 25) start = spaceIdx + 1;
        }
        if (end < rawText.length) {
            const spaceIdx = rawText.lastIndexOf(' ', end);
            if (spaceIdx !== -1 && spaceIdx > end - 25) end = spaceIdx;
        }

        let slice = rawText.slice(start, end).replace(/\s+/g, ' ').trim();
        let escaped = escapeHtml(slice);

        // Highlighting aller Treffer
        for (const tok of tokens) {
            if (tok.length < 2) continue;
            const re = new RegExp('(' + escapeRegex(escapeHtml(tok)) + ')', 'gi');
            escaped = escaped.replace(re, '<mark class="search-highlight">$1</mark>');
        }

        const snippetHtml = (start > 0 ? '…' : '') + escaped + (end < rawText.length ? '…' : '');
        return {
            snippetHtml: snippetHtml,
            matchCount: totalCount,
            bestIndex: 0
        };
    }

    // 4. Multikriterielle BM25-inspirierte Suche
    function search(documents, fullTexts, normTexts, rawQuery, activeFilters) {
        const startTime = performance.now();
        const queryObj = parseQuery(rawQuery);
        const tokens = queryObj.allTokens;
        const phrases = queryObj.phrases;
        const mustTokens = queryObj.mustTokens;
        const shouldTokens = queryObj.shouldTokens;
        const mustNotTokens = queryObj.mustNotTokens;
        const queryFilters = queryObj.filters;

        const countByPillar = {
            all: 0,
            house: 0,
            books: 0,
            compilations: 0,
            ruhi: 0
        };

        if (tokens.length === 0 && phrases.length === 0 && Object.keys(queryFilters).length === 0) {
            return {
                results: documents,
                stats: { totalMatches: documents.length, tookMs: 0, countByPillar },
                queryObj
            };
        }

        const matched = [];

        for (let i = 0; i < documents.length; i++) {
            const d = documents[i];
            const rawText = (fullTexts && fullTexts[d.id]) || d.text || '';
            const normText = (normTexts && normTexts[d.id]) || (d.text ? normalize(d.text) : '');

            const titleNorm = normalize(d.title || '');
            const deTitleNorm = normalize(d.deTitle || '');
            const enTitleNorm = normalize(d.enTitle || '');
            const authorNorm = normalize(d.author || '');
            const recNorm = normalize(d.recipientLabel || d.recipient || '');
            const topicsNorm = normalize(Array.isArray(d.topics) ? d.topics.join(' ') : '');
            const typeNorm = normalize(d.type || '');
            const excerptNorm = normalize(d.excerpt || '');
            const dateStr = String(d.date || '') + ' ' + String(d.year || '');

            // A. Ausschluss-Filter (-Wort)
            if (mustNotTokens.length > 0) {
                let excluded = false;
                for (const notTok of mustNotTokens) {
                    if (titleNorm.includes(notTok) || normText.includes(notTok) || authorNorm.includes(notTok) || topicsNorm.includes(notTok)) {
                        excluded = true;
                        break;
                    }
                }
                if (excluded) continue;
            }

            // B. Inline-Feld-Filter (autor:, jahr:, typ:, saeule:)
            if (queryFilters.author && !authorNorm.includes(queryFilters.author)) continue;
            if (queryFilters.year && !dateStr.includes(String(queryFilters.year))) continue;
            if (queryFilters.type && !typeNorm.includes(queryFilters.type)) continue;
            if (queryFilters.pillar) {
                const targetP = queryFilters.pillar;
                const dTier = (d.tier || '').toLowerCase();
                if (targetP === 'buecher' || targetP === 'books') {
                    if (dTier !== 'books') continue;
                } else if (targetP === 'botschaften' || targetP === 'house') {
                    if (dTier !== 'house' && dTier !== 'institutions') continue;
                } else if (targetP === 'kompilationen' || targetP === 'compilations') {
                    if (dTier !== 'compilations') continue;
                } else if (targetP === 'ruhi') {
                    if (dTier !== 'ruhi') continue;
                }
            }

            // C. Exakte Phrasenpruefung ("...")
            let phraseMatched = false;
            if (phrases.length > 0) {
                let allPhrasesFound = true;
                for (const phr of phrases) {
                    const inTitle = titleNorm.includes(phr) || deTitleNorm.includes(phr) || enTitleNorm.includes(phr);
                    const inText = normText && normText.includes(phr);
                    const inExcerpt = excerptNorm.includes(phr);
                    if (!inTitle && !inText && !inExcerpt) {
                        allPhrasesFound = false;
                        break;
                    }
                }
                if (!allPhrasesFound) continue;
                phraseMatched = true;
            }

            // D. Relevanzbewertung & Token-Matching
            let score = 0;
            let matchedTermsCount = 0;
            let inTextMatch = false;

            // 1. Phrasen-Treffer-Bonus
            if (phraseMatched) {
                score += 250;
            }

            // 2. Token-Matching & Multi-Field-Scoring
            for (const tok of tokens) {
                let tokFound = false;

                // Titel (Sehr hohes Gewicht)
                if (titleNorm.includes(tok)) {
                    score += 130;
                    tokFound = true;
                } else if (deTitleNorm.includes(tok) || enTitleNorm.includes(tok)) {
                    score += 100;
                    tokFound = true;
                }

                // Themen / Topics
                if (topicsNorm.includes(tok)) {
                    score += 80;
                    tokFound = true;
                }

                // Autor / Empfaenger
                if (authorNorm.includes(tok) || recNorm.includes(tok)) {
                    score += 70;
                    tokFound = true;
                }

                // Auszug / Excerpt
                if (excerptNorm.includes(tok)) {
                    score += 50;
                    tokFound = true;
                }

                // Volltext-Term-Haeufigkeit mit Saettigungskurve (BM25-artig)
                if (normText && normText.includes(tok)) {
                    tokFound = true;
                    inTextMatch = true;
                    let count = 0;
                    let pos = 0;
                    while ((pos = normText.indexOf(tok, pos)) !== -1) {
                        count++;
                        pos += tok.length;
                        if (count >= 15) break;
                    }
                    score += 20 + Math.min(55, Math.round(Math.log2(count + 1) * 18));
                }

                if (tokFound) {
                    matchedTermsCount++;
                }
            }

            // Pruefen, ob Pflicht-Terme erfuellt sind
            if (mustTokens.length > 0) {
                if (tokens.length <= 3) {
                    if (matchedTermsCount < tokens.length) continue;
                } else {
                    if ((matchedTermsCount / tokens.length) < 0.7) continue;
                }
            } else if (shouldTokens.length > 0) {
                if (matchedTermsCount === 0 && !phraseMatched) continue;
            }

            if (score <= 0 && !phraseMatched) continue;

            // Vollstaendigkeitsbonus (wenn 100 % aller Suchwoerter vorkommen)
            if (tokens.length > 1 && matchedTermsCount === tokens.length) {
                score += 80;
            }

            // Schluessel-Botschaften-Bonus (autorisierte Meilensteine)
            if (d.isMilestone) {
                score += 20;
            }

            // Snippet extrahieren
            const snippetResult = (inTextMatch || normText) 
                ? findBestSnippet(rawText, normText, queryObj)
                : { snippetHtml: d.excerpt ? escapeHtml(d.excerpt) : '', matchCount: 0, bestIndex: 0 };

            d._searchScore = score;
            d._searchSnippet = snippetResult.snippetHtml;
            d._searchMatchCount = snippetResult.matchCount;

            // Zaehlung nach Saeulen fuer Schnellfilter-Pills
            countByPillar.all++;
            const tier = (d.tier || '').toLowerCase();
            if (tier === 'house' || tier === 'institutions') countByPillar.house++;
            else if (tier === 'books') countByPillar.books++;
            else if (tier === 'compilations') countByPillar.compilations++;
            else if (tier === 'ruhi') countByPillar.ruhi++;

            matched.push(d);
        }

        // Sortierung nach Relevanz (Score absteigend, sekundaer Datum)
        matched.sort((a, b) => {
            const diff = (b._searchScore || 0) - (a._searchScore || 0);
            if (diff !== 0) return diff;
            return (b.date || '').localeCompare(a.date || '');
        });

        const tookMs = Math.round((performance.now() - startTime) * 10) / 10;

        return {
            results: matched,
            stats: {
                totalMatches: matched.length,
                tookMs: tookMs,
                countByPillar: countByPillar
            },
            queryObj: queryObj
        };
    }

    // 5. Autocomplete & Suchvorschlaege
    function suggest(rawQuery, documents, maxResults) {
        if (!rawQuery || rawQuery.trim().length < 2) return [];
        const limit = maxResults || 6;
        const qNorm = normalize(rawQuery);
        const suggestions = [];
        const seenTitles = new Set();

        for (const d of documents) {
            const title = (d.deTitle || d.title) || '';
            const titleNorm = normalize(title);
            if (titleNorm.includes(qNorm) && !seenTitles.has(title)) {
                seenTitles.add(title);
                suggestions.push({
                    type: 'title',
                    title: title,
                    sub: d.date || d.year || d.author || '',
                    id: d.id,
                    tier: d.tier || 'house'
                });
                if (suggestions.length >= limit) break;
            }
        }

        return suggestions;
    }

    return {
        normalize: normalize,
        parseQuery: parseQuery,
        search: search,
        findBestSnippet: findBestSnippet,
        suggest: suggest
    };
})();
