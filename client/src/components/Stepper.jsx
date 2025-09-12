// src/components/Stepper.jsx
import { Link, useParams, useLocation } from 'react-router-dom';

export default function Stepper() {
  const { groupId } = useParams();
  const loc = useLocation();

  const step = (idx, label, to, enabled) => {
    const isActive = to && loc.pathname.startsWith(to);
    const cls = `step ${isActive ? 'step-on' : ''}`;
    if (enabled && to) {
      return (
        <Link key={idx} to={to} className={cls}>
          <span className="step-index">{idx}</span> {label}
        </Link>
      );
    }
    return (
      <span key={idx} className={cls}>
        <span className="step-index">{idx}</span> {label}
      </span>
    );
  };

  return (
    <div className="stepper">
      {step(1, 'Group',   '/groups', true)}
      {step(2, 'Classes', groupId ? `/groups/${groupId}/classes`  : null, !!groupId)}
      {step(3, 'Members', groupId ? `/groups/${groupId}/members`  : null, !!groupId)}
      {step(4, 'Quotes',  groupId ? `/groups/${groupId}/quotes`   : null, !!groupId)}
      {step(5, 'Summary', groupId ? `/groups/${groupId}/summary`  : null, !!groupId)}
    </div>
  );
}