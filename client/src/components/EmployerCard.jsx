// client/src/components/EmployerCard.jsx
//  Present employer totals (mo/yr) and breakdown by class.
// Data source: GET /groups/:groupId/summary/employer
//  accepts `classMembers` prop (map: { [classId]: string[] }) to show member names per class.

export default function EmployerCard({ data, classMembers = {} }) {
    if (!data) return null;
  
    const cmp = data.employer_comparison || {};
    const oldM = Number(cmp?.old?.monthly_total || 0);
    const ichraM = Number(cmp?.ichra?.monthly_total || 0);
    const saveM = Number(cmp?.savings?.monthly || 0);
  
    const oldY = Number(cmp?.old?.annual_total || 0);
    const ichraY = Number(cmp?.ichra?.annual_total || 0);
    const saveY = Number(cmp?.savings?.annual || 0);
  
    const breakdown = data.breakdown_by_class
      ? Object.entries(data.breakdown_by_class).map(([id, v]) => ({ id, ...v }))
      : [];
  
    return (
      <div className="cards">
        {/* Employer totals (monthly & annual) */}
        <div className="card">
          <div className="label" style={{ marginBottom: 8 }}>Employer Totals</div>
  
          <div className="table" style={{ gridTemplateColumns: '1.2fr 1fr 1fr 1fr' }}>
            <div className="thead">
              <div></div><div>Monthly</div><div>Annual</div><div></div>
            </div>
  
            <div className="trow">
              <div>Old</div>
              <div>${oldM.toLocaleString()}</div>
              <div>${oldY.toLocaleString()}</div>
              <div></div>
            </div>
  
            <div className="trow">
              <div>New ICHRA</div>
              <div>${ichraM.toLocaleString()}</div>
              <div>${ichraY.toLocaleString()}</div>
              <div></div>
            </div>
  
            <div className="trow">
              <div>Savings</div>
              <div className={saveM >= 0 ? 'pos' : 'neg'}>
                {saveM >= 0 ? '+' : '−'}${Math.abs(saveM).toLocaleString()}
              </div>
              <div className={saveY >= 0 ? 'pos' : 'neg'}>
                {saveY >= 0 ? '+' : '−'}${Math.abs(saveY).toLocaleString()}
              </div>
              <div></div>
            </div>
          </div>
        </div>
  
        {/* Breakdown by class with member names */}
        {breakdown.length > 0 && (
          <div className="card">
            <div className="label" style={{ marginBottom: 8 }}>By Class</div>
  
            <div className="table" style={{ gridTemplateColumns: '1.1fr 0.9fr 1fr 1fr' }}>
              <div className="thead">
                <div>Class</div><div>Members</div><div>ICHRA / mo</div><div>ICHRA / yr</div>
              </div>
  
              {breakdown.map(b => {
                const names = classMembers[b.id] || []; // array of strings (e.g., ["Alice Lopez", "Ben Ng"])
                return (
                  <div className="trow" key={b.id} style={{ alignItems: 'start' }}>
                    <div>{b.name || b.id}</div>
  
                    <div>
                      {Number(b.members || 0)}
                      {names.length > 0 && (
                        <div className="muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.35 }}>
                          {names.join(', ')}
                        </div>
                      )}
                    </div>
  
                    <div>${Number(b.monthly_total || 0).toLocaleString()}</div>
                    <div>${Number(b.annual_total || 0).toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }
  