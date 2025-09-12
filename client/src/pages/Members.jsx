// client/src/pages/Members.jsx
//  Member onboarding (manual add & CSV upload), assign to class/sub-class,
//
// Endpoints used:
//  - GET    /groups/:groupId/classes
//  - GET    /groups/:groupId/members
//  - POST   /groups/:groupId/members
//  - PATCH  /groups/:groupId/members/:memberId
//  - DELETE /groups/:groupId/members/:memberId
//  - PATCH  /groups/:groupId/members/:memberId/dependents/:dependentId
//  - DELETE /groups/:groupId/members/:memberId/dependents/:dependentId
//  - POST   /groups/:groupId/quotes

import { useEffect, useMemo, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { v4 as uuid } from 'uuid';
import { api } from '../api';
import Stepper from '../components/Stepper';

function toNum(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// Keep only digits, drop leading zeros, keep max 5
function normalizeZip(raw) {
  const digits = (raw || '').replace(/\D+/g, '');
  const noLeadZeros = digits.replace(/^0+/, '');
  return noLeadZeros.slice(0, 5);
}

// Normalize DOB: accepts YYYY-MM-DD, MM/DD/YYYY, or MM-DD-YYYY → YYYY-MM-DD
function normalizeDOB(raw) {
  const s = (raw || '').trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (m) {
    const mm = String(m[1]).padStart(2, '0');
    const dd = String(m[2]).padStart(2, '0');
    const yy = m[3];
    return `${yy}-${mm}-${dd}`;
  }
  return s; // leave as-is if it doesn't match expected patterns
}

// Always return an id string from either an id or a populated object
function classIdFrom(value) {
  if (!value) return '';
  return typeof value === 'string' ? value : (value._id || '');
}

// ---- Dependents editor (reusable) ----
function blankDep() {
  return {
    first_name: '',
    last_name: '',
    dob: '',               // YYYY-MM-DD
    gender: 'U',           // M/F/U
    relationship: 'child', // child|spouse|other
    same_household: true,
    last_used_tobacco: null,
  };
}

/**
 * DependentsEditor
 * - When memberId is provided: allow row-level Save (PATCH) and Delete (DELETE)
 * - When memberId is null: acts as a local editor for the create form
 */
function DependentsEditor({ groupId, memberId = null, value = [], onChange }) {
  const deps = Array.isArray(value) ? value : [];
  const set = (i, k, v) => onChange(deps.map((d, idx) => (idx === i ? { ...d, [k]: v } : d)));

  async function handleDelete(i) {
    const d = deps[i];
    if (memberId && d?._id) {
      await api.deleteDependent(groupId, memberId, d._id);
    }
    onChange(deps.filter((_, idx) => idx !== i));
  }

  async function handleSaveRow(i) {
    const d = deps[i];
    if (!memberId || !d?._id) return; // new rows saved via parent "Save dependents"
    const patch = {
      first_name: d.first_name,
      last_name: d.last_name,
      dob: d.dob || null,
      gender: d.gender || 'U',
      relationship: d.relationship || 'child',
      same_household: !!d.same_household,
      last_used_tobacco: d.last_used_tobacco ?? null,
    };
    await api.updateDependent(groupId, memberId, d._id, patch);
  }

  return (
    <div className="table" style={{ gridTemplateColumns: memberId ? '1.1fr 1.1fr 0.9fr 0.8fr 1fr 0.9fr 0.8fr 0.8fr' : '1.1fr 1.1fr 0.9fr 0.8fr 1fr 0.9fr 0.8fr' }}>
      <div className="thead">
        <div>First</div><div>Last</div><div>DOB</div><div>Gender</div>
        <div>Relationship</div><div>Same household</div>
        {memberId && <div></div>}
        <div></div>
      </div>

      {deps.map((d, i) => (
        <div className="trow" key={d._id || i}>
          <div><input className="input" value={d.first_name} onChange={e => set(i, 'first_name', e.target.value)} /></div>
          <div><input className="input" value={d.last_name}  onChange={e => set(i, 'last_name',  e.target.value)} /></div>
          <div><input className="input" value={d.dob || ''}  onChange={e => set(i, 'dob',        e.target.value)} placeholder="YYYY-MM-DD" /></div>
          <div>
            <select className="input" value={d.gender || 'U'} onChange={e => set(i, 'gender', e.target.value)}>
              <option value="F">F</option><option value="M">M</option><option value="U">U</option>
            </select>
          </div>
          <div>
            <select className="input" value={d.relationship || 'child'} onChange={e => set(i, 'relationship', e.target.value)}>
              <option value="child">child</option><option value="spouse">spouse</option><option value="other">other</option>
            </select>
          </div>
          <div>
            <select
              className="input"
              value={d.same_household ? 'yes' : 'no'}
              onChange={e => set(i, 'same_household', e.target.value === 'yes')}
            >
              <option value="yes">yes</option><option value="no">no</option>
            </select>
          </div>

          {memberId && (
            <div className="row" style={{ justifyContent:'flex-end' }}>
              <button type="button" className="chip" onClick={() => handleSaveRow(i)} disabled={!d?._id}>Save</button>
            </div>
          )}

          <div className="row" style={{ justifyContent:'flex-end' }}>
            <button type="button" className="chip" onClick={() => handleDelete(i)}>
              {memberId && value[i]?._id ? 'Delete' : 'Remove'}
            </button>
          </div>
        </div>
      ))}

      <div className="row" style={{ marginTop: 8 }}>
        <button type="button" className="chip" onClick={() => onChange([...(deps || []), blankDep()])}>+ Add dependent</button>
      </div>
    </div>
  );
}

export default function Members() {
  const { groupId } = useParams();
  const nav = useNavigate();

  const [classes, setClasses] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  // Manual form
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [dob, setDob] = useState('');     // YYYY-MM-DD (normalized on blur)
  const [gender, setGender] = useState('F');
  const [zip, setZip] = useState('');
  const [zipErr, setZipErr] = useState('');

  // Income/affordability inputs
  const [householdSize, setHHSize] = useState('');
  const [householdIncome, setHHIncome] = useState('');
  const [safeHarborIncome, setSafeHarborIncome] = useState('');
  const [agi, setAGI] = useState('');
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());

  // Prior plan costs
  const [oldEmp, setOldEmp] = useState('');
  const [oldEe, setOldEe] = useState('');

  // Classification + ids
  const [klass, setKlass] = useState('');
  const [externalId, setExternalId] = useState('');

  // Dependents in create form
  const [depsCreate, setDepsCreate] = useState([]);

  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [fallbackInfo, setFallbackInfo] = useState(''); // shows when we default HH size to 1

  // CSV upload
  const [csvErr, setCsvErr] = useState('');
  const [uploading, setUploading] = useState(false);

  // Dependents modal
  const [editingDeps, setEditingDeps] = useState(null); // member object
  const [depsBuffer, setDepsBuffer] = useState([]);

  // Edit Member modal
  const [editMemberModal, setEditMemberModal] = useState(null);

  // --- Quotes pre-flight controls (effective date, rating area, tobacco) ---
  const todayISO = new Date().toISOString().slice(0, 10);
  const [effDate, setEffDate] = useState(todayISO);
  const [ratingLoc, setRatingLoc] = useState('work');    // 'work' | 'home'
  const [tobacco, setTobacco] = useState(false);
  const [preppingQuotes, setPreppingQuotes] = useState(false);
  const [preQuotesErr, setPreQuotesErr] = useState('');

  // ICHRA button state
  const [ichraRunning, setIchraRunning] = useState(false);
  const [ichraComplete, setIchraComplete] = useState(false);
  const [ichraErr, setIchraErr] = useState('');

  // prevent duplicate runQuotes calls in this mount
  const runQuotesRef = useRef(false);

  const baseClasses = useMemo(
    () => classes.filter(c => !c?.parent_class),
    [classes]
  );

  useEffect(() => {
    if (!groupId) return;
    (async () => {
      try {
        setLoading(true);
        const [cls, mem] = await Promise.all([
          api.listClasses(groupId),
          api.listMembers(groupId),
        ]);
        setClasses(Array.isArray(cls) ? cls : []);
        setMembers(Array.isArray(mem) ? mem : []);
      } catch (e) {
        setErr(e.message || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    })();
  }, [groupId]);

  function resetForm() {
    setFirst(''); setLast(''); setDob(''); setGender('F'); setZip(''); setZipErr('');
    setHHSize(''); setHHIncome(''); setSafeHarborIncome(''); setAGI(''); setTaxYear(new Date().getFullYear());
    setOldEmp(''); setOldEe(''); setKlass(''); setExternalId('');
    setDepsCreate([]); setFallbackInfo('');
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateErr('');
    setFallbackInfo('');

    const zip5 = normalizeZip(zip);
    if (zip5.length !== 5) {
      setZipErr('ZIP must be 5 digits (leading zeros are removed).');
      return;
    }
    setZipErr('');

    // Prepare affordability pieces; require at least one of these three
    let hhSizeNum = toNum(householdSize) || undefined;
    const hhIncomeNum = toNum(householdIncome) || undefined;
    const safeHarborNum = toNum(safeHarborIncome) || undefined;

    if (!hhSizeNum && !hhIncomeNum && !safeHarborNum) {
      hhSizeNum = 1; // safe default that satisfies API requirement
      setFallbackInfo('No household size/income provided; defaulted household size to 1 so quotes can run.');
    }

    try {
      setCreating(true);
      await api.createMember(groupId, {
        first_name: first.trim(),
        last_name: last.trim(),
        dob: dob || undefined,
        gender,
        zip_code: zip5,
        household_size: hhSizeNum,
        household_income: hhIncomeNum,
        safe_harbor_income: safeHarborNum,
        agi: toNum(agi) || undefined,
        tax_year: toNum(taxYear) || undefined,
        old_employer_contribution: toNum(oldEmp) || 0,
        old_employee_contribution: toNum(oldEe) || 0,
        ichra_class: klass || undefined,
        external_id: externalId || undefined,
        dependents: depsCreate && depsCreate.length ? depsCreate : [],
      });

      resetForm();
      const mem = await api.listMembers(groupId);
      setMembers(Array.isArray(mem) ? mem : []);
    } catch (e) {
      setCreateErr(e.message || 'Failed to create member');
    } finally {
      setCreating(false);
    }
  }

  // Basic CSV: header row with (NO ichra_class here)
  // first_name,last_name,dob,gender,zip_code,household_size,household_income,safe_harbor_income,agi,tax_year,old_employer_contribution,old_employee_contribution,external_id
  async function handleCSVFile(file) {
    setCsvErr('');
    if (!file) return;
    let rows = [];
    try {
      const text = await file.text();
      rows = parseCSV(text);
      if (!rows.length) { setCsvErr('No CSV rows found.'); return; }
    } catch {
      setCsvErr('Could not read CSV file.');
      return;
    }

    const skipped = [];
    try {
      setUploading(true);
      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];

        // Normalize/validate ZIP
        const zip5 = normalizeZip(r.zip_code || r.zip || '');
        if (zip5.length !== 5) { skipped.push(i + 2); continue; } // +2 for header line

        // Make sure at least one of the three affordability fields is present
        let hhSizeNum = r.household_size ? Number(r.household_size) : undefined;
        const hhIncomeNum = r.household_income ? Number(r.household_income) : undefined;
        const safeHarborNum = r.safe_harbor_income ? Number(r.safe_harbor_income) : undefined;
        if (!hhSizeNum && !hhIncomeNum && !safeHarborNum) hhSizeNum = 1;

        await api.createMember(groupId, {
          first_name: r.first_name || r.first || '',
          last_name: r.last_name || r.last || '',
          dob: normalizeDOB(r.dob) || undefined,
          gender: r.gender || undefined,
          zip_code: zip5,
          household_size: hhSizeNum,
          household_income: hhIncomeNum,
          safe_harbor_income: safeHarborNum,
          agi: r.agi ? Number(r.agi) : undefined,
          tax_year: r.tax_year ? Number(r.tax_year) : undefined,
          old_employer_contribution: r.old_employer_contribution ? Number(r.old_employer_contribution) : 0,
          old_employee_contribution: r.old_employee_contribution ? Number(r.old_employee_contribution) : 0,
          // ichra_class intentionally omitted in CSV flow
          external_id: r.external_id || undefined,
          dependents: [],
        });
      }
      const mem = await api.listMembers(groupId);
      setMembers(Array.isArray(mem) ? mem : []);
      if (skipped.length) {
        setCsvErr(`Skipped ${skipped.length} row(s) with invalid ZIP (after removing leading zeros): lines ${skipped.join(', ')}`);
      }
    } catch (e) {
      setCsvErr(e.message || 'CSV import failed');
    } finally {
      setUploading(false);
    }
  }

  // Dependents CSV: member_external_id,first_name,last_name,dob,gender,relationship,same_household,last_used_tobacco
  async function handleDepsCSV(file) {
    if (!file) return;
    try {
      const text = await file.text();
      const rows = parseCSV(text);
      if (!rows.length) return;

      // group rows by member_external_id
      const byExt = {};
      for (const r of rows) {
        const key = (r.member_external_id || '').trim();
        if (!key) continue;
        (byExt[key] ||= []).push({
          first_name: r.first_name || '',
          last_name: r.last_name || '',
          dob: normalizeDOB(r.dob) || '',
          gender: r.gender || 'U',
          relationship: r.relationship || 'child',
          same_household: String(r.same_household).toLowerCase() !== 'false',
          last_used_tobacco: r.last_used_tobacco || null,
        });
      }

      // map external_id -> memberId (from current list)
      const byExternal = {};
      for (const m of members) if (m.external_id) byExternal[m.external_id] = m._id;

      // PATCH per member (replace full list)
      for (const ext in byExt) {
        const memberId = byExternal[ext];
        if (!memberId) continue;
        await api.updateMember(groupId, memberId, { dependents: byExt[ext] });
      }

      const mem = await api.listMembers(groupId);
      setMembers(Array.isArray(mem) ? mem : []);
    } catch (e) {
      alert(e.message || 'Dependents CSV import failed');
    }
  }

  async function saveRow(m) {
    try {
      await api.updateMember(groupId, m._id, {
        ichra_class: classIdFrom(m.ichra_class) || undefined, // ensure id string
        old_employer_contribution: toNum(m.old_employer_contribution),
        old_employee_contribution: toNum(m.old_employee_contribution),
      });
    } catch (e) {
      alert(e.message || 'Failed to save member');
    } finally {
      const mem = await api.listMembers(groupId);
      setMembers(Array.isArray(mem) ? mem : []);
    }
  }

  function openDepsEditor(member) {
    setEditingDeps(member);
    setDepsBuffer(Array.isArray(member.dependents) ? member.dependents.map(d => ({ ...d })) : []);
  }

  // --- Run ICHRA for each member (client-side loop) ---
  async function handleRunIchraAll() {
    if (!groupId || !members.length) return;
    setIchraErr('');
    setIchraRunning(true);
    setIchraComplete(false);
    try {
      for (const m of members) {
        if (!m?._id) continue;
        await api.runMemberIchra(groupId, m._id, {
          effective_date: effDate,
          rating_area_location: ratingLoc,
        });
      }
      // refresh to pick up saved affordability fields
      const mem = await api.listMembers(groupId);
      setMembers(Array.isArray(mem) ? mem : []);
      setIchraComplete(true);
    } catch (e) {
      setIchraErr(e.message || 'Failed to run ICHRA.');
    } finally {
      setIchraRunning(false);
    }
  }

  // --- Run quotes before navigating (idempotent & guarded) ---

  async function handleRunQuotesThenNav() {
    if (!groupId) return;

    const inflightKey = `quotes_inflight:${groupId}`;
    setPreQuotesErr('');
    runQuotesRef.current = false;
    sessionStorage.removeItem(inflightKey);
    setPreppingQuotes(false);

    nav(`/groups/${groupId}/quotes`);
  }

  return (
    <div className="card">
      {/* Stepper includes Members in the flow */}
      <Stepper />

      <div className="row" style={{ alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Members</h2>
        <div style={{ flex: 1 }} />

        {/* Calculate ICHRA button (top) */}
        <button
          className="chip"
          onClick={handleRunIchraAll}
          disabled={ichraRunning || !members.length}
          aria-busy={ichraRunning ? 'true' : 'false'}
          style={ichraRunning ? { pointerEvents: 'none', opacity: 0.7 } : undefined}
          title={!members.length ? 'Add members first' : ''}
        >
          {ichraRunning ? 'Calculating ICHRA…' : ichraComplete ? 'ICHRA complete ✓' : 'Calculate ICHRA'}
        </button>

        {/* Go to Quotes (gated until ICHRA done) */}
        <button className="link" onClick={handleRunQuotesThenNav}>
        Go to Quotes →
        </button>
      </div>

      {ichraErr && (
        <div className="card" style={{ marginBottom: 12, borderColor: '#7f1d1d', color: '#fecaca' }}>
          {ichraErr}
        </div>
      )}

      {/* Quotes pre-flight controls */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="label">Quotes pre-flight</div>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="col" style={{ minWidth: 220 }}>
            <label className="muted">Effective date</label>
            <input
              className="input"
              type="date"
              value={effDate}
              onChange={e => setEffDate(e.target.value)}
            />
          </div>
          <div className="col" style={{ minWidth: 220 }}>
            <label className="muted">Rating area location</label>
            <select className="input" value={ratingLoc} onChange={e => setRatingLoc(e.target.value)}>
              <option value="work">work</option>
              <option value="home">home</option>
            </select>
          </div>
          <div className="col" style={{ minWidth: 220 }}>
            <label className="muted">Tobacco</label>
            <select className="input" value={tobacco ? 'yes' : 'no'} onChange={e => setTobacco(e.target.value === 'yes')}>
              <option value="no">no</option>
              <option value="yes">yes</option>
            </select>
          </div>
        </div>
        {preQuotesErr && (
          <div className="card" style={{ marginTop: 8, borderColor: '#7f1d1d', color: '#fecaca' }}>
            {preQuotesErr}
          </div>
        )}
      </div>

      {/* Manual add */}
      <div className="card" style={{ opacity: loading ? 0.7 : 1 }}>
        <div className="label">Add a member</div>
        <form className="col" onSubmit={handleCreate} style={{ gap: 10 }}>
          {/* Row 1 */}
          <div className="row wrap" style={{ gap: 10 }}>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">First name</label>
              <input className="input" value={first} onChange={e => setFirst(e.target.value)} />
            </div>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">Last name</label>
              <input className="input" value={last} onChange={e => setLast(e.target.value)} />
            </div>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">External ID (optional)</label>
              <input className="input" value={externalId} onChange={e => setExternalId(e.target.value)} />
            </div>
          </div>

          {/* Row 2 */}
          <div className="row wrap" style={{ gap: 10 }}>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">DOB (YYYY-MM-DD)</label>
              <input
                className="input"
                value={dob}
                onChange={e => setDob(e.target.value)}
                onBlur={e => setDob(normalizeDOB(e.target.value))}
                placeholder="1990-02-15 or 02/15/1990"
              />
            </div>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">Gender</label>
              <select className="input" value={gender} onChange={e => setGender(e.target.value)}>
                <option value="F">F</option><option value="M">M</option><option value="U">U</option>
              </select>
            </div>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">ZIP</label>
              <input className="input" value={zip} onChange={e => setZip(normalizeZip(e.target.value))} placeholder="97222" />
              {zipErr && <div className="muted" style={{ color: '#fecaca' }}>{zipErr}</div>}
            </div>
          </div>

          {/* Row 3 — Affordability */}
          <div className="row wrap" style={{ gap: 10 }}>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">Household size</label>
              <input className="input" value={householdSize} onChange={e => setHHSize(e.target.value)} />
            </div>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">Household income</label>
              <input className="input" value={householdIncome} onChange={e => setHHIncome(e.target.value)} />
            </div>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">Safe-harbor income</label>
              <input className="input" value={safeHarborIncome} onChange={e => setSafeHarborIncome(e.target.value)} />
            </div>
          </div>

          {/* Row 4 — Taxes */}
          <div className="row wrap" style={{ gap: 10 }}>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">AGI</label>
              <input className="input" value={agi} onChange={e => setAGI(e.target.value)} />
            </div>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">Tax year</label>
              <input className="input" value={taxYear} onChange={e => setTaxYear(e.target.value)} />
            </div>
          </div>

          {/* Row 5 — Prior plan */}
          <div className="row wrap" style={{ gap: 10 }}>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">Old employer $/mo</label>
              <input className="input" value={oldEmp} onChange={e => setOldEmp(e.target.value)} />
            </div>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">Old employee $/mo</label>
              <input className="input" value={oldEe} onChange={e => setOldEe(e.target.value)} />
            </div>
            <div className="col" style={{ minWidth: 220 }}>
              <label className="muted">Class / Sub-class</label>
              <select className="input" value={klass} onChange={e => setKlass(e.target.value)}>
                <option value="">— select —</option>
                {classes.map(c => (
                  <option key={c._id} value={c._id}>
                    {c.name}{c.subclass ? ` — ${c.subclass}` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dependents (optional) */}
          <div className="card" style={{ marginTop: 8 }}>
            <div className="label">Dependents (optional)</div>
            <DependentsEditor groupId={groupId} memberId={null} value={depsCreate} onChange={setDepsCreate} />
          </div>

          {!!fallbackInfo && (
            <div className="muted" style={{ marginTop: 6 }}>
              {fallbackInfo}
            </div>
          )}

          <div className="row" style={{ gap: 8, marginTop: 8 }}>
            <button className="chip" type="submit" disabled={creating}>{creating ? 'Adding…' : 'Add member'}</button>
            <button className="chip" type="button" onClick={resetForm}>Clear</button>
          </div>
        </form>

        {createErr && (
          <div className="card" style={{ marginTop: 8, borderColor: '#7f1d1d', color: '#fecaca' }}>
            {createErr}
          </div>
        )}
      </div>

      {/* CSV (Members) */}
      <div className="card">
        <div className="label">Bulk upload (CSV)</div>
        <div className="code-wrap">
          Headers:
{"\n"}first_name,last_name,dob,gender,zip_code,household_size,household_income,safe_harbor_income,agi,tax_year,old_employer_contribution,old_employee_contribution,external_id
        </div>
        <div className="row" style={{ gap: 10, marginTop: 8 }}>
          <input type="file" accept=".csv,text/csv" onChange={(e) => handleCSVFile(e.target.files?.[0] || null)} disabled={uploading} />
          {uploading && <span className="muted">Uploading…</span>}
        </div>
        {csvErr && <div className="card" style={{ marginTop: 8, borderColor: '#7f1d1d', color: '#fecaca' }}>{csvErr}</div>}
      </div>

      {/* CSV (Dependents) */}
      <div className="card">
        <div className="label">Bulk upload — Dependents (CSV)</div>
        <div className="code-wrap">
          Headers:
{"\n"}member_external_id,first_name,last_name,dob,gender,relationship,same_household,last_used_tobacco
        </div>
        <div className="row" style={{ gap: 10, marginTop: 8 }}>
          <input type="file" accept=".csv,text/csv" onChange={(e) => handleDepsCSV(e.target.files?.[0] || null)} />
        </div>
      </div>

      {/* Members list */}
      <div className="card" style={{ opacity: loading ? 0.7 : 1 }}>
        <div className="label">Existing members</div>
        {err && <div className="card" style={{ borderColor: '#7f1d1d', color: '#fecaca' }}>{err}</div>}
        {!members.length && <div className="muted">No members yet.</div>}
        {!!members.length && (
          // Make the table horizontally scrollable so it never overflows the card
          <div style={{ overflowX: 'auto' }}>
            <div
              className="table"
              style={{
                gridTemplateColumns: '1.2fr 0.9fr 0.9fr 1.4fr 1fr 1fr 1.3fr 1.2fr',
                minWidth: 1100,   // prevents squish and activates horizontal scroll when needed
              }}
            >
              <div className="thead">
                <div>Name</div>
                <div>DOB</div>
                <div>ZIP</div>
                <div>Class</div>
                <div>Old Emp (mo)</div>
                <div>Old EE (mo)</div>
                <div>Dependents</div>
                <div></div>
              </div>

              {members.map(m => {
                const full = `${m.first_name || ''} ${m.last_name || ''}`.trim() || '—';
                const selectedClassId = classIdFrom(m.ichra_class); // normalize for select
                return (
                  <div className="trow" key={m._id}>
                    <div>{full}</div>
                    <div>{(m.dob || '').slice(0,10) || '—'}</div>
                    <div>{m.zip_code || '—'}</div>
                    <div>
                      <select
                        className="input"
                        value={selectedClassId}
                        onChange={e =>
                          setMembers(ms => ms.map(x => x._id === m._id ? { ...x, ichra_class: e.target.value } : x))
                        }
                      >
                        <option value="">— select —</option>
                        {classes.map(c => (
                          <option key={c._id} value={c._id}>
                            {c.name}{c.subclass ? ` — ${c.subclass}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <input
                        className="input"
                        value={m.old_employer_contribution ?? 0}
                        onChange={e => setMembers(ms => ms.map(x => x._id === m._id ? { ...x, old_employer_contribution: e.target.value } : x))}
                      />
                    </div>
                    <div>
                      <input
                        className="input"
                        value={m.old_employee_contribution ?? 0}
                        onChange={e => setMembers(ms => ms.map(x => x._id === m._id ? { ...x, old_employee_contribution: e.target.value } : x))}
                      />
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <span className="chip chip-muted">Dependents: {Array.isArray(m.dependents) ? m.dependents.length : 0}</span>
                      <button className="chip" type="button" onClick={() => openDepsEditor(m)}>Edit</button>
                    </div>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button className="chip" onClick={() => saveRow(m)}>Save</button>
                      <button className="chip" onClick={() => setEditMemberModal(m)}>Edit</button>
                      <button className="chip" onClick={async () => {
                        if (!window.confirm('Delete this member?')) return;
                        await api.deleteMember(groupId, m._id);
                        const mem = await api.listMembers(groupId);
                        setMembers(Array.isArray(mem) ? mem : []);
                      }}>Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* comment */}
      <div className="row" style={{ marginTop: 14, gap: 8, alignItems: 'center' }}>
      {/* Calculate ICHRA button (bottom duplicate for convenience) */}
      <button
        className="chip"
        onClick={handleRunIchraAll}
        disabled={ichraRunning || !members.length}
        aria-busy={ichraRunning ? 'true' : 'false'}
        style={ichraRunning ? { pointerEvents: 'none', opacity: 0.7 } : undefined}
        title={!members.length ? 'Add members first' : ''}
      >
        {ichraRunning ? 'Calculating ICHRA…' : ichraComplete ? 'ICHRA complete ✓' : 'Calculate ICHRA'}
      </button>

      {/* Go to Quotes */}
      <button
        className="chip"
        onClick={handleRunQuotesThenNav}
      >
        Go to Quotes →
      </button>
    </div>
      

      {/* Dependents modal */}
      {editingDeps && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="row" style={{ justifyContent:'space-between', marginBottom: 8 }}>
              <strong>Edit dependents — {editingDeps.first_name} {editingDeps.last_name}</strong>
              <button className="chip" onClick={() => setEditingDeps(null)}>Close</button>
            </div>

            <DependentsEditor groupId={groupId} memberId={editingDeps._id} value={depsBuffer} onChange={setDepsBuffer} />

            <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
              <button className="chip" onClick={() => setEditingDeps(null)}>Done</button>
              <button
                className="chip"
                onClick={async () => {
                  try {
                    // Replace list for any brand new (no _id) rows user added in modal
                    const toReplace = depsBuffer;
                    await api.updateMember(groupId, editingDeps._id, { dependents: toReplace });
                    const mem = await api.listMembers(groupId);
                    setMembers(Array.isArray(mem) ? mem : []);
                    setEditingDeps(null);
                  } catch (e) {
                    alert(e.message || 'Failed to save dependents');
                  }
                }}
              >
                Save new rows
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Member modal */}
      {editMemberModal && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="row" style={{ justifyContent:'space-between', marginBottom: 8 }}>
              <strong>Edit member — {editMemberModal.first_name} {editMemberModal.last_name}</strong>
              <button className="chip" onClick={() => setEditMemberModal(null)}>Close</button>
            </div>

            <div className="row wrap" style={{ gap: 10 }}>
              <div className="col" style={{ minWidth: 220 }}>
                <label className="muted">First name</label>
                <input className="input"
                  value={editMemberModal.first_name || ''}
                  onChange={e => setEditMemberModal({ ...editMemberModal, first_name: e.target.value })}
                />
              </div>
              <div className="col" style={{ minWidth: 220 }}>
                <label className="muted">Last name</label>
                <input className="input"
                  value={editMemberModal.last_name || ''}
                  onChange={e => setEditMemberModal({ ...editMemberModal, last_name: e.target.value })}
                />
              </div>
              <div className="col" style={{ minWidth: 220 }}>
                <label className="muted">External ID</label>
                <input className="input"
                  value={editMemberModal.external_id || ''}
                  onChange={e => setEditMemberModal({ ...editMemberModal, external_id: e.target.value })}
                />
              </div>
            </div>

            <div className="row wrap" style={{ gap: 10 }}>
              <div className="col" style={{ minWidth: 220 }}>
                <label className="muted">DOB</label>
                <input className="input"
                  value={(editMemberModal.dob || '').slice(0,10)}
                  onChange={e => setEditMemberModal({ ...editMemberModal, dob: e.target.value })}
                  onBlur={e => setEditMemberModal({ ...editMemberModal, dob: normalizeDOB(e.target.value) })}
                  placeholder="YYYY-MM-DD or MM/DD/YYYY"
                />
              </div>
              <div className="col" style={{ minWidth: 220 }}>
                <label className="muted">Gender</label>
                <select className="input"
                  value={editMemberModal.gender || 'U'}
                  onChange={e => setEditMemberModal({ ...editMemberModal, gender: e.target.value })}
                >
                  <option value="F">F</option><option value="M">M</option><option value="U">U</option>
                </select>
              </div>
              <div className="col" style={{ minWidth: 220 }}>
                <label className="muted">ZIP</label>
                <input className="input"
                  value={editMemberModal.zip_code || ''}
                  onChange={e => setEditMemberModal({ ...editMemberModal, zip_code: e.target.value.replace(/\D+/g,'').slice(0,5) })}
                />
              </div>
            </div>

            <div className="row wrap" style={{ gap: 10 }}>
              <div className="col" style={{ minWidth: 220 }}>
                <label className="muted">Household size</label>
                <input className="input"
                  value={editMemberModal.household_size ?? ''}
                  onChange={e => setEditMemberModal({ ...editMemberModal, household_size: e.target.value })}
                />
              </div>
              <div className="col" style={{ minWidth: 220 }}>
                <label className="muted">Household income</label>
                <input className="input"
                  value={editMemberModal.household_income ?? ''}
                  onChange={e => setEditMemberModal({ ...editMemberModal, household_income: e.target.value })}
                />
              </div>
              <div className="col" style={{ minWidth: 220 }}>
                <label className="muted">Safe harbor income</label>
                <input className="input"
                  value={editMemberModal.safe_harbor_income ?? ''}
                  onChange={e => setEditMemberModal({ ...editMemberModal, safe_harbor_income: e.target.value })}
                />
              </div>
              <div className="col" style={{ minWidth: 220 }}>
                <label className="muted">AGI</label>
                <input className="input"
                  value={editMemberModal.agi ?? ''}
                  onChange={e => setEditMemberModal({ ...editMemberModal, agi: e.target.value })}
                />
              </div>
              <div className="col" style={{ minWidth: 220 }}>
                <label className="muted">Tax year</label>
                <input className="input"
                  value={editMemberModal.tax_year ?? ''}
                  onChange={e => setEditMemberModal({ ...editMemberModal, tax_year: e.target.value })}
                />
              </div>
            </div>

            <div className="row" style={{ justifyContent:'flex-end', gap: 8, marginTop: 12 }}>
              <button className="chip" onClick={() => setEditMemberModal(null)}>Cancel</button>
              <button className="chip" onClick={async () => {
                const p = editMemberModal;
                const patch = {
                  first_name: (p.first_name || '').trim(),
                  last_name:  (p.last_name  || '').trim(),
                  external_id: p.external_id || undefined,
                  dob: normalizeDOB(p.dob) || undefined,
                  gender: p.gender || undefined,
                  zip_code: p.zip_code || undefined,
                  household_size: Number(p.household_size) || undefined,
                  household_income: Number(p.household_income) || undefined,
                  safe_harbor_income: Number(p.safe_harbor_income) || undefined,
                  agi: Number(p.agi) || undefined,
                  tax_year: Number(p.tax_year) || undefined,
                };
                await api.updateMember(groupId, p._id, patch);
                const mem = await api.listMembers(groupId);
                setMembers(Array.isArray(mem) ? mem : []);
                setEditMemberModal(null);
              }}>
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------- CSV helper (tiny) -------- */
function parseCSV(text) {
  // naive parser good enough for simple, non-quoted CSV
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(v => v.trim());
    if (!cols.length || cols.every(v => v === '')) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] ?? ''; });
    out.push(row);
  }
  return out;
}