// src/App.js
//App routes & shell. Adds Groups landing, Classes, Quotes, Summary pages.

import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './styles/app.css';
import GroupLanding from './pages/GroupLanding';
import Quotes from './pages/Quotes';
import Summary from './pages/Summary';
import Classes from './pages/Classes';
import Members from './pages/Members';          

export default function App() {
  return (
    <BrowserRouter>
      <div className="wrap">
        <Routes>
          <Route path="/" element={<Navigate to="/groups" replace />} />
          <Route path="/groups" element={<GroupLanding />} />
          <Route path="/" element={<GroupLanding />} />
          <Route path="/groups/:groupId/classes" element={<Classes />} />
          <Route path="/groups/:groupId/members" element={<Members />} />
          <Route path="/groups/:groupId/quotes" element={<Quotes />} />
          <Route path="/groups/:groupId/summary" element={<Summary />} />
          <Route path="*" element={<div className="card">Not Found</div>} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
