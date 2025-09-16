import { useState } from "react";

export default function TutorialModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating button, bottom-left */}
      <button
        className="chip tutorial-fab"
        onClick={() => setOpen(true)}
        aria-label="Open tutorial video"
      >
        📺 Tutorial
      </button>

      {/* Modal (reuses your existing modal styles) */}
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div
            className="modal"
            style={{ width: 920, maxWidth: "95vw" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <strong>How to use the ICHRA Quoting Tool</strong>
              <button className="chip" onClick={() => setOpen(false)}>Close</button>
            </div>

            <div className="video-wrap" style={{ marginTop: 12 }}>
              <div className="video-16x9">
                <iframe
                  width="560"
                  height="315"
                  src="https://www.youtube.com/embed/oLtZZHV5frM"
                  title="YouTube video player"
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}