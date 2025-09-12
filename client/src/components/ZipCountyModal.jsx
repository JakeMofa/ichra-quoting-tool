// src/components/ZipCountyModal.jsx
import { useEffect, useState } from 'react';
import { getCountyNamesByIds, getCountyCandidatesByZip } from '../api/counties';

// member: { memberId, first_name, last_name, zip_code, county_ids? }
// onCancel(): void
// onSelect(countyId: string): void
export default function ZipCountyModal({ open, member, onCancel, onSelect }) {
  const [labels, setLabels] = useState({});
  const [candidates, setCandidates] = useState([]);
  const [manualCounty, setManualCounty] = useState('');

  const name = member ? `${member.first_name || ''} ${member.last_name || ''}`.trim() : '';

  useEffect(() => {
    if (!open) return;
    setManualCounty('');
    // Prefer explicit county_ids on member if present
    const ids = Array.isArray(member?.county_ids) ? member.county_ids : [];
    if (ids.length) {
      getCountyNamesByIds(ids).then(setLabels).catch(() => setLabels({}));
      setCandidates(ids);
      return;
    }
    // else: try to fetch by zip (optional backend route)
    if (member?.zip_code) {
      getCountyCandidatesByZip(member.zip_code)
        .then(({ ids, map }) => {
          setCandidates(ids || []);
          setLabels(map || {});
        })
        .catch(() => { setCandidates([]); setLabels({}); });
    }
  }, [open, member]);

  if (!open) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>Choose County</h3>
        <p>
          The ZIP for <b>{name || 'this member'}</b> requires a county selection.
          {member?.zip_code ? <> (ZIP <code>{member.zip_code}</code>)</> : null}
        </p>

        {candidates.length > 0 ? (
          <div className="chips" style={{ marginTop: 10 }}>
            {candidates.map((id) => (
              <button key={id} className="chip" onClick={() => onSelect(id)}>
                {labels[id] || id}
              </button>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 10 }}>
            <div className="label">Enter county_id (FIPS-like)</div>
            <div className="row" style={{ marginTop: 6 }}>
              <input
                className="input"
                placeholder="e.g. 41051"
                value={manualCounty}
                onChange={(e) => setManualCounty(e.target.value.trim())}
              />
              <button disabled={!manualCounty} onClick={() => onSelect(manualCounty)}>Use County</button>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>
              Tip: if you add <code>GET /counties?zip=ZIP</code> on the backend, we’ll list choices here automatically.
            </div>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
