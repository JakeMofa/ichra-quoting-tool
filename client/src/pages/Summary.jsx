// src/pages/Summary.jsx
// Summary page with Employer totals, filters, and Employee comparison table.
// Renders <EmployeeTable /> with a Class column by reading
//   GET /groups/:groupId/members and GET /groups/:groupId/classes.

import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import Stepper from '../components/Stepper';
import EmployerCard from '../components/EmployerCard';
import EmployeeTable from '../components/EmployeeTable';

function fmtUSD(n) {
  if (n == null || Number.isNaN(+n)) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(+n);
}

export default function Summary() {
  const { groupId } = useParams();

  // employer
  const [empLoading, setEmpLoading] = useState(false);
  const [employer, setEmployer] = useState(null);
  const [empErr, setEmpErr] = useState('');

  // employees summary (totals + per-employee rows from /summary/employees)
  const [sumLoading, setSumLoading] = useState(false);
  const [employees, setEmployees] = useState([]); // raw rows from API
  const [totals, setTotals] = useState(null);
  const [sumErr, setSumErr] = useState('');

  // filters
  const [facets, setFacets] = useState({ carriers: [], levels: [], market: [] });
  const [filters, setFilters] = useState({ carrier: [], level: [], on_market: undefined });

  // class enrichment
  const [classNameById, setClassNameById] = useState({});   // { classId: "Full-time" }
  const [classByMember, setClassByMember] = useState({});    // { memberId: "Full-time" }
  const [classMembers, setClassMembers] = useState({});      // { classId: ["Alice Lopez", ...] }

  const marketPick = useMemo(() => {
    if (filters.on_market === true) return 'on';
    if (filters.on_market === false) return 'off';
    return 'any';
  }, [filters.on_market]);

  // -------- fetchers ----------
  async function loadEmployer() {
    try {
      setEmpErr('');
      setEmpLoading(true);
      const data = await api.employerSummary(groupId);
      setEmployer(data);
    } catch (e) {
      setEmpErr(e.message || 'Failed to load employer summary');
    } finally {
      setEmpLoading(false);
    }
  }

  async function loadFacets() {
    try {
      const f = await api.filters(groupId);
      setFacets({
        carriers: f?.carriers || [],
        levels: f?.levels || [],
        market: Array.isArray(f?.market) ? f.market : [true, false],
      });
    } catch {
      setFacets({ carriers: [], levels: [], market: [true, false] });
    }
  }

  async function loadEmployees(currentFilters) {
    try {
      setSumErr('');
      setSumLoading(true);
      const data = await api.employeesSummaryGET(groupId, currentFilters);
      setEmployees(Array.isArray(data?.employees) ? data.employees : []);
      setTotals(data?.totals || null);
    } catch (e) {
      setSumErr(e.message || 'Failed to load employee summary');
      setEmployees([]);
      setTotals(null);
    } finally {
      setSumLoading(false);
    }
  }

  // Load classes + members for:
  //  - classByMember (memberId -> class name) for EmployeeTable
  //  - classMembers (classId -> [names]) for EmployerCard
  async function loadClassesAndMembers() {
    try {
      const [classes, members] = await Promise.all([
        api.listClasses(groupId),
        api.listMembers(groupId),
      ]);

      const nameById = {};
      (classes || []).forEach(c => {
        if (c && c._id) nameById[c._id] = c.name || String(c._id);
      });
      setClassNameById(nameById);

      const byMember = {};
      const byClass  = {};

      (members || []).forEach(m => {
        const memberId = m?._id;
        if (!memberId) return;

        const raw = m?.ichra_class; // string or object
        const classId =
          typeof raw === 'string' ? raw :
          (raw && typeof raw === 'object' ? raw._id : undefined);

        if (!classId) return;

        const className =
          (raw && typeof raw === 'object' && raw.name) ||
          nameById[classId] ||
          String(classId);

        byMember[memberId] = String(className);

        const displayName =
          `${m.first_name || ''} ${m.last_name || ''}`.trim() ||
          (memberId || '').slice(0, 6);

        (byClass[String(classId)] ||= []).push(displayName);
      });

      setClassByMember(byMember);
      setClassMembers(byClass);
    } catch {
      setClassNameById({});
      setClassByMember({});
      setClassMembers({});
    }
  }

  // -------- effects ----------
  useEffect(() => {
    if (!groupId) return;
    loadEmployer();
    loadFacets();
    loadClassesAndMembers();
  }, [groupId]);

  useEffect(() => {
    if (!groupId) return;
    const f = {
      carrier: filters.carrier,
      level: filters.level,
      on_market: typeof filters.on_market === 'boolean' ? filters.on_market : undefined,
    };
    loadEmployees(f);
  }, [groupId, filters]);

  // -------- handlers ----------
  function toggleCarrier(c) {
    setFilters(prev => {
      const has = prev.carrier.includes(c);
      const next = has ? prev.carrier.filter(x => x !== c) : [...prev.carrier, c];
      return { ...prev, carrier: next };
    });
  }

  function toggleLevel(lvl) {
    setFilters(prev => {
      const has = prev.level.includes(lvl);
      const next = has ? prev.level.filter(x => x !== lvl) : [...prev.level, lvl];
      return { ...prev, level: next };
    });
  }

  function setMarket(which) {
    if (which === 'on') setFilters(p => ({ ...p, on_market: true }));
    else if (which === 'off') setFilters(p => ({ ...p, on_market: false }));
    else setFilters(p => ({ ...p, on_market: undefined }));
  }

  function clearFilters() {
    setFilters({ carrier: [], level: [], on_market: undefined });
  }

  const employeeRows = employees;

  // -------- render ----------
  return (
    <div className="card">
      
      <Stepper />

      <div className="row" style={{ alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Summary</h2>
        <div style={{ flex: 1 }} />
        <Link to={`/groups/${groupId}/quotes`} className="link">
          ← Back to Quotes
        </Link>
      </div>

      {/* Employer totals (with member names by class) */}
      <div className="card" style={{ opacity: empLoading ? 0.7 : 1 }}>
        <div className="label">Employer totals</div>
        {empErr && (
          <div className="card" style={{ borderColor: '#7f1d1d', color: '#fecaca' }}>
            {empErr}
          </div>
        )}
        <EmployerCard data={employer} classMembers={classMembers} />
      </div>

      {/* Filters */}
      <div className="card">
        <div className="label">Filters</div>

        {/* Carrier chips */}
        <div className="muted" style={{ marginTop: 6 }}>Carrier</div>
        <div className="chips" style={{ marginTop: 6 }}>
          {facets.carriers.length === 0 && <span className="muted">No carriers in latest quotes.</span>}
          {facets.carriers.map(c => (
            <button
              key={c}
              className={`chip ${filters.carrier.includes(c) ? 'chip-on' : ''}`}
              onClick={() => toggleCarrier(c)}
              title={c}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Level chips */}
        <div className="muted" style={{ marginTop: 12 }}>Level</div>
        <div className="chips" style={{ marginTop: 6 }}>
          {facets.levels.length === 0 && <span className="muted">No levels in latest quotes.</span>}
          {facets.levels.map(lvl => (
            <button
              key={lvl}
              className={`chip ${filters.level.includes(lvl) ? 'chip-on' : ''}`}
              onClick={() => toggleLevel(lvl)}
              title={lvl}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Market chips */}
        <div className="muted" style={{ marginTop: 12 }}>Market</div>
        <div className="chips" style={{ marginTop: 6 }}>
          <button className={`chip ${marketPick === 'on' ? 'chip-on' : ''}`} onClick={() => setMarket('on')}>
            On-market
          </button>
          <button className={`chip ${marketPick === 'off' ? 'chip-on' : ''}`} onClick={() => setMarket('off')}>
            Off-market
          </button>
          <button className={`chip ${marketPick === 'any' ? 'chip-on' : ''}`} onClick={() => setMarket('any')}>
            Any
          </button>
        </div>

        <div style={{ marginTop: 10 }}>
          <button className="chip" onClick={clearFilters}>Clear filters</button>
        </div>
      </div>

      {/* Employee comparison */}
      <div className="card" style={{ opacity: sumLoading ? 0.7 : 1 }}>
        <div className="label">Employee comparison</div>
        {sumErr && (
          <div className="card" style={{ borderColor: '#7f1d1d', color: '#fecaca' }}>
            {sumErr}
          </div>
        )}

        <div className="muted" style={{ marginBottom: 8 }}>
          Totals reflect the cheapest qualifying plan per employee (or your explicit selections).
        </div>

        {/* Topline totals */}
        <div className="row wrap" style={{ gap: 12 }}>
          <div className="stat">
            <div className="muted">Old OOP (mo)</div>
            <div className="stat-big">{fmtUSD(totals?.old_out_of_pocket_monthly ?? 0)}</div>
          </div>
          <div className="stat">
            <div className="muted">New OOP (mo)</div>
            <div className="stat-big">{fmtUSD(totals?.new_out_of_pocket_monthly ?? 0)}</div>
          </div>
          <div className="stat">
            <div className="muted">Monthly savings</div>
            <div className="stat-big">{fmtUSD(totals?.monthly_savings ?? 0)}</div>
          </div>
        </div>

        {/* Table with Class column */}
        <div style={{ marginTop: 14 }}>
          <EmployeeTable rows={employeeRows} classByMember={classByMember} />
        </div>

        <details style={{ marginTop: 10 }}>
          <summary className="muted">Employees (debug)</summary>
          <pre className="pre" style={{ maxHeight: 300, marginTop: 6 }}>
            {JSON.stringify(employees, null, 2)}
          </pre>
        </details>
      </div>
    </div>
  );
}