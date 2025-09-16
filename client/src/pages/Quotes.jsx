// src/pages/Quotes.jsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

  // inputs that change the "signature" of a quotes run
  const [effectiveDate, setEffectiveDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [tobacco, setTobacco] = useState(false);

  // ui state
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [progressMsg, setProgressMsg] = useState('');

  // data
  const [batch, setBatch] = useState(null);            // GET /quotes result
  const [activeMember, setActiveMember] = useState(null); // for county modal

  // polling / in-flight guards
  const pollAbortRef = useRef(null);
  const inFlight = useRef(null);   // { key, ctrl }
  const lastKey = useRef('');      // last successful GET key to avoid duplicate bursts

  // ---------- derived ----------
  const entries = useMemo(() => Array.isArray(batch?.quotes) ? batch.quotes : [], [batch]);
  const nextSkipped = useMemo(() => entries.find(e => e?.meta?.skipped === true), [entries]);
  const allResolved = entries.length > 0 && entries.every(e => e?.meta?.skipped !== true);
  const anyQuotes   = entries.some(e => Array.isArray(e?.quotes) && e.quotes.length > 0);

  const signature = `${effectiveDate}|${tobacco ? 1 : 0}`;
  const sigKey = `quotes:lastSignature:${groupId}`;

  // ---------- helpers ----------
  const fetchLatest = useCallback(async () => {
    if (!groupId) return;

    const key = `GET:${groupId}`;
    // If a same GET is in-flight, or we just fetched the same thing, bail.
    if (inFlight.current || lastKey.current === key) return;

    setError('');
    setProgressMsg((msg) => msg || 'Loading latest quotes…');

    const ctrl = new AbortController();
    inFlight.current = { key, ctrl };

    try {
      const latest = await api.quotesLatest(groupId, { signal: ctrl.signal });
      setBatch(latest || null);
      lastKey.current = key;
      setProgressMsg('');
    } catch (e) {
      if (e?.name !== 'AbortError') {
        setError(e?.message || 'Could not load quotes.');
      }
    } finally {
      // clear in-flight lock
      inFlight.current = null;
    }
  }, [groupId]);

  const cancelInFlight = useCallback(() => {
    inFlight.current?.ctrl?.abort();
    inFlight.current = null;
  }, []);

  // ---------- initial load (once per groupId) ----------
  useEffect(() => {
    setBatch(null);
    setError('');
    setProgressMsg('Loading latest quotes…');
    cancelInFlight();
    fetchLatest();

    return () => {
      cancelInFlight();
      if (pollAbortRef.current) {
        pollAbortRef.current.abort();
        pollAbortRef.current = null;
      }
    };
  }, [groupId, fetchLatest, cancelInFlight]);

  // ---------- resolve "needs county" automatically / via modal ----------
  useEffect(() => {
    if (!nextSkipped) { setActiveMember(null); return; }

    const ids = Array.isArray(nextSkipped?.meta?.county_ids) ? nextSkipped.meta.county_ids : [];
    const m = nextSkipped.member || {};
    const enriched = { memberId: m._id, first_name: m.first_name, last_name: m.last_name, zip_code: m.zip_code, county_ids: ids };

    if (ids.length === 1) {
      // auto-pick the only option, then refresh once
      (async () => {
        try {
          await api.previewQuotes(groupId, {
            member_id: enriched.memberId,
            county_id: ids[0],
            effective_date: effectiveDate,
            tobacco,
          });
          await fetchLatest(); // single refresh, no loop
          setActiveMember(null);
        } catch (e) {
          setError(e.message || 'Failed to preview quotes for selected county');
        }
      })();
    } else {
      setActiveMember(enriched);
    }
  }, [nextSkipped, groupId, effectiveDate, tobacco, fetchLatest]);

  // ---------- poller used only when a run is in progress ----------
  async function pollUntilReady({ intervalMs = 1200, maxMs = 120000 }) {
    if (pollAbortRef.current) pollAbortRef.current.abort();
    const ac = new AbortController();
    pollAbortRef.current = ac;

    const start = Date.now();
    let attempt = 0;

    while (!ac.signal.aborted) {
      attempt += 1;
      try {
        const latest = await api.quotesLatest(groupId, { signal: ac.signal });
        const list = Array.isArray(latest?.quotes) ? latest.quotes : [];
        const done =
          list.length > 0 &&
          (list.some(e => Array.isArray(e?.quotes) && e.quotes.length > 0) ||
           list.every(e => e?.meta?.skipped !== true));

        setBatch(latest || null);
        if (done) return true;
      } catch (e) {
        if (e?.name === 'AbortError') return false; // canceled
        // else ignore and keep polling
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
    cancelInFlight(); // ensure GET de-dupe doesn’t block us

    try {
      // Fire-and-forget kick; polling will pick it up even if this times out.
      try {
        await api.runQuotes(groupId, {
          effective_date: effectiveDate,
          tobacco,
          rating_area_location: 'work',
          skip_ichra: true, // don't re-run ICHRA calc if server can reuse it
        });
      } catch {
        /* swallow; poller will catch status */
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
    // Quick path: if same inputs already have results, just fetch latest once.
    const lastSig = localStorage.getItem(sigKey);
    if (lastSig === signature) {
      setProgressMsg('Loading existing quotes…');
      await fetchLatest();
      setProgressMsg('');
      return;
    }
    await safeRunQuotes();
  }

  async function resolveCounty(countyId) {
    if (!activeMember?.memberId) return;
    try {
      setError('');
      await api.previewQuotes(groupId, {
        member_id: activeMember.memberId,
        county_id: countyId,
        effective_date: effectiveDate,
        tobacco,
      });
      // A single refresh (no effect chained to entries)
      await fetchLatest();
      setActiveMember(null);
    } catch (e) {
      setError(e.message || 'Failed to preview quotes for selected county');
    }
  }

  return (
    <div className="card">
      <Stepper />
      <h2>Run Quotes</h2>

      <div className="row" style={{ marginBottom: 10, alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <label className="label" style={{ marginRight: 8 }}>Effective Date</label>
        <input
          type="date"
          className="input"
          value={effectiveDate}
          onChange={(e) => setEffectiveDate(e.target.value)}
          style={{ minWidth: 220 }}
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