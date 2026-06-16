// Self-contained celebration: success chime + sparkle popup.
// Call celebrate(points) from anywhere after a successful submit.

export function celebrate(points: number, msg?: string) {
  if (typeof window === "undefined") return;
  playChime();
  showPopup(points, msg);
}

function playChime() {
  try {
    const AC = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AC();
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.09;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    // sound blocked — popup still shows
  }
}

function showPopup(points: number, msg?: string) {
  injectStyles();

  const overlay = document.createElement("div");
  overlay.className = "bh-celebrate";

  const card = document.createElement("div");
const neg = points < 0;
  card.className = "bh-celebrate-card";
  if (neg) card.style.borderColor = "#ef4444";
  card.innerHTML = `
    <div class="bh-celebrate-spark">${neg ? "⚠️" : "✨"}</div>
    <div class="bh-celebrate-pts" style="color:${neg ? "#ef4444" : "#facc15"}">${neg ? points : "+" + points} PTS</div>
    <div class="bh-celebrate-msg">${msg || (neg ? "Points deducted" : "You earned points!")}</div>
  `;
  overlay.appendChild(card);

  // confetti
  const colors = ["#facc15", "#ffffff", "#fde047", "#a3a3a3"];
  for (let i = 0; i < 28 && points >= 0; i++) {
    const c = document.createElement("div");
    c.className = "bh-confetti";
    c.style.left = Math.random() * 100 + "vw";
    c.style.background = colors[i % colors.length];
    c.style.animationDelay = Math.random() * 0.25 + "s";
    c.style.transform = `rotate(${Math.random() * 360}deg)`;
    overlay.appendChild(c);
  }

  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.style.opacity = "0";
    setTimeout(() => overlay.remove(), 400);
  }, 2200);
}

function injectStyles() {
  if (document.getElementById("bh-celebrate-styles")) return;
  const s = document.createElement("style");
  s.id = "bh-celebrate-styles";
  s.textContent = `
    .bh-celebrate{position:fixed;inset:0;z-index:99999;display:flex;
      align-items:center;justify-content:center;pointer-events:none;
      transition:opacity .4s;font-family:monospace;}
    .bh-celebrate-card{background:#141414;border:2px solid #facc15;
      padding:28px 40px;text-align:center;animation:bhPop .4s ease-out;}
    .bh-celebrate-spark{font-size:34px;}
    .bh-celebrate-pts{font-size:46px;font-weight:bold;color:#facc15;
      letter-spacing:1px;margin:4px 0;}
    .bh-celebrate-msg{color:#fff;font-size:14px;}
    .bh-confetti{position:fixed;top:-20px;width:9px;height:14px;
      animation:bhFall 2.2s linear forwards;}
    @keyframes bhPop{0%{transform:scale(.6);opacity:0}
      60%{transform:scale(1.08)}100%{transform:scale(1);opacity:1}}
    @keyframes bhFall{to{top:100vh;opacity:.2}}
  `;
  document.head.appendChild(s);
}
