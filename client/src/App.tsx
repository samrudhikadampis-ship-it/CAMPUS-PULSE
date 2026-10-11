import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "./api";
import {
  Committee,
  Department,
  EventItem,
  Student,
  StudentRegistration,
  DeptSummary,
  FeedbackItem,
  CertificateItem
} from "./types";

// Static fallback data in case database is cold-starting or offline
const FALLBACK_DEPTS: Department[] = [
  { dept_id: "EXTC", name: "Electronics & Telecommunication" },
  { dept_id: "CSE", name: "Computer Science & Engineering" },
  { dept_id: "CE", name: "Computer Engineering" }
];

const FALLBACK_ORGS: Committee[] = [
  { committee_id: "IEEE", name: "IEEE SPIT", tagline: "IEEE student branch", instagram_handle: "ieee_spit" },
  { committee_id: "IEEECS", name: "IEEE CS SPIT", tagline: "IEEE Computer Society chapter", instagram_handle: "ieee.cs.spit" },
  { committee_id: "CSI", name: "C.S.I. SPIT", tagline: "Computer Society of India student branch", instagram_handle: "csispit" },
  { committee_id: "MUDRA", name: "Mudra", tagline: "Dance, music & theatre", instagram_handle: "mudra_spit" },
  { committee_id: "FACE", name: "FACE", tagline: "Placements & career prep", instagram_handle: "face_spit" },
  { committee_id: "OCULUS", name: "Oculus", tagline: "Photography & film", instagram_handle: "o.c.u.l.u.s_s.p.i.t" },
  { committee_id: "ECELL", name: "E-Cell SPIT", tagline: "Entrepreneurship cell", instagram_handle: "ecellspit" },
  { committee_id: "WIE", name: "IEEE WIE SPIT", tagline: "Women in Engineering affinity group", instagram_handle: "wie_ieee_spit" },
  { committee_id: "FEC", name: "FEC SPIT", tagline: "Student committee", instagram_handle: "fec_spit" },
  { committee_id: "ENACTUS", name: "Enactus SPIT", tagline: "Enactus student chapter", instagram_handle: null },
  { committee_id: "AGILITY", name: "Agility Cup", tagline: "Sports & e-sports tournament", instagram_handle: null },
  { committee_id: "CAMPUS", name: "SPIT Campus", tagline: "Institute-level events", instagram_handle: null }
];

const AG_URL = "https://agility-2026.vercel.app/";

const FALLBACK_EVENTS: EventItem[] = [
  {
    event_id: 1, committee_id: "CSI", name: "Codehousie",
    venue_id: "v408", venue: "Room 408 (New building)",
    description: "Competitive Programming × Housie. Every solve gets you closer to a win. Row house, full house and more prizes.",
    start_ts: "2026-10-15 17:00:00", end_ts: "2026-10-15 20:00:00",
    fee: 150, fee_note: "Solo · Duo ₹200", audience: "FE | SE | TE + BE", prize: "₹7,500",
    contact: "Omkar Gajare 98196 66393 · Dron Parekh 88504 02032",
    status: "up", registered: 0,
    links: [
      { link_id: 1, event_id: 1, label: "Solo registration", url: "https://tinyurl.com/598twjvn" },
      { link_id: 2, event_id: 1, label: "Duo registration", url: "https://tinyurl.com/3wzvfbhw" }
    ]
  },
  {
    event_id: 2, committee_id: "CSI", name: "SourceStart",
    venue_id: null, venue: "Online arena",
    description: "Open-source contest. Register, raise your PR and get your name on the leaderboard.",
    start_ts: null, end_ts: null, fee: null, fee_note: null, audience: "All students", prize: "Certificates & Swag",
    contact: null, status: "live", registered: 0,
    links: [
      { link_id: 3, event_id: 2, label: "Join the arena", url: "https://forms.gle/HL1mruv5EfdfJxMY7" },
      { link_id: 4, event_id: 2, label: "Leaderboard", url: "https://git.csispit.site/leaderboard" }
    ]
  },
  {
    event_id: 3, committee_id: "ENACTUS", name: "Rajgad Trek '26",
    venue_id: "raj", venue: "Rajgad Fort",
    description: "Not just a trek. Where history meets adventure. Posters mention 17–18 Oct; one lists 17 Oct only.",
    start_ts: "2026-10-17 06:00:00", end_ts: "2026-10-18 20:00:00", fee: null, fee_note: null,
    audience: "All batches", prize: null, contact: "Riyaa +91 88068 05539 · Diksha +91 74980 65056",
    status: "up", registered: 0,
    links: [
      { link_id: 5, event_id: 3, label: "Registration form", url: "https://docs.google.com/forms/d/e/1FAIpQLScBtyFq56xU93zF8NJ0IHrrl0yYBLogym-lXQIG526CtLCfGA/viewform" },
      { link_id: 6, event_id: 3, label: "Updates group", url: "https://chat.whatsapp.com/KZd9j1bNKrjI4Rqs3U0E1z" }
    ]
  },
  {
    event_id: 4, committee_id: "AGILITY", name: "Table Tennis · Men's Singles",
    venue_id: "gym", venue: "Gymkhana",
    description: "Agility Cup table tennis, men's singles.",
    start_ts: "2026-10-08 09:00:00", end_ts: "2026-10-08 18:00:00", fee: null, fee_note: null,
    audience: "Men", prize: "Trophy + Cash", contact: null, status: "done", registered: 0,
    links: [{ link_id: 7, event_id: 4, label: "Register", url: AG_URL }]
  },
  {
    event_id: 5, committee_id: "AGILITY", name: "Table Tennis · Doubles + Women's Singles",
    venue_id: "gym", venue: "Gymkhana",
    description: "Rescheduled to 26 Oct. Registrations extended.",
    start_ts: "2026-10-26 10:00:00", end_ts: "2026-10-26 19:00:00", fee: null, fee_note: null,
    audience: "All", prize: "Medals", contact: null, status: "up", registered: 0,
    links: [{ link_id: 8, event_id: 5, label: "Register", url: AG_URL }]
  },
  {
    event_id: 6, committee_id: "AGILITY", name: "Chess",
    venue_id: null, venue: "Gymkhana Chess Hall",
    description: "Agility Cup chess, 28 and 29 Oct.",
    start_ts: "2026-10-28 11:00:00", end_ts: "2026-10-29 17:00:00", fee: null, fee_note: null,
    audience: "Open to all", prize: "Trophy", contact: null, status: "up", registered: 0,
    links: [{ link_id: 9, event_id: 6, label: "Register", url: AG_URL }]
  },
  {
    event_id: 7, committee_id: "AGILITY", name: "BGMI",
    venue_id: null, venue: "Online Discord",
    description: "Agility Cup e-sports takeover.",
    start_ts: "2026-10-12 18:00:00", end_ts: "2026-10-12 22:00:00", fee: null, fee_note: null,
    audience: "Teams of 4", prize: "₹5,000", contact: null, status: "live", registered: 0,
    links: [{ link_id: 10, event_id: 7, label: "Register", url: AG_URL }]
  },
  {
    event_id: 8, committee_id: "AGILITY", name: "Free Fire",
    venue_id: null, venue: "Online Discord",
    description: "Agility Cup e-sports takeover.",
    start_ts: "2026-10-13 18:00:00", end_ts: "2026-10-13 22:00:00", fee: null, fee_note: null,
    audience: "Teams of 4", prize: "₹3,000", contact: null, status: "up", registered: 0,
    links: [{ link_id: 11, event_id: 8, label: "Register", url: AG_URL }]
  },
  {
    event_id: 9, committee_id: "AGILITY", name: "FC Mobile & FC 25 (PS5)",
    venue_id: "gym", venue: "Console Room, Gymkhana",
    description: "Agility Cup e-sports takeover.",
    start_ts: "2026-10-15 14:00:00", end_ts: "2026-10-15 19:00:00", fee: null, fee_note: null,
    audience: "Gamers", prize: "₹4,000", contact: null, status: "up", registered: 0,
    links: [{ link_id: 12, event_id: 9, label: "Register", url: AG_URL }]
  },
  {
    event_id: 10, committee_id: "AGILITY", name: "Clash Royale",
    venue_id: null, venue: "Online Discord",
    description: "Agility Cup e-sports takeover.",
    start_ts: "2026-10-16 17:00:00", end_ts: "2026-10-16 20:00:00", fee: null, fee_note: null,
    audience: "Solo", prize: "₹2,500", contact: null, status: "up", registered: 0,
    links: [{ link_id: 13, event_id: 10, label: "Register", url: AG_URL }]
  },
  {
    event_id: 11, committee_id: "CAMPUS", name: "Personal Safety & Self-Defence Workshop",
    venue_id: "gym", venue: "Gymkhana",
    description: "Led by Master Cheetah Yagnesh Shetty. Practical self-defence skills for every fitness level.",
    start_ts: "2026-10-08 16:00:00", end_ts: "2026-10-08 17:00:00", fee: null, fee_note: null,
    audience: "Girls", prize: null, contact: null, status: "done", registered: 0
  },
  {
    event_id: 12, committee_id: "CAMPUS", name: "Sardar Patel Run for Unity 2026",
    venue_id: "powai", venue: "Hiranandani Gardens, Powai",
    description: "10 KM and 5 KM timed runs, 3 KM fun run. Includes T-shirt, finisher medal, goodies and breakfast.",
    start_ts: "2026-11-01 05:30:00", end_ts: "2026-11-01 10:00:00", fee: null, fee_note: "Free for SPIT students (fee reimbursed)",
    audience: "All runners", prize: "Finisher Medals", contact: "Siddhesh Chandanpat 9423416268",
    status: "up", registered: 0,
    links: [{ link_id: 14, event_id: 12, label: "Register", url: "https://registrations.indiarunning.com/spitsardarpatelrunforunity2026-66625" }]
  }
];

const feeText = (e: EventItem) =>
  e.fee ? `₹${e.fee}${e.fee_note ? " · " + e.fee_note : ""}` : e.fee_note || (e.fee === 0 ? "Free" : "Fee: see registration form");

const whenText = (e: EventItem) => {
  if (!e.start_ts) return "Ongoing contest";
  try {
    const s = new Date(e.start_ts.replace(" ", "T"));
    return s.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return e.start_ts;
  }
};

const label: Record<string, string> = {
  live: "LIVE",
  up: "UPCOMING",
  done: "COMPLETED"
};

const CUBE_FACES = ["IEEE", "IEEE CS", "CSI", "MUDRA", "FACE", "OCULUS"];
const CUBE_TRANSFORMS = [
  "rotateY(0) translateZ(100px)",
  "rotateY(90deg) translateZ(100px)",
  "rotateY(180deg) translateZ(100px)",
  "rotateY(270deg) translateZ(100px)",
  "rotateX(90deg) translateZ(100px)",
  "rotateX(-90deg) translateZ(100px)"
];

function requireArray<T>(value: unknown, endpoint: string): T[] {
  if (!Array.isArray(value)) {
    throw new Error(`Invalid response from ${endpoint}: expected an array. Check that the backend API matches the app's expected data shape.`);
  }
  return value as T[];
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export default function App(): React.JSX.Element {
  const [events, setEvents] = useState<EventItem[]>(FALLBACK_EVENTS);
  const [orgs, setOrgs] = useState<Committee[]>(FALLBACK_ORGS);
  const [depts, setDepts] = useState<Department[]>(FALLBACK_DEPTS);
  const [isLoading, setIsLoading] = useState(true);
  const [startupError, setStartupError] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [regs, setRegs] = useState<StudentRegistration[]>([]);
  const [allFeedback, setAllFeedback] = useState<FeedbackItem[]>([]);
  const [allCerts, setAllCerts] = useState<CertificateItem[]>([]);
  const [deptSummary, setDeptSummary] = useState<DeptSummary[]>([]);

  const [active, setActive] = useState<string>(() => localStorage.getItem("cp_active") || "");
  const [q, setQ] = useState<string>("");
  const [selectedOrgs, setSelectedOrgs] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sel, setSel] = useState<EventItem | null>(null);
  const [toast, setToast] = useState<string>("");

  // Alerts & Follows
  const [alerts, setAlerts] = useState<Map<number, string>>(new Map());
  const [follows, setFollows] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [paletteOpen, setPaletteOpen] = useState<boolean>(false);
  const [paletteQuery, setPaletteQuery] = useState<string>("");

  // Registration section form state
  const [regEventId, setRegEventId] = useState<number>(FALLBACK_EVENTS[0].event_id);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cubeRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };

  const run = async (fn: () => Promise<any>, okMsg?: string) => {
    try {
      await fn();
      if (okMsg) say(okMsg);
      await refresh();
    } catch (e: any) {
      say(e.message || "An error occurred");
    }
  };

  const refresh = async () => {
    try {
      const [eventData, studentData, feedbackData, certificateData, summaryData] = await Promise.all([
        api<unknown>("/events").catch(() => FALLBACK_EVENTS),
        api<unknown>("/students").catch(() => []),
        api<unknown>("/feedback").catch(() => []),
        api<unknown>("/certificates").catch(() => []),
        api<unknown>("/dept-summary").catch(() => [])
      ]);
      const evList = requireArray<EventItem>(eventData, "/events");
      const stuList = requireArray<Student>(studentData, "/students");
      const fbList = requireArray<FeedbackItem>(feedbackData, "/feedback");
      const crList = requireArray<CertificateItem>(certificateData, "/certificates");
      const dsList = requireArray<DeptSummary>(summaryData, "/dept-summary");
      setEvents(evList);
      setStudents(stuList);
      setAllFeedback(fbList);
      setAllCerts(crList);
      setDeptSummary(dsList);

      if (active) {
        const studentRegs = await api<StudentRegistration[]>(`/students/${active}/registrations`).catch(() => []);
        setRegs(studentRegs);
      } else {
        setRegs([]);
      }
    } catch (e: any) {
      console.warn("Sync warning:", e.message);
    }
  };

  // Initial load
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [orgData, departmentData, eventData, studentData, feedbackData, certificateData, summaryData, registrationData] = await Promise.all([
          api<unknown>("/committees"),
          api<unknown>("/departments"),
          api<unknown>("/events"),
          api<unknown>("/students"),
          api<unknown>("/feedback"),
          api<unknown>("/certificates"),
          api<unknown>("/dept-summary"),
          active ? api<unknown>(`/students/${active}/registrations`) : Promise.resolve([])
        ]);
        const nextOrgs = requireArray<Committee>(orgData, "/committees");
        const nextDepts = requireArray<Department>(departmentData, "/departments");
        const nextEvents = requireArray<EventItem>(eventData, "/events");
        const nextStudents = requireArray<Student>(studentData, "/students");
        const nextFeedback = requireArray<FeedbackItem>(feedbackData, "/feedback");
        const nextCerts = requireArray<CertificateItem>(certificateData, "/certificates");
        const nextSummary = requireArray<DeptSummary>(summaryData, "/dept-summary");
        const nextRegs = requireArray<StudentRegistration>(registrationData, "/students/:id/registrations");

        if (cancelled) return;
        setOrgs(nextOrgs);
        setDepts(nextDepts);
        setEvents(nextEvents);
        setStudents(nextStudents);
        setAllFeedback(nextFeedback);
        setAllCerts(nextCerts);
        setDeptSummary(nextSummary);
        setRegs(nextRegs);
      } catch (error) {
        if (!cancelled) {
          console.error("CampusPulse startup failed:", error);
          setStartupError(errorText(error));
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  // When active student changes
  const skipInitialActiveLoad = useRef(true);
  useEffect(() => {
    localStorage.setItem("cp_active", active);
    if (skipInitialActiveLoad.current) {
      skipInitialActiveLoad.current = false;
      return;
    }
    if (active) {
      api<unknown>(`/students/${active}/registrations`)
        .then((data) => setRegs(requireArray<StudentRegistration>(data, "/students/:id/registrations")))
        .catch((error) => {
          console.error("CampusPulse registrations failed:", error);
          setStartupError(errorText(error));
          setRegs([]);
        });
    } else {
      setRegs([]);
    }
  }, [active]);

  // Set up 3D Background Canvas animation
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const c = cv.getContext("2d");
    if (!c) return;

    let w = 0, h = 0, dpr = 1, mx = 0, my = 0, smx = 0, smy = 0, t = 0;
    const N = window.innerWidth < 700 ? 60 : 120;
    const P = Array.from({ length: N }, () => [
      Math.random() * 2 - 1,
      Math.random() * 2 - 1,
      Math.random() * 2 - 1
    ]);

    function rs() {
      if (!cv) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = cv.width = window.innerWidth * dpr;
      h = cv.height = window.innerHeight * dpr;
    }
    rs();
    window.addEventListener("resize", rs);

    const onPointerMove = (e: PointerEvent) => {
      mx = e.clientX / window.innerWidth - 0.5;
      my = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("pointermove", onPointerMove);

    let animId: number;
    function frame() {
      t += 0.0035;
      smx += (mx - smx) * 0.05;
      smy += (my - smy) * 0.05;
      const a = t + smx * 1.4 + window.scrollY * 0.0005;
      const b = smy * 0.9 + 0.2;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);

      if (c) {
        c.clearRect(0, 0, w, h);
        const Q = P.map((p) => {
          let x = p[0] * ca + p[2] * sa;
          let z = -p[0] * sa + p[2] * ca;
          const y = p[1] * cb - z * sb;
          z = p[1] * sb + z * cb;
          const k = 2.6 / (2.6 + z + 1.2);
          return [w / 2 + x * w * 0.55 * k, h / 2 + y * h * 0.6 * k, z, k];
        });

        const L = 150 * dpr;
        for (let i = 0; i < N; i++) {
          for (let j = i + 1; j < N; j++) {
            const dx = Q[i][0] - Q[j][0];
            const dy = Q[i][1] - Q[j][1];
            const dist = Math.hypot(dx, dy);
            if (dist < L) {
              c.strokeStyle = `rgba(255,130,40,${(1 - dist / L) * 0.32 * (Q[i][3] + Q[j][3]) / 2 * 1.6})`;
              c.lineWidth = dpr;
              c.beginPath();
              c.moveTo(Q[i][0], Q[i][1]);
              c.lineTo(Q[j][0], Q[j][1]);
              c.stroke();
            }
          }
        }

        for (const q of Q) {
          c.fillStyle = `rgba(255,170,90,${Math.min(1, 0.25 + q[3] * 0.7)})`;
          c.beginPath();
          c.arc(q[0], q[1], (1 + q[3] * 2.4) * dpr, 0, Math.PI * 2);
          c.fill();
        }
      }
      animId = requestAnimationFrame(frame);
    }
    frame();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", rs);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  // 3D Rotating Cube in Hero
  useEffect(() => {
    const sc = sceneRef.current;
    const cb = cubeRef.current;
    if (!sc || !cb) return;

    let rx = -20, ry = 30, dg = false, px = 0, py = 0;
    const isReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const onDown = (e: PointerEvent) => {
      dg = true;
      px = e.clientX;
      py = e.clientY;
      sc.setPointerCapture(e.pointerId);
    };
    const onUp = () => { dg = false; };
    const onMove = (e: PointerEvent) => {
      if (!dg) return;
      ry += (e.clientX - px) * 0.6;
      rx -= (e.clientY - py) * 0.6;
      px = e.clientX;
      py = e.clientY;
    };

    sc.addEventListener("pointerdown", onDown);
    sc.addEventListener("pointerup", onUp);
    sc.addEventListener("pointermove", onMove);

    let anim: number;
    function loop() {
      if (!dg && !isReduced) ry += 0.35;
      if (cb) cb.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
      anim = requestAnimationFrame(loop);
    }
    loop();

    return () => {
      cancelAnimationFrame(anim);
      sc.removeEventListener("pointerdown", onDown);
      sc.removeEventListener("pointerup", onUp);
      sc.removeEventListener("pointermove", onMove);
    };
  }, []);

  // Custom Neon Animated Cursor
  useEffect(() => {
    if (!window.matchMedia("(pointer:fine)").matches) return;
    document.body.classList.add("cc");

    const cd = document.createElement("div");
    const cr = document.createElement("div");
    cd.id = "cd";
    cr.id = "cr";
    document.body.append(cd, cr);

    let x = window.innerWidth / 2, y = window.innerHeight / 2, qx = x, qy = y;

    const onPointerMove = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      cd.style.transform = `translate(${x}px, ${y}px)`;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.closest("input, textarea")) {
        cr.dataset.s = "tx";
      } else if (t.closest(".ev")) {
        cr.dataset.s = "ev";
      } else if (t.closest("a, button, .cm, summary, select, .chip, .day, .stats div")) {
        cr.dataset.s = "hv";
      } else {
        cr.dataset.s = "";
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      cr.classList.add("dn");
      const rp = document.createElement("div");
      rp.className = "rp";
      rp.style.left = e.clientX + "px";
      rp.style.top = e.clientY + "px";
      document.body.append(rp);
      setTimeout(() => rp.remove(), 650);
    };

    const onPointerUp = () => cr.classList.remove("dn");
    const onMouseLeave = () => { cd.style.opacity = "0"; cr.style.opacity = "0"; };
    const onMouseEnter = () => { cd.style.opacity = "1"; cr.style.opacity = "1"; };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    document.documentElement.addEventListener("mouseleave", onMouseLeave);
    document.documentElement.addEventListener("mouseenter", onMouseEnter);

    let animId: number;
    function cursorLoop() {
      qx += (x - qx) * 0.16;
      qy += (y - qy) * 0.16;
      cr.style.transform = `translate(${qx}px, ${qy}px)`;
      animId = requestAnimationFrame(cursorLoop);
    }
    cursorLoop();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.documentElement.removeEventListener("mouseleave", onMouseLeave);
      document.documentElement.removeEventListener("mouseenter", onMouseEnter);
      cd.remove();
      cr.remove();
      document.body.classList.remove("cc");
    };
  }, []);

  // Keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setDrawerOpen(false);
        setSel(null);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Filtered Events
  const shown = useMemo(() => {
    const query = q.toLowerCase();
    return events.filter((e) => {
      const matchOrg = selectedOrgs.size === 0 || selectedOrgs.has(e.committee_id);
      const matchStatus = statusFilter === "all" || e.status === statusFilter;
      const orgItem = orgs.find((o) => o.committee_id === e.committee_id);
      const text = (e.name + (e.venue || "") + (orgItem?.name || "")).toLowerCase();
      return matchOrg && matchStatus && text.includes(query);
    });
  }, [events, q, selectedOrgs, statusFilter, orgs]);

  const liveEvents = useMemo(() => events.filter((e) => e.status === "live"), [events]);
  const me = students.find((s) => s.student_id === active);
  const orgName = (id: string) => orgs.find((o) => o.committee_id === id)?.name || id;

  // Toggle Committee Filter Chip
  const toggleOrgChip = (orgId: string) => {
    setSelectedOrgs((prev) => {
      const next = new Set(prev);
      if (next.has(orgId)) next.delete(orgId);
      else next.add(orgId);
      return next;
    });
  };

  // Toggle Committee Follow
  const toggleFollow = (cid: string) => {
    setFollows((prev) => {
      const next = new Set(prev);
      if (next.has(cid)) {
        next.delete(cid);
        say(`Unfollowed ${orgName(cid)}`);
      } else {
        next.add(cid);
        say(`Following ${orgName(cid)}`);
      }
      return next;
    });
  };

  // Toggle Event Alert
  const toggleAlert = (eid: number, ename: string) => {
    setAlerts((prev) => {
      const next = new Map(prev);
      if (next.has(eid)) {
        next.delete(eid);
        say(`Alert removed for ${ename}`);
      } else {
        const timeStr = new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
        next.set(eid, timeStr);
        say(`Alert set · ${ename}`);
      }
      return next;
    });
  };

  // Printable Certificate Pop-up
  const printCertificate = (r: StudentRegistration) => {
    const certWindow = window.open("", "_blank");
    if (!certWindow) {
      say("Please allow pop-ups to print certificates");
      return;
    }
    const certTitle = `CERT${1000 + (r.cert_id || r.reg_id)}`;
    certWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${certTitle} — CampusPulse SPIT</title>
        <style>
          body {
            font-family: Georgia, 'Times New Roman', serif;
            text-align: center;
            padding: 60px 40px;
            border: 10px double #ff6a00;
            margin: 30px auto;
            max-width: 800px;
            background: #fff;
            color: #111;
          }
          h1 { letter-spacing: 0.25em; font-size: 28px; margin-top: 10px; color: #ff6a00; }
          h2 { font-size: 36px; margin: 20px 0; font-style: italic; }
          .p-lead { font-size: 19px; margin-top: 40px; }
          .cert-no { margin-top: 50px; font-size: 13px; color: #777; font-family: monospace; }
        </style>
      </head>
      <body>
        <div style="font-size: 14px; text-transform: uppercase; letter-spacing: 2px; color: #ff6a00; font-weight: bold;">
          SARDAR PATEL INSTITUTE OF TECHNOLOGY · CAMPUSPULSE
        </div>
        <h1>CERTIFICATE OF PARTICIPATION</h1>
        <p class="p-lead">This certifies that</p>
        <h2>${me ? me.first_name + " " + me.last_name : "Student"}</h2>
        <p style="font-size: 18px;">
          (${me ? `${me.student_id} · ${me.dept_id} · ${me.study_year} ${me.division}` : ""})
        </p>
        <p style="font-size: 18px; margin: 25px 0 10px;">successfully participated in</p>
        <h2 style="font-size: 32px; font-style: normal; color: #111; margin: 10px 0;">${r.name}</h2>
        <p style="font-size: 16px; color: #555;">organised under SPIT committee events, Mumbai</p>
        <p class="cert-no">Certificate ID: ${certTitle} · Date of Issue: ${r.issued_on || "October 2026"}</p>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    certWindow.document.close();
  };

  // Add Student Submission
  const addStudent = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as any;
    run(async () => {
      await api("/students", { method: "POST", body: f });
      setActive(f.student_id);
      form.reset();
    }, "Student profile added · now active");
  };

  // Register for Event Submission
  const handleRegister = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (!active) {
      say("Select or add an active student first");
      return;
    }
    const form = ev.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as any;
    const targetEvent = events.find((e) => e.event_id === regEventId) || sel;
    if (!targetEvent) return;

    run(async () => {
      await api("/registrations", {
        method: "POST",
        body: {
          student_id: active,
          event_id: targetEvent.event_id,
          ...f
        }
      });
      setSel(null);
    }, `Registered for ${targetEvent.name}`);
  };

  // Submit Feedback Submission
  const handleFeedback = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as any;
    if (!feedbackRating) {
      say("Please pick a star rating first");
      return;
    }
    run(async () => {
      await api("/feedback", {
        method: "POST",
        body: {
          reg_id: f.reg_id,
          rating: feedbackRating,
          comments: f.comments
        }
      });
      form.reset();
    }, "Thanks for the verified feedback!");
  };

  // 7 Days dates calculation
  const next7Days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(Date.now() + i * 864e5);
      const iso = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" });
      const dayLabel = d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        timeZone: "Asia/Kolkata"
      });
      const dayEvents = events.filter((e) => {
        if (!e.start_ts) return false;
        const eDate = e.start_ts.split(" ")[0];
        return eDate === iso;
      });
      return { iso, dayLabel, dayEvents };
    });
  }, [events]);

  const eligibleFeedbackRegs = useMemo(() => {
    return regs.filter((r) => r.check_in && !r.rating);
  }, [regs]);

  const currentRegEvent = events.find((e) => e.event_id === regEventId) || events[0];

  const statusViewStyle: React.CSSProperties = {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "var(--bg)",
    color: "var(--tx)"
  };

  if (isLoading) {
    return <main role="status" style={statusViewStyle}>Loading CampusPulse…</main>;
  }

  if (startupError) {
    return (
      <main role="alert" style={statusViewStyle}>
        <div style={{ maxWidth: 640 }}>
          <h1 style={{ color: "var(--or2)", fontSize: 36 }}>CampusPulse couldn't load</h1>
          <p>{startupError}</p>
          <p>Next step: Check that the backend is deployed and client/vercel.json points to it.</p>
        </div>
      </main>
    );
  }

  return (
    <>
      <canvas id="bg" ref={canvasRef} aria-hidden="true" />

      {/* Main Navigation */}
      <nav>
        <div className="w">
          <span className="logo">
            CAMPUS<em>PULSE</em>
          </span>
          <a href="#live">Live</a>
          <a href="#explore">Events</a>
          <a href="#week">7 Days</a>
          <a href="#committees">Committees</a>
          <a href="#register">Register</a>
          <a href="#students">Students</a>
          <a href="#departments">Departments</a>
          <a href="#certificates">Certificates</a>
          <a href="#feedback">Feedback</a>

          <button className="btn g m" onClick={() => setPaletteOpen(true)} title="Command palette">
            Ctrl K
          </button>
          <button className="btn" onClick={() => setDrawerOpen(true)}>
            Alerts <span id="ac">{alerts.size + follows.size}</span>
          </button>
          <button
            className="btn g s"
            style={{ marginLeft: 6 }}
            onClick={() => run(() => api("/admin/issue-certificates", { method: "POST" }), "Certificates issued")}
          >
            Issue certificates
          </button>
        </div>
      </nav>

      {/* Hero Header */}
      <div className="w">
        <header className="hero">
          <div>
            <span className="m" style={{ color: "var(--or2)" }}>
              SPIT · COMMITTEE EVENTS
            </span>
            <h1>
              What's on
              <br />
              at <s>SPIT</s>
            </h1>
            <p>
              Live events, registrations, payments, attendance, feedback and certificates for every committee.
            </p>
            <div className="cta">
              <a className="btn" href="#live">
                See what's live
              </a>
              <a className="btn g" href="#register">
                Register for an event
              </a>
            </div>
          </div>
          <div className="scene" id="sc" ref={sceneRef}>
            <div className="cube" id="cb" ref={cubeRef}>
              {CUBE_FACES.map((faceName, idx) => (
                <div key={faceName} style={{ transform: CUBE_TRANSFORMS[idx] }}>
                  {faceName}
                </div>
              ))}
            </div>
          </div>
        </header>

        {/* Live Statistics Counter */}
        <div className="stats" id="stats">
          <div>
            <b>{liveEvents.length}</b>
            <span>live or ongoing</span>
          </div>
          <div>
            <b>{events.filter((e) => e.status === "up").length}</b>
            <span>starting this week</span>
          </div>
          <div>
            <b>{events.length}</b>
            <span>events listed</span>
          </div>
          <div>
            <b>{orgs.length}</b>
            <span>committees</span>
          </div>
          <div>
            <b>{students.length}</b>
            <span>students on CampusPulse</span>
          </div>
        </div>
      </div>

      {/* Scrolling Marquee */}
      <div className="mq">
        <div>
          {events.map((e) => (
            <span key={e.event_id}>
              {e.status === "live" ? "🔥 LIVE: " : "✦ SOON: "}
              {orgName(e.committee_id)} · {e.name}
            </span>
          ))}
          {events.map((e) => (
            <span key={`dup-${e.event_id}`}>
              {e.status === "live" ? "🔥 LIVE: " : "✦ SOON: "}
              {orgName(e.committee_id)} · {e.name}
            </span>
          ))}
        </div>
      </div>

      <main className="w">
        {/* Section 1: Live Right Now */}
        <section id="live">
          <div className="sh">
            <div>
              <h2>Live right now</h2>
              <p>Happening now or running as an ongoing contest.</p>
            </div>
          </div>
          <div className="grid">
            {liveEvents.length > 0 ? (
              liveEvents.map((e) => (
                <article
                  key={e.event_id}
                  className={"ev " + e.status}
                  onClick={() => setSel(e)}
                >
                  <div className="top">
                    <span className="b">{orgName(e.committee_id)}</span>
                    <span className="tag live">LIVE</span>
                  </div>
                  <h4>{e.name}</h4>
                  <p>
                    {e.venue || "Venue to be announced"}
                    <br />
                    {whenText(e)}
                    <br />
                    {feeText(e)}
                  </p>
                  <div className="bt">
                    <span className="m">{e.registered || 0} registered</span>
                    <button
                      className="nb"
                      aria-pressed={alerts.has(e.event_id)}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        toggleAlert(e.event_id, e.name);
                      }}
                      title="Alert me for this event"
                    >
                      🔔
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="mu">Nothing live right now.</p>
            )}
          </div>
        </section>

        {/* Section 2: Explore Events */}
        <section id="explore">
          <div className="sh">
            <div>
              <h2>Explore events</h2>
              <p>Filter by committee, status or keyword. Tap an event for details and official registration links.</p>
            </div>
            <span className="m">
              {shown.length} of {events.length} events
            </span>
          </div>

          <div className="ctl">
            <input
              type="text"
              placeholder="Search events, venues, committees"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          <div className="ctl">
            {orgs.map((o) => (
              <button
                key={o.committee_id}
                className="chip"
                aria-pressed={selectedOrgs.has(o.committee_id)}
                onClick={() => toggleOrgChip(o.committee_id)}
              >
                {o.name}
              </button>
            ))}
          </div>

          <div className="ctl">
            {["all", "live", "up", "done"].map((s) => (
              <button
                key={s}
                className="chip"
                aria-pressed={statusFilter === s}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all" ? "All" : label[s]}
              </button>
            ))}
          </div>

          <div className="grid">
            {shown.map((e) => (
              <article
                key={e.event_id}
                className={"ev " + e.status}
                onClick={() => setSel(e)}
              >
                <div className="top">
                  <span className="b">{orgName(e.committee_id)}</span>
                  <span className={"tag " + (e.status === "live" ? "live" : "")}>
                    {label[e.status]}
                  </span>
                </div>
                <h4>{e.name}</h4>
                <p>
                  {e.venue || "Venue to be announced"}
                  <br />
                  {whenText(e)}
                  <br />
                  {feeText(e)}
                </p>
                <div className="bt">
                  <span className="m">{e.registered || 0} registered</span>
                  {e.status !== "done" && (
                    <button
                      className="nb"
                      aria-pressed={alerts.has(e.event_id)}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        toggleAlert(e.event_id, e.name);
                      }}
                      title="Alert me for this event"
                    >
                      🔔
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Section 3: Next Seven Days */}
        <section id="week">
          <div className="sh">
            <div>
              <h2>Next seven days</h2>
              <p>Dated events across every committee.</p>
            </div>
          </div>
          <div className="week">
            {next7Days.map(({ iso, dayLabel, dayEvents }) => (
              <div key={iso} className="day">
                <h3>
                  {dayLabel}
                  <span>{dayEvents.length} events</span>
                </h3>
                {dayEvents.length > 0 ? (
                  dayEvents.map((de) => (
                    <div
                      key={de.event_id}
                      className="it"
                      style={{ cursor: "pointer" }}
                      onClick={() => setSel(de)}
                    >
                      {de.name}
                      <small>
                        {orgName(de.committee_id)} · {whenText(de)}
                      </small>
                    </div>
                  ))
                ) : (
                  <div className="it" style={{ borderColor: "var(--line)", color: "var(--mu)" }}>
                    Nothing scheduled
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Section 4: Committees */}
        <section id="committees">
          <div className="sh">
            <div>
              <h2>Committees</h2>
              <p>Follow a committee to be alerted when it posts. Each card links to its Instagram.</p>
            </div>
          </div>
          <div className="grid">
            {orgs.map((o) => {
              const committeeEvents = events.filter((e) => e.committee_id === o.committee_id);
              const isFollowed = follows.has(o.committee_id);
              return (
                <div key={o.committee_id} className="cm">
                  <h3>{o.name}</h3>
                  <p>{o.tagline || "SPIT student committee"}</p>
                  <dl>
                    <div>
                      <dt>Events</dt>
                      <dd>{committeeEvents.length}</dd>
                    </div>
                    <div>
                      <dt>Live</dt>
                      <dd>{committeeEvents.filter((e) => e.status === "live").length}</dd>
                    </div>
                    <div>
                      <dt>Done</dt>
                      <dd>{committeeEvents.filter((e) => e.status === "done").length}</dd>
                    </div>
                  </dl>
                  {o.instagram_handle && (
                    <a
                      className="btn g"
                      href={`https://www.instagram.com/${o.instagram_handle}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      @{o.instagram_handle} ↗
                    </a>
                  )}
                  <button
                    className={"btn " + (isFollowed ? "" : "g")}
                    onClick={() => toggleFollow(o.committee_id)}
                  >
                    {isFollowed ? "Following" : "Follow"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 5: Registration & Payment */}
        <section id="register">
          <div className="sh">
            <div>
              <h2>Registration &amp; payment</h2>
              <p>Register as the active student, record your payment reference, and track attendance.</p>
            </div>
            <span className="m mu">
              {me
                ? `Active student: ${me.first_name} ${me.last_name} · ${me.student_id}`
                : "No active student"}
            </span>
          </div>

          <div className="panel pad">
            {me ? (
              <form onSubmit={handleRegister}>
                <div className="fg">
                  <label>
                    Event
                    <select
                      className="in"
                      value={regEventId}
                      onChange={(e) => setRegEventId(+e.target.value)}
                    >
                      {events.map((x) => (
                        <option key={x.event_id} value={x.event_id}>
                          {x.name} · {orgName(x.committee_id)}
                          {x.status === "done" ? " (completed)" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Fee
                    <div className="in" style={{ background: "var(--card2)" }}>
                      {currentRegEvent ? feeText(currentRegEvent) : "Free"}
                    </div>
                  </label>
                  {currentRegEvent && (currentRegEvent.fee || 0) > 0 && (
                    <>
                      <label>
                        Payment method
                        <select className="in" name="method">
                          <option>UPI</option>
                          <option>Card</option>
                          <option>Cash</option>
                        </select>
                      </label>
                      <label>
                        Transaction reference
                        <input
                          className="in"
                          name="txn_ref"
                          placeholder="UPI ref / receipt no."
                          required
                        />
                      </label>
                    </>
                  )}
                </div>
                <div className="ctl" style={{ margin: 0 }}>
                  <button className="btn">
                    Register {me.first_name}
                  </button>
                  {currentRegEvent?.links?.map((l) => (
                    <a
                      key={l.link_id}
                      className="btn g s"
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {l.label} ↗
                    </a>
                  ))}
                </div>
                <p className="note" style={{ marginTop: 12 }}>
                  Completed events can be logged too, for record-keeping. Payments are stored as "Submitted" until a committee member verifies the reference.
                </p>
              </form>
            ) : (
              <p className="em">
                Add a student profile first, then come back to register.{" "}
                <a href="#students" style={{ color: "var(--or2)" }}>
                  Go to Students →
                </a>
              </p>
            )}
          </div>

          {/* Registrations List */}
          <div className="panel ow" style={{ marginTop: 16 }}>
            <h4 style={{ padding: "18px 0 10px", fontSize: 24 }}>My Registrations</h4>
            <table className="tb">
              <thead>
                <tr>
                  <th>Reg ID</th>
                  <th>Event</th>
                  <th>Registered on</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Attendance (Desk)</th>
                  <th>Certificate</th>
                </tr>
              </thead>
              <tbody>
                {regs.length > 0 ? (
                  regs.map((r) => (
                    <tr key={r.reg_id}>
                      <td>REG-{r.reg_id}</td>
                      <td>{r.name}</td>
                      <td>{r.registered_on}</td>
                      <td>
                        <span className="b ok">{r.event_status}</span>
                      </td>
                      <td>
                        {r.pay_status ? (
                          <span className="b wait">
                            {r.pay_status} · ₹{r.amount}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {r.check_in ? (
                          <>
                            <span className="b ok">Present</span>{" "}
                            {!r.check_out && (
                              <button
                                className="btn g s"
                                onClick={() =>
                                  run(
                                    () =>
                                      api("/attendance/check-out", {
                                        method: "POST",
                                        body: { reg_id: r.reg_id }
                                      }),
                                    "Checked out"
                                  )
                                }
                              >
                                Check out
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            className="btn g s"
                            onClick={() =>
                              run(
                                () =>
                                  api("/attendance/check-in", {
                                    method: "POST",
                                    body: { reg_id: r.reg_id }
                                  }),
                                "Checked in"
                              )
                            }
                          >
                            Check in
                          </button>
                        )}
                      </td>
                      <td>
                        {r.cert_id ? (
                          <span className="b ok">CERT{1000 + r.cert_id}</span>
                        ) : (
                          <span className="b no">
                            {r.check_in ? "After event ends" : "Not eligible"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="mu">
                      No registrations for this student yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 6: Students */}
        <section id="students">
          <div className="sh">
            <div>
              <h2>Students</h2>
              <p>Add a profile, then choose the active student.</p>
            </div>
          </div>

          <form className="panel pad" onSubmit={addStudent}>
            <div className="fg">
              <label>
                Student ID
                <input className="in" name="student_id" placeholder="UID / Roll no." required />
              </label>
              <label>
                First name
                <input className="in" name="first_name" required />
              </label>
              <label>
                Last name
                <input className="in" name="last_name" required />
              </label>
              <label>
                Department
                <select className="in" name="dept_id">
                  {depts.map((d) => (
                    <option key={d.dept_id} value={d.dept_id}>
                      {d.dept_id} · {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Year
                <select className="in" name="study_year">
                  <option>FE</option>
                  <option>SE</option>
                  <option>TE</option>
                  <option>BE</option>
                </select>
              </label>
              <label>
                Division
                <input className="in" name="division" placeholder="A" required />
              </label>
              <label>
                Phone
                <input className="in" name="phone" inputMode="tel" />
              </label>
              <label>
                Email
                <input className="in" name="email" type="email" />
              </label>
              <label>
                Gender
                <select className="in" name="gender">
                  <option>Female</option>
                  <option>Male</option>
                  <option>Other</option>
                </select>
              </label>
              <label>
                Date of birth
                <input className="in" name="dob" type="date" />
              </label>
            </div>
            <button className="btn">Add student</button>
          </form>

          <div className="panel ow">
            <table className="tb">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Dept</th>
                  <th>Year · Div</th>
                  <th>Registered / Attended</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.student_id}>
                    <td>{s.student_id}</td>
                    <td>
                      {s.first_name} {s.last_name}
                    </td>
                    <td>{s.dept_id}</td>
                    <td>
                      {s.study_year} · {s.division}
                    </td>
                    <td>
                      {s.reg_count || 0} / {s.att_count || 0}
                    </td>
                    <td>
                      {active === s.student_id ? (
                        <span className="b ok">Active</span>
                      ) : (
                        <button className="btn g s" onClick={() => setActive(s.student_id)}>
                          Use
                        </button>
                      )}{" "}
                      <button
                        className="btn g s"
                        onClick={() =>
                          run(async () => {
                            await api(`/students/${s.student_id}`, { method: "DELETE" });
                            if (active === s.student_id) setActive("");
                          }, "Student removed")
                        }
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 7: Student Departments Analytics */}
        <section id="departments">
          <div className="sh">
            <div>
              <h2>Student departments</h2>
              <p>Students, registrations, attendance and certificates by department.</p>
            </div>
          </div>
          <div className="grid">
            {depts.map((d) => {
              const deptStudents = students.filter((s) => s.dept_id === d.dept_id);
              const summary = deptSummary.find((ds) => ds.dept_id === d.dept_id);
              return (
                <div key={d.dept_id} className="cm dp">
                  <span className="m mu">{d.dept_id}</span>
                  <h3>{d.dept_id}</h3>
                  <p>{d.name}</p>
                  <dl>
                    <div>
                      <dt>Students</dt>
                      <dd>{summary?.students ?? deptStudents.length}</dd>
                    </div>
                    <div>
                      <dt>Attended</dt>
                      <dd>{summary?.attended ?? 0}</dd>
                    </div>
                    <div>
                      <dt>Certs</dt>
                      <dd>{summary?.certs ?? 0}</dd>
                    </div>
                  </dl>
                  <div className="chips">
                    {deptStudents.length > 0 ? (
                      deptStudents.map((s) => (
                        <span key={s.student_id} className="tag">
                          {s.first_name} {s.last_name} · {s.study_year}
                        </span>
                      ))
                    ) : (
                      <span className="m mu">No students enrolled yet</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 8: Certificates */}
        <section id="certificates">
          <div className="sh">
            <div>
              <h2>Certificates</h2>
              <p>Issued only to students whose attendance was recorded at an event that has ended.</p>
            </div>
          </div>

          <div className="grid">
            {regs.filter((r) => r.cert_id).length > 0 ? (
              regs
                .filter((r) => r.cert_id)
                .map((r) => (
                  <div key={r.reg_id} className="cert">
                    <span className="m mu">CERTIFICATE · CERT{1000 + (r.cert_id || 0)}</span>
                    <h3>{r.cert_type || "Participation"}</h3>
                    <p>
                      This certifies that{" "}
                      <b>{me ? me.first_name + " " + me.last_name : "Student"}</b> (
                      {me ? `${me.student_id} · ${me.dept_id} · ${me.study_year} ${me.division}` : ""})
                      participated in <b>{r.name}</b>.
                    </p>
                    <span className="m mu">Issued {r.issued_on || "October 2026"}</span>
                    <div>
                      <button className="btn g s" onClick={() => printCertificate(r)}>
                        Print / Save PDF
                      </button>
                    </div>
                  </div>
                ))
            ) : (
              <p className="mu">
                {me
                  ? "No certificates yet. You need attendance recorded at an event that has ended."
                  : "Select an active student to view certificates."}
              </p>
            )}
          </div>

          {/* Eligibility Breakdown */}
          {regs.length > 0 && (
            <div className="panel ow" style={{ marginTop: 20 }}>
              <h4 style={{ padding: "18px 0 10px", fontSize: 24 }}>Certificate Eligibility</h4>
              <table className="tb">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Attended</th>
                    <th>Event Ended</th>
                    <th>Certificate</th>
                  </tr>
                </thead>
                <tbody>
                  {regs.map((r) => (
                    <tr key={r.reg_id}>
                      <td>{r.name}</td>
                      <td>
                        <span className={"b " + (r.check_in ? "ok" : "no")}>
                          {r.check_in ? "Yes" : "No"}
                        </span>
                      </td>
                      <td>
                        <span className={"b " + (r.event_status === "done" ? "ok" : "wait")}>
                          {r.event_status === "done" ? "Yes" : "Not yet"}
                        </span>
                      </td>
                      <td>
                        {r.cert_id ? (
                          <span className="b ok">CERT{1000 + r.cert_id}</span>
                        ) : (
                          <span className="b no">
                            {!r.check_in ? "Not eligible" : "After event ends"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Section 9: Verified Feedback */}
        <section id="feedback">
          <div className="sh">
            <div>
              <h2>Feedback</h2>
              <p>Only students who attended an event can rate it.</p>
            </div>
          </div>

          <div className="panel pad">
            {eligibleFeedbackRegs.length > 0 ? (
              <form onSubmit={handleFeedback}>
                <div className="fg">
                  <label>
                    Event
                    <select className="in" name="reg_id">
                      {eligibleFeedbackRegs.map((r) => (
                        <option key={r.reg_id} value={r.reg_id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="ctl">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className="chip"
                      aria-pressed={feedbackRating === star}
                      onClick={() => setFeedbackRating(star)}
                    >
                      {star} ★
                    </button>
                  ))}
                </div>
                <div className="fg">
                  <label>
                    Comments
                    <textarea className="in" name="comments" rows={3} placeholder="Share your experience..." />
                  </label>
                </div>
                <button className="btn">Submit feedback</button>
              </form>
            ) : (
              <p className="em">
                {me
                  ? "No events pending feedback. Feedback opens once your attendance is marked at an event."
                  : "Select an active student first."}
              </p>
            )}
          </div>

          {/* Feedback ledger */}
          <div className="panel ow" style={{ marginTop: 16 }}>
            <h4 style={{ padding: "18px 0 10px", fontSize: 24 }}>Feedback History</h4>
            <table className="tb">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Student</th>
                  <th>Rating</th>
                  <th>Comments</th>
                </tr>
              </thead>
              <tbody>
                {allFeedback.length > 0 ? (
                  allFeedback.map((fb) => (
                    <tr key={fb.feedback_id}>
                      <td>{fb.event_name}</td>
                      <td>
                        {fb.first_name} {fb.last_name}
                      </td>
                      <td style={{ color: "var(--or2)", letterSpacing: "2px" }}>
                        {"★".repeat(fb.rating)}
                        {"☆".repeat(5 - fb.rating)}
                      </td>
                      <td>{fb.comments || "No comments"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="mu">
                      No feedback submitted yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 10: How It Works */}
        <section id="how">
          <div className="sh">
            <div>
              <h2>How it works</h2>
              <p>From poster to certificate in six steps.</p>
            </div>
          </div>
          <div className="grid">
            {[
              ["Discover", "Browse live and upcoming events from every committee."],
              ["Follow", "Follow committees and set alerts so you never miss a post."],
              ["Register", "Sign up on the official link, then record it here."],
              ["Pay", "Log your UPI, card or cash reference for paid events."],
              ["Attend", "Check in and out at the committee desk."],
              ["Get certified", "Certificates unlock once you attended and the event has ended."]
            ].map(([title, desc], idx) => (
              <div key={title} className="cm">
                <span className="m mu">STEP {idx + 1}</span>
                <h3>{title}</h3>
                <p>{desc}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <div className="w">
        <footer>
          <span>CampusPulse · Built for SPIT students</span>
          <span className="m">
            Live MySQL 8.0+ Database · TypeScript React Frontend &amp; Express Backend
          </span>
        </footer>
      </div>

      {/* Alerts Slide-Out Drawer */}
      <aside id="dr" className={drawerOpen ? "o" : ""} aria-label="My alerts">
        <button className="btn g" style={{ float: "right" }} onClick={() => setDrawerOpen(false)}>
          Close
        </button>
        <h3>My alerts</h3>
        <div id="al">
          {follows.size === 0 && alerts.size === 0 ? (
            <p className="mu">No alerts yet. Tap 🔔 on an event or follow a committee.</p>
          ) : (
            <>
              {Array.from(follows).map((cid) => (
                <div key={cid} className="al">
                  <b>{orgName(cid)}</b>
                  <br />
                  <small className="m">Following committee</small>
                </div>
              ))}
              {Array.from(alerts.entries()).map(([eid, timeStr]) => {
                const evItem = events.find((e) => e.event_id === eid);
                return (
                  <div key={eid} className="al">
                    <b>{evItem?.name || `Event ${eid}`}</b>
                    <br />
                    <small className="m">
                      {evItem ? orgName(evItem.committee_id) : ""} · alert set {timeStr}
                    </small>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </aside>

      {/* Command Palette (Ctrl+K) */}
      <div
        id="pal"
        className={paletteOpen ? "o" : ""}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPaletteOpen(false);
        }}
      >
        <div>
          <input
            id="pi"
            placeholder="Jump to an event or committee…"
            aria-label="Command search"
            value={paletteQuery}
            autoFocus
            onChange={(e) => setPaletteQuery(e.target.value)}
          />
          <div id="pr">
            {[
              ...orgs.map((o) => ({ text: o.name, cat: "Committee", val: o.name })),
              ...events.map((e) => ({ text: e.name, cat: orgName(e.committee_id), val: e.name }))
            ]
              .filter((item) => item.text.toLowerCase().includes(paletteQuery.toLowerCase()))
              .slice(0, 8)
              .map((item, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setQ(item.val);
                    setPaletteOpen(false);
                    const el = document.getElementById("explore");
                    if (el) el.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  <span>{item.text}</span>
                  <span className="m">{item.cat}</span>
                </button>
              ))}
          </div>
        </div>
      </div>

      {/* Event Details Modal */}
      {sel && (
        <div
          id="mo"
          className="o"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSel(null);
          }}
        >
          <div id="mb">
            <button
              className="btn g s"
              style={{ float: "right" }}
              onClick={() => setSel(null)}
            >
              Close
            </button>
            <span className="m mu">EVT-{String(sel.event_id).padStart(2, "0")}</span>
            <h3>{sel.name}</h3>
            <p className="mu">{sel.description}</p>

            <dl className="kv">
              <div>
                <dt>Organised by</dt>
                <dd>{orgName(sel.committee_id)}</dd>
              </div>
              <div>
                <dt>When</dt>
                <dd>{whenText(sel)}</dd>
              </div>
              <div>
                <dt>Venue</dt>
                <dd>{sel.venue || "To be announced"}</dd>
              </div>
              <div>
                <dt>Fee</dt>
                <dd>{feeText(sel)}</dd>
              </div>
              {sel.audience && (
                <div>
                  <dt>Audience</dt>
                  <dd>{sel.audience}</dd>
                </div>
              )}
              {sel.prize && (
                <div>
                  <dt>Prize pool</dt>
                  <dd>{sel.prize}</dd>
                </div>
              )}
              {sel.contact && (
                <div style={{ gridColumn: "span 2" }}>
                  <dt>Queries</dt>
                  <dd>{sel.contact}</dd>
                </div>
              )}
            </dl>

            <div className="ctl">
              {sel.links?.map((l) => (
                <a
                  key={l.link_id}
                  className="btn g s"
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {l.label} ↗
                </a>
              ))}
              <button
                className="btn s"
                onClick={() => {
                  setRegEventId(sel.event_id);
                  setSel(null);
                  const el = document.getElementById("register");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Record my registration
              </button>
            </div>

            <p className="note" style={{ marginTop: 16 }}>
              Official sign-up happens on the committee's own link above. "Record my registration" tracks it here for payment, attendance, feedback and certificates.
            </p>
          </div>
        </div>
      )}

      {/* Toast Notification Element */}
      <div id="ts" className={toast ? "s" : ""} role="status">
        {toast}
      </div>
    </>
  );
}
