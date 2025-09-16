// client/src/pages/Landing.jsx
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/landing.css";

import Orb3D from "../components/Orb3D";
import TutorialModal from "../components/TutorialModal";
import HelpButton from "../components/HelpButton";

const USE_3D_ORB = true;

export default function Landing() {
  const { isAuthed } = useAuth();

  return (
    <div className="landing">
      {/* animated background stage */}
      <div className="stage" aria-hidden>
        <div className="wave wave-1" />
        <div className="wave wave-2" />

        {/* ORB — render exactly ONE */}
        {USE_3D_ORB ? (
          <div className="three-orb orb-anchor">
            <Orb3D width={380} height={380} />
          </div>
        ) : (
          <div className="css-orb orb-anchor">
            <i className="plus" />
          </div>
        )}
      </div>

      {/* hero copy */}
      <div className="hero">
        <div className="pill">Healthcare • Insurance • ICHRA</div>
        <h1 className="title">
          <span className="title-top">Welcome to the Demo</span>
          <span className="title-main">ICHRA Quoting Tool</span>
        </h1>

        <p className="lede">
          A MERN app that simulates group health quoting with ICHRA affordability, plan
          pricing, and employer/employee savings comparisons — using Ideon API (or mock
          mode).
        </p>

        <div className="ctaRow">
          {isAuthed ? (
            <>
              <Link to="/groups" className="btn btn-primary">Open your groups</Link>
              <Link to="/groups" className="btn btn-ghost">Run quotes</Link>
            </>
          ) : (
            <p className="muted">
              Use the top-right buttons to Sign up or Log in to get started.
            </p>
          )}
        </div>
      </div>

      {/* Bottom-left: tutorial trigger (opens modal with your YouTube embed) */}
      <TutorialModal />

      {/* Bottom-right: floating “Need help?” email button */}
      <HelpButton />
    </div>
  );
}