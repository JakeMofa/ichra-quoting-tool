/* client/src/components/Orb.jsx */
import { motion } from "framer-motion";
import { FaPlus } from "react-icons/fa";

export default function Orb({
  size = 320,
  glow = 0.35,
  yFloat = 12,
  duration = 5.6,
}) {
  const s = {
    wrap: {
      position: "absolute",
      width: size,
      height: size,
      borderRadius: "50%",
      pointerEvents: "none",
      boxShadow: `0 0 0 1px rgba(59,130,246,.25) inset,
                  0 12px 30px rgba(2,6,23,.65),
                  0 0 60px rgba(59,130,246,.25)`,
      background: `
        radial-gradient(40% 40% at 45% 35%, rgba(255,255,255,.5), rgba(255,255,255,0) 60%),
        radial-gradient(closest-side, rgba(37,99,235,${glow}), rgba(2,6,23,0) 70%),
        radial-gradient(circle at 50% 60%, rgba(30,64,175,.65), rgba(2,6,23,0) 65%)
      `,
    },
    ring: {
      position: "absolute",
      inset: -2,
      borderRadius: "50%",
      border: "1px solid rgba(148,163,184,.18)",
      background: "radial-gradient(closest-side, rgba(255,255,255,.06), rgba(255,255,255,0) 70%)",
    },
    plusWrap: {
      position: "absolute",
      inset: 0,
      display: "grid",
      placeItems: "center",
      filter: "drop-shadow(0 0 24px rgba(59,130,246,.65))",
    },
    plusIcon: {
      width: Math.round(size * 0.26),
      height: Math.round(size * 0.26),
      color: "#cfe1ff",
    },
  };

  return (
    <motion.div
      style={s.wrap}
      initial={{ y: -6 }}
      animate={{ y: [ -6, yFloat, -6 ] }}
      transition={{ duration, repeat: Infinity, ease: "easeInOut" }}
      aria-hidden
    >
      <div style={s.ring} />
      <motion.div
        style={s.plusWrap}
        initial={{ scale: 0.98 }}
        animate={{ scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
      >
        <FaPlus style={s.plusIcon} />
      </motion.div>
    </motion.div>
  );
}