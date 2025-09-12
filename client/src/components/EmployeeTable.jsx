// /src/components/EmployeeTable.jsx
//  GET /groups/:groupId/summary/employees


export default function EmployeeTable({ rows = [], classByMember = {} }) {
    if (!rows.length) {
      return <div className="muted">No employees yet.</div>;
    }
  
    return (
      <div className="table" style={{ gridTemplateColumns: '1.2fr 0.9fr 1.8fr 0.9fr 0.9fr 0.9fr' }}>
        <div className="thead">
          <div>Employee</div>
          <div>Class</div>
          <div>Plan</div>
          <div>Old OOP</div>
          <div>New OOP</div>
          <div>Savings</div>
        </div>
  
        {rows.map((r) => {
          const name = r?.name || '—';
          const memberId = r?.member_id;
          const klass =
            classByMember[memberId] ||
            r?.class_name ||
            '';
  
          const plan = r?.selected_plan || {};
          const planLabel = plan?.display_name || r?.selected_plan_id || '—';
  
          const oldOOP = toNum(r?.old_out_of_pocket_monthly);
          const newOOP = toNum(r?.new_out_of_pocket_monthly);
          const savings = oldOOP - newOOP;
  
          return (
            <div className="trow" key={memberId || name}>
              <div>{name}</div>
              <div>{klass ? <span className="chip chip-on">{klass}</span> : <span className="muted">—</span>}</div>
              <div>{planLabel}</div>
              <div>${oldOOP.toLocaleString()}</div>
              <div>${newOOP.toLocaleString()}</div>
              <div className={savings >= 0 ? 'pos' : 'neg'}>
                {savings >= 0 ? '+' : '−'}${Math.abs(savings).toLocaleString()}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
  
  function toNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  