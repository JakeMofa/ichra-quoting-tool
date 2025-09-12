//  Manage ICHRA classes & sub-classes with collapsible groups.
// Endpoints:
//  - GET    /groups/:groupId/classes
//  - POST   /groups/:groupId/classes
//  - PATCH  /groups/:groupId/classes/:classId
//  - DELETE /groups/:groupId/classes/:classId

import { useEffect, useMemo, useState, Fragment } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import Stepper from '../components/Stepper';

function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

export default function Classes() {
  const { groupId } = useParams();
  const nav = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [classes, setClasses] = useState([]);

  // create form state
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [subLabel, setSubLabel] = useState('');
  const [empAmt, setEmpAmt] = useState('');
  const [depAmt, setDepAmt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');

  // UI: expand/collapse groups
  const [expanded, setExpanded] = useState({});

  async function load() {
    if (!groupId) return;
    try {
      setErr('');
      setLoading(true);
      const list = await api.listClasses(groupId);
      setClasses(Array.isArray(list) ? list : []);

      // expand groups that have children by default
      const exp = {};
      (Array.isArray(list) ? list : []).forEach(c => {
        if (!c.parent_class && list.some(x => x.parent_class === c._id)) exp[c._id] = true;
      });
      setExpanded(exp);
    } catch (e) {
      setErr(e.message || 'Failed to load classes');
      setClasses([]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [groupId]);

  const baseClasses = useMemo(() => classes.filter(c => !c?.parent_class), [classes]);

  const childrenByParent = useMemo(() => {
    const m = {};
    classes.forEach(c => { if (c.parent_class) (m[c.parent_class] ??= []).push(c); });
    Object.values(m).forEach(arr => arr.sort((a, b) => (a.subclass || '').localeCompare(b.subclass || '')));
    return m;
  }, [classes]);

  function onChangeParent(e) {
    const pid = e.target.value;
    setParentId(pid);
    if (pid) {
      const p = baseClasses.find(b => b._id === pid);
      if (p?.name && (!name || baseClasses.some(b => b.name === name))) setName(p.name);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateErr('');
    const body = {
      name: (name || '').trim(),
      employee_contribution: toNum(empAmt),
      dependent_contribution: toNum(depAmt),
    };
    if (parentId) {
      body.parent_class = parentId;
      body.subclass = (subLabel || '').trim();
      if (!body.name) {
        const p = baseClasses.find(b => b._id === parentId);
        if (p?.name) body.name = p.name;
      }
    }
    if (!body.name) { setCreateErr('Name is required.'); return; }

    try {
      setCreating(true);
      await api.createClass(groupId, body);
      setName(''); setParentId(''); setSubLabel(''); setEmpAmt(''); setDepAmt('');
      await load();
    } catch (e) {
      setCreateErr(e.message || 'Failed to create class');
    } finally {
      setCreating(false);
    }
  }

  async function saveRow(c) {
    try {
      await api.updateClass(groupId, c._id, {
        name: c.name,
        employee_contribution: toNum(c.employee_contribution),
        dependent_contribution: toNum(c.dependent_contribution),
      });
      await load();
    } catch (e) { alert(e.message || 'Failed to update class'); }
  }

  async function delRow(id) {
    if (!window.confirm('Delete this class?')) return;
    try { await api.deleteClass(groupId, id); await load(); }
    catch (e) { alert(e.message || 'Failed to delete class'); }
  }

  function RowEditor({ c, isChild = false }) {
    return (
      <div className="trow" key={c._id} style={isChild ? { background: 'rgba(255,255,255,0.02)' } : undefined}>
        <div>
          <input
            className="input"
            value={c.name || ''}
            onChange={e => setClasses(cs => cs.map(x => x._id === c._id ? { ...x, name: e.target.value } : x))}
          />
          {c.subclass && (
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Sub-class: <span className="chip chip-on">{c.subclass}</span>
            </div>
          )}
        </div>
        <div>
          {c.parent_class
            ? (classes.find(x => x._id === c.parent_class)?.name || c.parent_class)
            : <span className="muted">—</span>}
        </div>
        <div>
          <input
            className="input"
            value={c.employee_contribution ?? ''}
            onChange={e => setClasses(cs => cs.map(x => x._id === c._id ? { ...x, employee_contribution: e.target.value } : x))}
          />
        </div>
        <div>
          <input
            className="input"
            value={c.dependent_contribution ?? ''}
            onChange={e => setClasses(cs => cs.map(x => x._id === c._id ? { ...x, dependent_contribution: e.target.value } : x))}
          />
        </div>
        <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
          <button className="chip" onClick={() => saveRow(c)}>Save</button>
          <button className="chip" onClick={() => delRow(c._id)}>Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <Stepper />

      <div className="row" style={{ alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Classes</h2>
        <div style={{ flex: 1 }} />
        <Link to={`/groups/${groupId}/quotes`} className="link">Go to Quotes →</Link>
      </div>

      {/* CREATE FORM */}
      <div className="card" style={{ opacity: loading ? 0.7 : 1 }}>
        <div className="label">Create a class</div>

        {/* first row: 3 fields side-by-side responsively */}
        <form className="col" onSubmit={handleCreate} style={{ gap: 10, maxWidth: 900 }}>
          <div className="form-grid-3">
            <div className="col">
              <label className="muted">Name (base class)</label>
              <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Full-time" />
            </div>

            <div className="col">
              <label className="muted">Parent (optional → creates sub-class)</label>
              <select className="input" value={parentId} onChange={onChangeParent}>
                <option value="">— none (base class) —</option>
                {baseClasses.map(b => (
                  <option key={b._id} value={b._id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="col">
              <label className="muted">Sub-class label (optional)</label>
              <input className="input" value={subLabel} onChange={e => setSubLabel(e.target.value)} placeholder="Age 30–39" />
            </div>
          </div>

          {/* second row: 2 fields side-by-side responsively */}
          <div className="form-grid-2" style={{ marginTop: 10 }}>
            <div className="col">
              <label className="muted">Employee contribution (mo)</label>
              <input className="input" value={empAmt} onChange={e => setEmpAmt(e.target.value)} placeholder="450" />
            </div>
            <div className="col">
              <label className="muted">Dependent contribution (mo)</label>
              <input className="input" value={depAmt} onChange={e => setDepAmt(e.target.value)} placeholder="100" />
            </div>
          </div>

          <div className="row" style={{ gap: 8, marginTop: 10 }}>
            <button className="chip" type="submit" disabled={creating}>
              {creating ? 'Creating…' : 'Add class'}
            </button>
          </div>

          {createErr && (
            <div className="card" style={{ marginTop: 8, borderColor: '#7f1d1d', color: '#fecaca' }}>
              {createErr}
            </div>
          )}
        </form>
      </div>

      {/* EXISTING LIST */}
      <div className="card" style={{ marginTop: 12, opacity: loading ? 0.7 : 1 }}>
        <div className="label">Existing classes</div>
        {err && <div className="card" style={{ borderColor: '#7f1d1d', color: '#fecaca' }}>{err}</div>}
        {!classes.length && <div className="muted">No classes yet.</div>}

        {!!classes.length && (
          <>
            <div className="row wrap" style={{ gap: 8, margin: '6px 0 12px' }}>
              {baseClasses.map(b => {
                const kids = childrenByParent[b._id] || [];
                const on = !!expanded[b._id];
                return (
                  <button
                    key={`sum-${b._id}`}
                    className={`chip ${on ? 'chip-on' : ''}`}
                    onClick={() => setExpanded(s => ({ ...s, [b._id]: !on }))}
                    title={`${b.name}: ${kids.length} sub-class(es)`}
                  >
                    <span style={{ marginRight: 6 }}>{on ? '▾' : '▸'}</span>
                    {b.name}
                    {kids.length > 0 && <span className="chip" style={{ marginLeft: 6 }}>{kids.length} sub</span>}
                  </button>
                );
              })}
              <div style={{ flex: 1 }} />
              <button className="chip" onClick={() => {
                const all = {}; baseClasses.forEach(b => { all[b._id] = true; }); setExpanded(all);
              }}>Expand all</button>
              <button className="chip" onClick={() => setExpanded({})}>Collapse all</button>
            </div>

            <div className="scroll-x">
              <div className="table minw-820" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr 0.8fr' }}>
                <div className="thead">
                  <div>Name</div>
                  <div>Parent</div>
                  <div>Employee (mo)</div>
                  <div>Dependents (mo)</div>
                  <div></div>
                </div>

                {baseClasses.map(parent => {
                  const kids = childrenByParent[parent._id] || [];
                  const open = !!expanded[parent._id];
                  return (
                    <Fragment key={`grp-${parent._id}`}>
                      <div className="trow" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div className="row" style={{ alignItems: 'center', gap: 8 }}>
                          <button
                            type="button"
                            className="chip"
                            onClick={() => setExpanded(s => ({ ...s, [parent._id]: !open }))}
                            title={open ? 'Collapse' : 'Expand'}
                          >
                            {open ? '▾' : '▸'}
                          </button>
                          <input
                            className="input"
                            value={parent.name || ''}
                            onChange={e => setClasses(cs => cs.map(x => x._id === parent._id ? { ...x, name: e.target.value } : x))}
                            style={{ flex: 1 }}
                          />
                        </div>
                        <div><span className="muted">—</span></div>
                        <div>
                          <input
                            className="input"
                            value={parent.employee_contribution ?? ''}
                            onChange={e => setClasses(cs => cs.map(x => x._id === parent._id ? { ...x, employee_contribution: e.target.value } : x))}
                          />
                        </div>
                        <div>
                          <input
                            className="input"
                            value={parent.dependent_contribution ?? ''}
                            onChange={e => setClasses(cs => cs.map(x => x._id === parent._id ? { ...x, dependent_contribution: e.target.value } : x))}
                          />
                        </div>
                        <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                          <button className="chip" onClick={() => saveRow(parent)}>Save</button>
                          <button className="chip" onClick={() => delRow(parent._id)}>Delete</button>
                        </div>
                      </div>

                      {open && kids.map(child => (
                        <RowEditor key={child._id} c={child} isChild />
                      ))}
                    </Fragment>
                  );
                })}

                {classes
                  .filter(c => c.parent_class && !baseClasses.find(b => b._id === c.parent_class))
                  .map(orphan => <RowEditor key={`orphan-${orphan._id}`} c={orphan} isChild />)}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="row" style={{ marginTop: 14 }}>
        <button className="chip" onClick={() => nav(`/groups/${groupId}/members`)}>Continue to  Members →</button>
      </div>
    </div>
  );
}