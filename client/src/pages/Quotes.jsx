// src/pages/Quotes.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import Stepper from '../components/Stepper';
import ZipCountyModal from '../components/ZipCountyModal';

function memberDisplay(m) {
  if (!m) return '';
  const n = `${m.first_name || ''} ${m.last_name || ''}`.trim();
  return n || m._id || 'Member';
}

export default function Quotes() {
  const { groupId } = useParams();

  // inputs (these are the only ones that change the batch signature)
  const [effectiveDate, setEffectiveDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [tobacco, setTobacco] = useState(false);

  // ui state
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [progressMsg, setProgressMsg] = useState('');

  // data
  const [batch, setBatch] = useState(null);        // result of GET /quotes (or POST /quotes -> result)
  const [activeMember, setActiveMember] = useState(null); // for county selection

  // polling cancel
  const pollAbortRef = useRef(null);

  // ---- helpers ----
  const entries = useMemo(() => Array.isArray(batch?.quotes) ? batch.quotes : [], [batch]);
  const nextSkipped = useMemo(() => entries.find(e => e?.meta?.skipped === true), [entries]);
  const allResolved = entries.length > 0 && entries.every(e => e?.meta?.skipped !== true);
  const anyQuotes   = entries.some(e => Array.isArray(e?.quotes) && e.quotes.length > 0);

  // A tiny signature so we know if inputs changed
  const signature = `${effectiveDate}|${tobacco ? 1 : 0}`;
  const sigKey = `quotes:lastSignature:${groupId}`;

  // ---------- initial load: pull existing quotes, maybe auto-run ----------
  useEffect(() => {
    let mounted = true;
    (async () => {
      setError('');
      setProgressMsg('Loading latest quotes…');
      try {
        const latest = await api.quotesLatest(groupId);
        if (!mounted) return;

        const list = Array.isArray(latest?.quotes) ? latest.quotes : [];

        if (list.length > 0) {
          // We already have quotes – show them immediately.
          setBatch(latest);
          setProgressMsg('');
        } else {
          // No quotes yet → try to auto-run using current inputs
          const lastSig = localStorage.getItem(sigKey);
          if (lastSig !== signature) {
            await safeRunQuotes(); // fire-and-poll
          } else {
            setProgressMsg('No quotes yet. Click “Run Quotes”.');
          }
        }
      } catch {
        // If GET /quotes fails because server is still building something, start a poll anyway
        setProgressMsg('Preparing quotes…');
        try {
          await pollUntilReady({});
        } catch (e) {
          setError(e.message || 'Could not load quotes.');
        }
      }
    })();
    return () => { mounted = false; if (pollAbortRef.current) pollAbortRef.current.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]); // run once per group

  // ---------- auto / prompt county resolution ----------
  useEffect(() => {
    if (!nextSkipped) { setActiveMember(null); return; }

    const ids = Array.isArray(nextSkipped?.meta?.county_ids) ? nextSkipped.meta.county_ids : [];
    const m = nextSkipped.member || {};
    const enriched = { memberId: m._id, first_name: m.first_name, last_name: m.last_name, zip_code: m.zip_code, county_ids: ids };

    if (ids.length === 1) {
      (async () => {
        try {
          await api.previewQuotes(groupId, {
            member_id: enriched.memberId,
            county_id: ids[0],
            effective_date: effectiveDate,
            tobacco,
          });
          const latest = await api.quotesLatest(groupId);
          setBatch(latest || null);
          setActiveMember(null);
        } catch (e) {
          setError(e.message || 'Failed to preview quotes for selected county');
        }
      })();
    } else {
      setActiveMember(enriched);
    }
  }, [nextSkipped, groupId, effectiveDate, tobacco]);

  // ---------- run + poll (smart) ----------
  async function pollUntilReady({ intervalMs = 1200, maxMs = 120000 }) {
    if (pollAbortRef.current) pollAbortRef.current.abort();
    const ac = new AbortController();
    pollAbortRef.current = ac;

    const start = Date.now();
    let attempt = 0;
    while (!ac.signal.aborted) {
      attempt += 1;
      try {
        const latest = await api.quotesLatest(groupId);
        const list = Array.isArray(latest?.quotes) ? latest.quotes : [];
        const done = list.length > 0 && (list.some(e => Array.isArray(e?.quotes) && e.quotes.length > 0) || list.every(e => e?.meta?.skipped !== true));
        setBatch(latest || null);
        if (done) return true;
      } catch {
        // ignore and keep polling
      }

      if (Date.now() - start > maxMs) {
        throw new Error('Quotes are taking longer than expected. Please check again shortly.');
      }
      setProgressMsg(`Preparing quotes… (attempt ${attempt})`);
      await new Promise(r => setTimeout(r, intervalMs));
    }
    return false;
  }

  async function safeRunQuotes() {
    setRunning(true);
    setError('');
    setProgressMsg('Starting quotes job…');
    setBatch(null);

    try {
      // Fire the job. If the request times out (backend busy), still poll.
      try {
        await api.runQuotes(groupId, {
          effective_date: effectiveDate,
          tobacco,
          rating_area_location: 'work',
          // prevent backend from kicking ICHRA again:
          skip_ichra: true,
        });
      } catch {
        // swallow network abort/timeout here — polling will pick up status
      }

      await pollUntilReady({});
      localStorage.setItem(sigKey, signature);
      setProgressMsg('');
    } catch (e) {
      setError(e.message || 'Failed to run quotes');
    } finally {
      setRunning(false);
    }
  }

  async function runQuotes() {
    // If we already have quotes for this exact signature, just refresh latest and show
    const lastSig = localStorage.getItem(sigKey);
    if (lastSig === signature) {
      setProgressMsg('Loading existing quotes…');
      try {
        const latest = await api.quotesLatest(groupId);
        setBatch(latest || null);
        setProgressMsg('');
        return;
      } catch {
        // fall through to full run if GET fails
      }
    }
    await safeRunQuotes();
  }

  async function resolveCounty(countyId) {
    if (!activeMember?.memberId) return;
    try {
      setError('');
      const preview = await api.previewQuotes(groupId, {
        member_id: activeMember.memberId,
        county_id: countyId,
        effective_date: effectiveDate,
        tobacco,
      });

      // merge into UI immediately
      setBatch(prev => {
        if (!prev) return prev;
        const quotes = Array.isArray(prev.quotes) ? [...prev.quotes] : [];
        const idx = quotes.findIndex(q => q?.member?._id === activeMember.memberId);
        if (idx !== -1) {
          const prevEntry = quotes[idx] || {};
          quotes[idx] = {
            ...prevEntry,
            meta: { ...(prevEntry.meta || {}), skipped: false, county_id: preview?.meta?.county_id || countyId },
            quotes: Array.isArray(preview?.quotes) ? preview.quotes : [],
          };
        }
        return { ...prev, quotes };
      });

      setActiveMember(null);
    } catch (e) {
      setError(e.message || 'Failed to preview quotes for selected county');
    }
  }

  // ------- AFTER RESOLVE: refresh with GET only (no re-POST that restarts ICHRA) -------
  useEffect(() => {
    (async () => {
      if (!(entries.length > 0 && entries.every(e => e?.meta?.skipped !== true))) return;
      try {
        const latest = await api.quotesLatest(groupId);
        setBatch(latest || null);
      } catch {
        /* no-op */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries]);

  return (
    <div className="card">
      <Stepper />
      <h2>Run Quotes</h2>

      <div className="row" style={{ marginBottom: 10, alignItems: 'center' }}>
        <label className="label" style={{ marginRight: 8 }}>Effective Date</label>
        <input
          type="date"
          className="input"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
        />
        <label className="label" style={{ marginLeft: 12 }}>Tobacco</label>
        <input
          type="checkbox"
          checked={tobacco}
          onChange={(e) => setTobacco(e.target.checked)}
          style={{ transform: 'scale(1.2)', marginLeft: 6 }}
        />

        <button onClick={runQuotes} disabled={running} style={{ marginLeft: 12 }}>
          {running ? 'Preparing…' : 'Run Quotes'}
        </button>

        {(allResolved || anyQuotes) && (
          <Link to={`/groups/${groupId}/summary`} className="chip" style={{ marginLeft: 'auto' }}>
            Go to Summary →
          </Link>
        )}
      </div>

      {(error || progressMsg) && (
        <div
          className="card"
          style={{ borderColor: error ? '#7f1d1d' : '#1e3a8a', color: error ? '#fecaca' : '#bfdbfe' }}
        >
          {error || progressMsg}
        </div>
      )}

      {/* quick debug surface */}
      {entries.length > 0 && (
        <div className="card">
          <div className="label">Latest Batch (trimmed view)</div>
          <ul className="list">
            {entries.map((e, idx) => {
              const m = e.member;
              const name = memberDisplay(m);
              const count = e?.quotes?.length || 0;
              const ids = Array.isArray(e?.meta?.county_ids) ? e.meta.county_ids : [];
              const status = e?.meta?.skipped
                ? (ids.length > 1 ? 'Needs county (pick one)' : 'Resolving…')
                : `${count} plans${ids.length === 1 ? ' (auto-generated )' : ''}`;
              return <li key={idx}><b>{name}</b> — {status}</li>;
            })}
          </ul>
          <details style={{ marginTop: 8 }}>
            <summary className="muted">Raw (debug)</summary>
            <pre className="pre" style={{ maxHeight: 280 }}>{JSON.stringify(batch, null, 2)}</pre>
          </details>
        </div>
      )}

      {/* ZIP → county modal (only when multiple choices) */}
      <ZipCountyModal
        open={!!activeMember && Array.isArray(activeMember.county_ids) && activeMember.county_ids.length > 1}
        member={activeMember}
        onCancel={() => setActiveMember(null)}
        onSelect={resolveCounty}
      />
    </div>
  );
}