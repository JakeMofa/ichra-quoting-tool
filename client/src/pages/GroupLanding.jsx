//  src/pages/GroupLanding.jsx
//  After create, navigates straight to /groups/:groupId/classes.
//  Also supports browsing all groups and deleting a group with a dry-run preview.
//
//  API used:
//    - POST   /groups                 (api.createGroup)
//    - GET    /groups                 (api.listGroups)
//    - DELETE /groups/:groupId        (api.deleteGroup with { mode, dry_run })
//    - GET    /groups/:groupId/members  <-- used here to validate an existing groupId
//
//  NOTE: Ensure your client API has:
//    listGroups: () => request('GET', `/groups`)
//    deleteGroup: (groupId, { mode='cascade', dry_run=false } = {}) =>
//        request('DELETE', `/groups/${groupId}?mode=${mode}&dry_run=${dry_run ? 'true' : 'false'}`)

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Stepper from '../components/Stepper';
import { api } from '../api';

export default function GroupLanding() {
  const nav = useNavigate();

  // Existing group path
  const [groupId, setGroupId] = useState('');
  const [goErr, setGoErr] = useState('');
  const [goLoading, setGoLoading] = useState(false);

  // Create new group path
  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  // Groups picker
  const [showPicker, setShowPicker] = useState(false);
  const [groups, setGroups] = useState([]);
  const [gLoading, setGLoading] = useState(false);
  const [gErr, setGErr] = useState('');
  const [query, setQuery] = useState('');

  // Delete modal state
  const [delOpen, setDelOpen] = useState(false);
  const [delLoading, setDelLoading] = useState(false);
  const [delErr, setDelErr] = useState('');
  const [delAcknowledge, setDelAcknowledge] = useState(false);
  const [delTarget, setDelTarget] = useState(null); // { _id, company_name, ... }
  const [delImpact, setDelImpact] = useState(null); // dry-run result

  // --- helpers ---------------------------------------------------------------
  function goTo(id, tab = 'quotes') {
    if (!id) return;
    if (tab === 'quotes') nav(`/groups/${id}/quotes`);
    else if (tab === 'members') nav(`/groups/${id}/members`);
    else if (tab === 'classes') nav(`/groups/${id}/classes`);
  }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); alert('Group ID copied'); }
    catch { /* noop */ }
  }

  // Validate a groupId exists by format + a lightweight fetch
  async function validateGroupId(id) {
    const trimmed = id.trim();
    // must be a 24-char hex Mongo ObjectId
    if (!/^[a-f\d]{24}$/i.test(trimmed)) {
      setGoErr('That does not look like a valid Group ID (must be 24 hex characters).');
      return false;
    }
    try {
      setGoLoading(true);
      setGoErr('');
      // listMembers is cheap and 404s if group missing
      await api.listMembers(trimmed);
      return true;
    } catch (e) {
      setGoErr(e?.message ? `Group not found: ${e.message}` : 'Group not found.');
      return false;
    } finally {
      setGoLoading(false);
    }
  }

  // --- existing group flow ---------------------------------------------------
  async function handleGo(defaultTab = 'quotes') {
    setGoErr('');
    const id = groupId.trim();
    if (!id) {
      setGoErr('Please enter a Group ID.');
      return;
    }
    const ok = await validateGroupId(id);
    if (!ok) return;
    goTo(id, defaultTab);
  }

  // --- create group flow -----------------------------------------------------
  async function handleCreate(e) {
    e.preventDefault();
    setCreateErr('');

    const payload = {
      company_name: companyName.trim(),
      contact_name: contactName.trim(),
      contact_email: contactEmail.trim(),
    };

    if (!payload.company_name || !payload.contact_name || !payload.contact_email) {
      setCreateErr('Company name, contact name, and contact email are required.');
      return;
    }

    try {
      setCreating(true);
      const created = await api.createGroup(payload); // POST /groups
      const id = created?.group?._id || created?._id;
      if (!id) throw new Error('Create group succeeded but no _id returned.');
      // After creating, send them to Classes first
      nav(`/groups/${id}/classes`);
    } catch (err) {
      setCreateErr(err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  }

  // --- groups picker (lazy fetch on open) -----------------------------------
  useEffect(() => {
    if (!showPicker) return;
    (async () => {
      try {
        setGLoading(true);
        setGErr('');
        const data = await api.listGroups?.();
        setGroups(Array.isArray(data) ? data : []);
      } catch (e) {
        setGErr(e.message || 'Failed to load groups');
      } finally {
        setGLoading(false);
      }
    })();
  }, [showPicker]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(g => {
      const hay = [
        g._id,
        g.company_name,
        g.contact_name,
        g.contact_email
      ].map(x => String(x || '').toLowerCase()).join(' ');
      return hay.includes(q);
    });
  }, [groups, query]);

  // --- delete flow -----------------------------------------------------------
  async function openDeleteModal(group) {
    setDelTarget(group);
    setDelImpact(null);
    setDelErr('');
    setDelAcknowledge(false);
    setDelOpen(true);

    // Fetch dry-run (preview impact)
    try {
      setDelLoading(true);
      const preview = await api.deleteGroup?.(group._id, { mode: 'cascade', dry_run: true });
      setDelImpact(preview?.impact || null);
    } catch (e) {
      setDelErr(e.message || 'Failed to preview deletion');
    } finally {
      setDelLoading(false);
    }
  }

  async function confirmDelete() {
    if (!delTarget?._id) return;
    setDelErr('');
    try {
      setDelLoading(true);
      await api.deleteGroup?.(delTarget._id, { mode: 'cascade', dry_run: false });
      // Refresh list
      const data = await api.listGroups?.();
      setGroups(Array.isArray(data) ? data : []);
      setDelOpen(false);
    } catch (e) {
      setDelErr(e.message || 'Failed to delete group');
    } finally {
      setDelLoading(false);
    }
  }

  return (
    <div className="card">
      <Stepper />

      <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Group</h2>
        <div style={{ flex: 1 }} />
        <button className="chip" onClick={() => setShowPicker(true)}>
          View all groups
        </button>
      </div>

      {/* Use existing Group ID */}
      <div className="card">
        <div className="label">Use existing Group ID</div>
        <p className="muted" style={{ marginTop: 4 }}>
          Paste your Mongo <code>groupId</code> to proceed.
        </p>

        <div className="row wrap" style={{ gap: 8, alignItems: 'end' }}>
          <input
            className="input"
            placeholder="e.g. 68c3039dd33451943e5cd0f4"
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            style={{ minWidth: 360 }}
            onKeyDown={async (e) => { if (e.key === 'Enter') { e.preventDefault(); await handleGo('quotes'); } }}
          />
          <button className="chip" onClick={() => handleGo('quotes')} disabled={!groupId.trim() || goLoading}>
            {goLoading ? 'Checking…' : 'Open Quotes'}
          </button>
          <button className="chip" onClick={() => handleGo('members')} disabled={!groupId.trim() || goLoading}>
            {goLoading ? 'Checking…' : 'Open Members'}
          </button>
          <button className="chip" onClick={() => handleGo('classes')} disabled={!groupId.trim() || goLoading}>
            {goLoading ? 'Checking…' : 'Open Classes'}
          </button>
        </div>

        {goErr && (
          <div className="card" style={{ marginTop: 8, borderColor: '#7f1d1d', color: '#fecaca' }}>
            {goErr}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="muted" style={{ textAlign: 'center', margin: '14px 0' }}>— or —</div>

      {/* Create a new group */}
      <div className="card">
        <div className="label">Create a new group</div>
        <form className="col" style={{ gap: 10, maxWidth: 520 }} onSubmit={handleCreate}>
          <label className="muted">Company name</label>
          <input
            className="input"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Inc (Run-007)"
          />

          <label className="muted">Contact name</label>
          <input
            className="input"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Ava Admin"
          />

          <label className="muted">Contact email</label>
          <input
            className="input"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="ava@acme.com"
          />

          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="chip" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Create group'}
            </button>
          </div>

          {createErr && (
            <div className="card" style={{ marginTop: 8, borderColor: '#7f1d1d', color: '#fecaca' }}>
              {createErr}
            </div>
          )}
        </form>
      </div>

      {/* Groups picker modal */}
      {showPicker && (
        <div className="modal-backdrop">
          <div className="modal" style={{ width: 1000, maxWidth: '95vw' }}>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
              <strong>All Groups</strong>
              <button className="chip" onClick={() => setShowPicker(false)}>Close</button>
            </div>

            <div className="row wrap" style={{ gap: 8, marginBottom: 8 }}>
              <input
                className="input"
                style={{ minWidth: 320 }}
                placeholder="Search company, contact, email, or ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div style={{ flex: 1 }} />
              {gLoading && <span className="muted">Loading…</span>}
            </div>

            {gErr && (
              <div className="card" style={{ borderColor: '#7f1d1d', color: '#fecaca', marginBottom: 8 }}>
                {gErr}
              </div>
            )}

            <div
              style={{
                maxHeight: '70vh',
                overflowY: 'auto',
                paddingRight: 4,
              }}
            >
              {!filtered.length && !gLoading && (
                <div className="muted" style={{ padding: 8 }}>No groups found.</div>
              )}

              <div className="row wrap" style={{ gap: 12 }}>
                {filtered.map(g => (
                  <div key={g._id} className="card" style={{ width: 300 }}>
                    <div className="label">{g.company_name || '—'}</div>
                    <div className="col" style={{ gap: 4 }}>
                      <div className="muted">Group ID</div>
                      <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                        <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{g._id}</code>
                        <button
                          className="chip"
                          type="button"
                          onClick={() => copy(g._id)}
                          title="Copy ID"
                        >
                          Copy
                        </button>
                      </div>

                      <div className="muted" style={{ marginTop: 6 }}>Contact</div>
                      <div>{g.contact_name || '—'}</div>
                      <div className="muted" style={{ fontSize: 12 }}>{g.contact_email || '—'}</div>

                      <div className="row" style={{ gap: 6, marginTop: 10 }}>
                        <button className="chip" onClick={() => goTo(g._id, 'quotes')}>Open Quotes</button>
                        <button className="chip" onClick={() => goTo(g._id, 'members')}>Members</button>
                        <button className="chip" onClick={() => goTo(g._id, 'classes')}>Classes</button>
                        <button
                          className="chip"
                          style={{ background:'#3b0a0a', borderColor:'#7f1d1d' }}
                          onClick={() => openDeleteModal(g)}
                          title="Delete group"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {delOpen && (
        <div className="modal-backdrop">
          <div className="modal" style={{ width: 720, maxWidth: '95vw' }}>
            <div className="row" style={{ justifyContent:'space-between', alignItems:'center', marginBottom: 10 }}>
              <strong>Delete “{delTarget?.company_name || delTarget?._id || 'this group'}”?</strong>
              <button className="chip" onClick={() => setDelOpen(false)}>Close</button>
            </div>

            <div className="col" style={{ gap: 8 }}>
              <p className="muted" style={{ marginTop: 0 }}>
                This will permanently remove the group and related data. This action cannot be undone.
              </p>

              {delLoading && <div className="muted">Loading preview…</div>}

              {delImpact && (
                <div className="card" style={{ marginTop: 4 }}>
                  <div className="label">What will be deleted (preview)</div>
                  <div className="row wrap" style={{ gap: 12, marginTop: 6 }}>
                    <div className="chip chip-muted">Members: {delImpact?.will_delete?.members ?? 0}</div>
                    <div className="chip chip-muted">Classes: {delImpact?.will_delete?.classes ?? 0}</div>
                    <div className="chip chip-muted">Affordability results: {delImpact?.will_delete?.affordability_results ?? 0}</div>
                    <div className="chip chip-muted">Dependents: embedded in members</div>
                  </div>
                </div>
              )}

              {delErr && (
                <div className="card" style={{ borderColor:'#7f1d1d', color:'#fecaca' }}>
                  {delErr}
                </div>
              )}

              <label className="row" style={{ gap: 8, alignItems:'center', marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={delAcknowledge}
                  onChange={e => setDelAcknowledge(e.target.checked)}
                />
                <span>I understand this will permanently delete this group and its related data.</span>
              </label>

              <div className="row" style={{ justifyContent:'flex-end', gap: 8, marginTop: 12 }}>
                <button className="chip" onClick={() => setDelOpen(false)} disabled={delLoading}>Cancel</button>
                <button
                  className="chip"
                  style={{ background:'#3b0a0a', borderColor:'#7f1d1d', opacity: delAcknowledge ? 1 : 0.6 }}
                  disabled={!delAcknowledge || delLoading}
                  onClick={confirmDelete}
                  title="Delete everything"
                >
                  {delLoading ? 'Deleting…' : 'Delete everything'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}