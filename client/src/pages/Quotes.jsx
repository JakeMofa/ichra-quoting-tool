// src/pages/Quotes.jsx
import { useEffect, useMemo, useState } from 'react';
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

  const [effectiveDate, setEffectiveDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [tobacco, setTobacco] = useState(false);

  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');

  const [batch, setBatch] = useState(null); // holds data.result from POST /quotes or GET /quotes
  const [activeMember, setActiveMember] = useState(null); // member needing county resolution

  // Extract per-member entries from current batch
  const entries = useMemo(() => {
    const arr = batch?.quotes || [];
    return Array.isArray(arr) ? arr : [];
  }, [batch]);

  // Find the next skipped member (meta.skipped === true)
  const nextSkipped = useMemo(() => {
    return entries.find((e) => e?.meta?.skipped === true);
  }, [entries]);

  // Auto-resolve if there's exactly ONE county_id; otherwise show the modal to pick
  useEffect(() => {
    if (!nextSkipped) {
      setActiveMember(null);
      return;
    }

    const ids = Array.isArray(nextSkipped?.meta?.county_ids) ? nextSkipped.meta.county_ids : [];
    const m = nextSkipped.member || {};
    const enriched = {
      memberId: m._id,
      first_name: m.first_name,
      last_name: m.last_name,
      zip_code: m.zip_code,
      county_ids: ids
    };

    if (ids.length === 1) {
      // Auto-pick the only county (no prompt)
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
      return;
    }

    // If multiple, prompt the user
    setActiveMember(enriched);
  }, [nextSkipped, groupId, effectiveDate, tobacco]);

  async function runQuotes() {
    setRunning(true);
    setError('');
    setBatch(null);
    try {
      const data = await api.runQuotes(groupId, {
        effective_date: effectiveDate,
        tobacco,
      });
      setBatch(data?.result || null);
    } catch (e) {
      setError(e.message || 'Failed to run quotes');
    } finally {
      setRunning(false);
    }
  }

  async function resolveCounty(countyId) {
    if (!activeMember?.memberId) return;
    try {
      setError('');
  
      // 1) Get the preview (this returns plans but doesn't change the latest batch on the server)
      const preview = await api.previewQuotes(groupId, {
        member_id: activeMember.memberId,
        county_id: countyId,
        effective_date: effectiveDate,
        tobacco,
      });
  
      // 2) Merge preview into current batch so the UI reflects the selection immediately
      setBatch((prev) => {
        if (!prev) return prev;
        const quotes = Array.isArray(prev.quotes) ? [...prev.quotes] : [];
        const idx = quotes.findIndex(q => q?.member?._id === activeMember.memberId);
        if (idx !== -1) {
          const prevEntry = quotes[idx] || {};
          quotes[idx] = {
            ...prevEntry,
            meta: {
              ...(prevEntry.meta || {}),
              skipped: false,
              county_id: preview?.meta?.county_id || countyId,
            },
            quotes: Array.isArray(preview?.quotes) ? preview.quotes : [],
          };
        }
        return { ...prev, quotes };
      });
  
      // 3) Close modal
      setActiveMember(null);
    } catch (e) {
      setError(e.message || 'Failed to preview quotes for selected county');
    }
  }

    // Add this effect in Quotes.jsx
  useEffect(() => {
    // when every entry is resolved (no meta.skipped), persist a real batch
    if (entries.length > 0 && entries.every(e => e?.meta?.skipped !== true)) {
      (async () => {
        try {
          await api.runQuotes(groupId, { effective_date: effectiveDate, tobacco });
          const latest = await api.quotesLatest(groupId);
          setBatch(latest || null);
        } catch (e) {
          setError(e.message || 'Failed to persist quotes after county resolution');
        }
      })();
    }
  }, [entries, groupId, effectiveDate, tobacco]);


  // derived
  const allResolved =
    entries.length > 0 && entries.every((e) => e?.meta?.skipped !== true);
  const anyQuotes = entries.some((e) => Array.isArray(e?.quotes) && e.quotes.length > 0);

  return (
    <div className="card">
      <Stepper />
      <h2>Run Quotes</h2>

      <div className="row" style={{ marginBottom: 10 }}>
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
          {running ? 'Running…' : 'Run Quotes'}
        </button>

        {(allResolved || anyQuotes) && (
          <Link to={`/groups/${groupId}/summary`} className="chip" style={{ marginLeft: 'auto' }}>
            Go to Summary →
          </Link>
        )}
      </div>

      {error && (
        <div className="card" style={{ borderColor: '#7f1d1d', color: '#fecaca' }}>
          {error}
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
                : `${count} plans${ids.length === 1 ? ' (auto-generated ✅)' : ''}`;
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

