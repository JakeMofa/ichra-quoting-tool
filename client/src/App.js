// client/src/App.js
// App routes & shell. Header is full-width; only app pages use the .wrap container.

import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import './styles/app.css';
import Header from './components/Header';
import Landing from './pages/Landing';
import GroupLanding from './pages/GroupLanding';
import Classes from './pages/Classes';
import Members from './pages/Members';
import Quotes from './pages/Quotes';
import Summary from './pages/Summary';

function Shell() {
  // shared “page” container used by all non-landing pages
  return (
    <div className="wrap">
      <Outlet />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Header />

      <Routes>
        {/* FULL-BLEED landing (no .wrap) */}
        <Route path="/" element={<Landing />} />

        {/* Everything else sits inside the .wrap container */}
        <Route element={<Shell />}>
          <Route path="/groups" element={<GroupLanding />} />
          <Route path="/groups/:groupId/classes" element={<Classes />} />
          <Route path="/groups/:groupId/members" element={<Members />} />
          <Route path="/groups/:groupId/quotes" element={<Quotes />} />
          <Route path="/groups/:groupId/summary" element={<Summary />} />
          {/* If someone hits /quotes without a group, send them home */}
          <Route path="/quotes" element={<Navigate to="/" replace />} />
        </Route>

        {/* 404 */}
        <Route path="*" element={<div className="card">Not Found</div>} />
      </Routes>
    </BrowserRouter>
  );
}