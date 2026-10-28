import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, setAuthToken } from "./api";
import {
  Committee,
  Department,
  EventItem,
  StudentRegistration,
  FeedbackItem,
  Venue
} from "./types";

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
const registrationState = (event: EventItem): "Open" | "Full" | "Closed" => {
  if (!event.registration_open || event.status === "done" ||
      (event.registration_closes_at && Date.parse(event.registration_closes_at.replace(" ", "T")) <= Date.now())) {
    return "Closed";
  }
  if (event.remaining != null && Number(event.remaining) <= 0) return "Full";
  return "Open";
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

interface AuthUser {
  account_id: number;
  username: string;
  role: "admin" | "student" | "committee";
  student_id: string | null;
  committee_id: string | null;
  first_name?: string;
  last_name?: string;
  dept_id?: string;
  study_year?: string;
  division?: string;
  email?: string | null;
  is_active?: boolean | number;
  department_verified?: boolean | number;
}

interface StudentSignup {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
}

interface AdminSignup extends StudentSignup {
  committee_id: string;
}

function SignIn({
  onSignedIn,
  onRegister,
  onAdminRegister
}: {
  onSignedIn: (role: "admin" | "student", username: string, password: string, committeeId?: string) => Promise<void>;
  onRegister: (details: StudentSignup) => Promise<void>;
  onAdminRegister: (details: AdminSignup) => Promise<void>;
}): React.JSX.Element {
  const [role, setRole] = useState<"admin" | "student">("student");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [loginCommittees, setLoginCommittees] = useState<Committee[]>([]);
  const [loginCommitteeId, setLoginCommitteeId] = useState("");
  const [committeesLoading, setCommitteesLoading] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    if (role !== "admin") return;
    let mounted = true;
    api<Committee[]>("/committees").then((items) => {
      if (mounted) {
        setLoginCommittees(items);
        setLoginCommitteeId(items[0]?.committee_id || "");
      }
    }).catch((cause: unknown) => {
      if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load committee choices.");
    });
    return () => { mounted = false; };
  }, [role]);

  useEffect(() => {
    if (!creating || role !== "admin") return;
    let mounted = true;
    setCommitteesLoading(true);
    api<Committee[]>("/committees").then((committeeList) => {
      if (!mounted) return;
      setLoginCommittees(committeeList);
      setLoginCommitteeId(committeeList[0]?.committee_id || "");
      setError("");
    }).catch((cause: unknown) => {
      if (mounted) setError(cause instanceof Error ? cause.message : "Unable to load committees.");
    }).finally(() => {
      if (mounted) setCommitteesLoading(false);
    });
    return () => { mounted = false; };
  }, [creating, role]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      await onSignedIn(
        role,
        String(values.get("username") || ""),
        String(values.get("password") || ""),
        role === "admin" ? loginCommitteeId : undefined
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in.");
    } finally {
      setPending(false);
    }
  };

  const submitRegistration = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    setNotice("");
    try {
      const details: StudentSignup = {
        first_name: String(values.get("first_name") || "").trim(),
        last_name: String(values.get("last_name") || "").trim(),
        email: String(values.get("email") || "").trim(),
        password: String(values.get("password") || "")
      };
      if (role === "student") {
        await onRegister(details);
      } else {
        await onAdminRegister({ ...details, committee_id: String(values.get("committee_id") || "") });
        setNotice("Your admin request was sent for approval. You can sign in after a superadmin approves it.");
        setCreating(false);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to complete registration.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="auth-shell">
      <section className="auth-card panel pad">
        <span className="logo">CAMPUS<em>PULSE</em></span>
        <h1>{role === "admin" ? "Admin portal" : "Student portal"}</h1>
        <p className="mu">{creating ? `Create a ${role} account to continue.` : "Sign in with your CampusPulse account to continue."}</p>
        <div className="ctl" role="group" aria-label="Choose a sign-in portal">
          {(["student", "admin"] as const).map((portal) => (
            <button key={portal} className="chip" aria-pressed={role === portal} onClick={() => { setRole(portal); setCreating(false); setError(""); setNotice(""); }}>
              {portal === "student" ? "Student" : "Admin"}
            </button>
          ))}
        </div>
        {creating ? (
          <form onSubmit={submitRegistration}>
            <div className="fg">
              <label>First name<input className="in" name="first_name" maxLength={50} autoComplete="given-name" required /></label>
              <label>Last name<input className="in" name="last_name" maxLength={50} autoComplete="family-name" required /></label>
              <label>Email<input className="in" name="email" type="email" maxLength={120} autoComplete="email" required /></label>
              {role === "admin" && <label>Choose Committee
                <select className="in" name="committee_id" value={loginCommitteeId} onChange={(change) => setLoginCommitteeId(change.target.value)}
                  disabled={committeesLoading || !loginCommittees.length} required>
                  {loginCommittees.map((committee) => <option key={committee.committee_id} value={committee.committee_id}>{committee.name}</option>)}
                </select>
              </label>}
              <label>Create Password <span className="mu">(12+ characters)</span>
                <input className="in" name="password" type={passwordVisible ? "text" : "password"} minLength={12} maxLength={256} autoComplete="new-password" required />
                <button className="btn g s" type="button" aria-pressed={passwordVisible} onClick={() => setPasswordVisible(!passwordVisible)}>
                  {passwordVisible ? "Hide password" : "Show password"}
                </button>
              </label>
            </div>
            <p className="note">Your department is saved as self-reported until an administrator verifies it. Department-restricted events remain unavailable until then.</p>
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="btn" disabled={pending || committeesLoading || (role === "admin" && !loginCommittees.length)}>
              {pending ? "Creating your account…" : `Create ${role} account`}
            </button>
            <button className="btn g" type="button" disabled={pending} onClick={() => { setCreating(false); setError(""); }}>Back to sign in</button>
          </form>
        ) : (
          <>
            <form onSubmit={submit}>
              <div className="fg">
                <label>
                  {role === "admin" ? "Admin email" : "Student email or ID"}
                  <input className="in" name="username" autoComplete="username" required />
                </label>
                {role === "admin" && <label>
                  Manage committee
                  <select className="in" value={loginCommitteeId} onChange={(change) => setLoginCommitteeId(change.target.value)} required>
                    {loginCommittees.map((committee) => <option key={committee.committee_id} value={committee.committee_id}>{committee.name}</option>)}
                  </select>
                </label>}
                <label>
                  Password
                  <input className="in" name="password" type={passwordVisible ? "text" : "password"} autoComplete="current-password" required />
                  <button className="btn g s" type="button" aria-pressed={passwordVisible} onClick={() => setPasswordVisible(!passwordVisible)}>
                    {passwordVisible ? "Hide password" : "Show password"}
                  </button>
                </label>
              </div>
              {error && <p className="auth-error" role="alert">{error}</p>}
              {notice && <p className="note" role="status">{notice}</p>}
              <button className="btn" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
            </form>
            <button className="btn g" type="button" onClick={() => { setCreating(true); setError(""); setNotice(""); }}>
              {role === "student" ? "Create a student account" : "Create an admin account"}
            </button>
            {role === "admin" && <p className="note">Admin access is restricted to authorized accounts. Committee accounts sign in here and remain limited to their assigned committee.</p>}
          </>
        )}
      </section>
    </main>
  );
}

export default function App(): React.JSX.Element {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [orgs, setOrgs] = useState<Committee[]>([]);
  const [depts, setDepts] = useState<Department[]>([]);
  const [venues, setVenues] = useState<Venue[]>([]);
  const [regs, setRegs] = useState<StudentRegistration[]>([]);
  const [adminRegistrations, setAdminRegistrations] = useState<StudentRegistration[]>([]);
  const [pendingAccounts, setPendingAccounts] = useState<{ account_id: number; first_name: string; last_name: string; email: string; committee_id: string; committee_name: string }[]>([]);
  const [allFeedback, setAllFeedback] = useState<FeedbackItem[]>([]);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [managedCommitteeId, setManagedCommitteeId] = useState(() => localStorage.getItem("cp_managed_committee") || "");
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [active, setActive] = useState("");
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
  const [regEventId, setRegEventId] = useState<number>(0);
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [feedbackCommitteeId, setFeedbackCommitteeId] = useState("");
  const [feedbackEventId, setFeedbackEventId] = useState("");
  const [feedbackRequestId, setFeedbackRequestId] = useState(() => crypto.randomUUID());
  const [weekOffset, setWeekOffset] = useState(0);
  const [certificateEventId, setCertificateEventId] = useState("");
  const [applicationAnswer, setApplicationAnswer] = useState("");
  const [editingEvent, setEditingEvent] = useState<EventItem | null>(null);
  const [editingCommittee, setEditingCommittee] = useState<Committee | null>(null);
  const [registrationStep, setRegistrationStep] = useState<1 | 2>(1);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cubeRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<HTMLDivElement | null>(null);

  const say = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(""), 2600);
  };

  const signIn = async (role: "admin" | "student", username: string, password: string, committeeId?: string) => {
    const result = await api<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: { role, username, password }
    });
    setAuthToken(result.token);
    setUser(result.user);
    setActive(result.user.student_id || "");
    const selected = result.user.role === "committee" ? result.user.committee_id : committeeId;
    if (selected) {
      localStorage.setItem("cp_managed_committee", selected);
      setManagedCommitteeId(selected);
    }
  };

  const registerStudent = async (details: StudentSignup) => {
    const result = await api<{ token: string; user: AuthUser }>("/auth/register-student", {
      method: "POST",
      body: details
    });
    setAuthToken(result.token);
    setUser(result.user);
    setActive(result.user.student_id || "");
  };

  const registerAdmin = async (details: AdminSignup) => {
    await api("/auth/register-admin", { method: "POST", body: details });
  };

  const signOut = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (cause) {
      say(cause instanceof Error ? cause.message : "Session ended locally.");
    } finally {
      setAuthToken(null);
      setUser(null);
      setActive("");
      setRegs([]);
      setAdminRegistrations([]);
      setPendingAccounts([]);
      setAllFeedback([]);
      setAlerts(new Map());
      setFollows(new Set());
    }
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
    if (!user) return;
    setDataLoading(true);
    setSyncError("");
    try {
      const [evList, committeeList, departmentList, venueList, profile] = await Promise.all([
        api<EventItem[]>("/events"),
        api<Committee[]>("/committees"),
        api<Department[]>("/departments"),
        api<Venue[]>("/venues"),
        user.role === "student" ? api<{ user: AuthUser }>("/auth/me") : Promise.resolve(null)
      ]);
      if (profile) setUser(profile.user);
      setEvents(evList);
      setOrgs(committeeList);
      setDepts(departmentList);
      setVenues(venueList);
      if (user.role === "admin") {
        setPendingAccounts(await api("/admin/accounts/pending"));
      } else {
        setPendingAccounts([]);
      }
      if (user.role === "admin" || user.role === "committee") {
        const committeeId = user.role === "committee" ? user.committee_id : managedCommitteeId;
        if (!committeeId) {
          setAdminRegistrations([]);
          setAllFeedback([]);
          return;
        }
        const scope = `?committee_id=${encodeURIComponent(committeeId)}`;
        const [fbList, registrationList] = await Promise.all([
          api<FeedbackItem[]>(`/feedback${scope}`),
          api<StudentRegistration[]>(`/admin/registrations${scope}`)
        ]);
        setAllFeedback(fbList);
        setAdminRegistrations(registrationList);
      } else if (user.role === "student" && user.student_id) {
        const [studentRegs, fbList, followList, alertList] = await Promise.all([
          api<StudentRegistration[]>(`/students/${encodeURIComponent(user.student_id)}/registrations`),
          api<FeedbackItem[]>("/feedback"),
          api<string[]>("/follows"),
          api<{ event_id: number; set_at: string }[]>("/alerts")
        ]);
        setRegs(studentRegs);
        setAllFeedback(fbList);
        setFollows(new Set(followList));
        setAlerts(new Map(alertList.map((alert) => [alert.event_id, alert.set_at])));
        setAdminRegistrations([]);
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Could not load live CampusPulse data.";
      setSyncError(message);
      if (!localStorage.getItem("cp_auth_token")) void signOut();
    } finally {
      setDataLoading(false);
    }
  };

  // Restore only a server-validated session; the browser never chooses a student identity.
  useEffect(() => {
    if (!localStorage.getItem("cp_auth_token")) {
      setAuthLoading(false);
      return;
    }
    api<{ user: AuthUser }>("/auth/me")
      .then(({ user: restored }) => {
        setUser(restored);
        setActive(restored.student_id || "");
        if (restored.role === "committee" && restored.committee_id) {
          localStorage.setItem("cp_managed_committee", restored.committee_id);
          setManagedCommitteeId(restored.committee_id);
        }
      })
      .catch(() => setAuthToken(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 30_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [user, managedCommitteeId]);

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
  const me = user?.role === "student" ? user : undefined;
  const staffCommitteeId = user?.role === "committee" ? user.committee_id || "" : managedCommitteeId;
  const orgName = (id: string) => orgs.find((o) => o.committee_id === id)?.name || id;
  const completedCommitteeEvents = events.filter((event) =>
    event.committee_id === staffCommitteeId && event.status === "done"
  );
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
    if (user?.role !== "student") {
      say("Sign in to the student portal to follow committees.");
      return;
    }
    run(async () => {
      await api("/follows", {
        method: follows.has(cid) ? "DELETE" : "POST",
        body: { committee_id: cid }
      });
    }, follows.has(cid) ? `Unfollowed ${orgName(cid)}` : `Following ${orgName(cid)}`);
  };

  // Toggle Event Alert
  const toggleAlert = (eid: number, ename: string) => {
    if (user?.role !== "student") {
      say("Sign in to the student portal to set event alerts.");
      return;
    }
    run(async () => {
      await api("/alerts", {
        method: alerts.has(eid) ? "DELETE" : "POST",
        body: { event_id: eid }
      });
    }, alerts.has(eid) ? `Alert removed for ${ename}` : `Alert set · ${ename}`);
  };

  // Printable Certificate Pop-up
  const printCertificate = (r: StudentRegistration) => {
    const certWindow = window.open("", "_blank");
    if (!certWindow) {
      say("Please allow pop-ups to print certificates");
      return;
    }
    const escapeHtml = (value: string | number | null | undefined) => String(value ?? "").replace(
      /[&<>"']/g,
      (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[character]!
    );
    const certTitle = `CERT${1000 + (r.cert_id || r.reg_id)}`;
    const studentName = me ? `${me.first_name} ${me.last_name}` : "Student";
    const studentDetails = me ? `${me.student_id} · ${me.dept_id} · ${me.study_year} ${me.division}` : "";
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
        <h2>${escapeHtml(studentName)}</h2>
        <p style="font-size: 18px;">
          (${escapeHtml(studentDetails)})
        </p>
        <p style="font-size: 18px; margin: 25px 0 10px;">successfully participated in</p>
        <h2 style="font-size: 32px; font-style: normal; color: #111; margin: 10px 0;">${escapeHtml(r.name)}</h2>
        <p style="font-size: 16px; color: #555;">organised under SPIT committee events, Mumbai</p>
        <p class="cert-no">Certificate ID: ${certTitle} · Date of Issue: ${escapeHtml(r.issued_on || "Not recorded")}</p>
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `);
    certWindow.document.close();
  };

  const saveEvent = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const values = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const body = {
      ...values,
      capacity: values.capacity || null,
      fee: values.fee || null,
      start_ts: values.start_ts ? values.start_ts.replace("T", " ") : null,
      end_ts: values.end_ts ? values.end_ts.replace("T", " ") : null,
      registration_closes_at: values.registration_closes_at
        ? values.registration_closes_at.replace("T", " ")
        : null,
      registration_open: values.registration_open === "on"
    };
    run(async () => {
      await api(editingEvent ? `/admin/events/${editingEvent.event_id}` : "/admin/events", {
        method: editingEvent ? "PUT" : "POST",
        body
      });
      setEditingEvent(null);
      form.reset();
    }, editingEvent ? "Event registration settings updated" : "Event added");
  };

  const addCommittee = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    run(async () => {
      await api(
        editingCommittee ? `/admin/committees/${encodeURIComponent(editingCommittee.committee_id)}` : "/admin/committees",
        { method: editingCommittee ? "PUT" : "POST", body: values }
      );
      setEditingCommittee(null);
      form.reset();
    }, editingCommittee ? "Committee updated" : "Committee added");
  };

  const addVenue = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    run(async () => {
      await api("/admin/venues", { method: "POST", body: values });
      form.reset();
    }, "Venue added");
  };

  const addCommitteeAccount = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    const form = ev.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    run(async () => {
      await api("/admin/accounts", { method: "POST", body: { ...values, role: "committee" } });
      form.reset();
    }, "Committee access enabled");
  };

  // Register for Event Submission
  const handleRegister = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (registrationStep === 1) {
      setRegistrationStep(2);
      return;
    }
    if (user?.role !== "student" || !active) {
      say("Sign in to the student portal to register.");
      return;
    }
    const form = ev.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as any;
    const targetEvent = openEvents.find((e) => e.event_id === regEventId) || currentRegEvent || sel;
    if (!targetEvent) return;
    const existingRegistration = regs.find((r) =>
      r.event_id === targetEvent.event_id && r.registration_status !== "Cancelled"
    );
    if (existingRegistration) {
      say("You are already registered for this event.");
      return;
    }

    run(async () => {
      await api("/registrations", {
        method: "POST",
        body: {
          event_id: targetEvent.event_id,
          ...f
        }
      });
      setRegistrationStep(1);
      setApplicationAnswer("");
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
          committee_id: f.committee_id,
          event_id: f.event_id || null,
          request_id: feedbackRequestId,
          rating: feedbackRating,
          comments: f.comments
        }
      });
      form.reset();
      setFeedbackRequestId(crypto.randomUUID());
    }, "Thanks for the verified feedback!");
  };

  // Current week in the database's Asia/Kolkata date convention.
  const next7Days = useMemo(() => {
    const monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7) + weekOffset * 7);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Kolkata" });
      const dayLabel = d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "2-digit",
        timeZone: "Asia/Kolkata"
      });
      const dayEvents = events.filter((e) => {
        if (!e.start_ts) return false;
        const firstDay = e.start_ts.split(" ")[0];
        const lastDay = (e.end_ts || e.start_ts).split(" ")[0];
        return firstDay <= iso && lastDay >= iso;
      });
      return { iso, dayLabel, dayEvents };
    });
  }, [events, weekOffset]);

  const openEvents = events.filter((event) => {
    const registrationOpen = registrationState(event) === "Open";
    const eligible = !event.eligible_dept_id ||
      (Boolean(me?.department_verified) && event.eligible_dept_id === me?.dept_id);
    const alreadyRegistered = regs.some((registration) => registration.event_id === event.event_id);
    return registrationOpen && eligible && !alreadyRegistered;
  });
  const currentRegEvent = openEvents.find((e) => e.event_id === regEventId) || openEvents[0];
  const registrationDisplayState = (event: EventItem): string => {
    const registration = user?.role === "student"
      ? regs.find((item) => item.event_id === event.event_id)
      : undefined;
    return registration
      ? registration.registration_status === "Cancelled" ? "Cancelled" : "Registered"
      : registrationState(event);
  };

  if (authLoading) {
    return <main className="auth-shell"><p className="mu">Restoring your secure session…</p></main>;
  }
  if (!user) return <SignIn onSignedIn={signIn} onRegister={registerStudent} onAdminRegister={registerAdmin} />;

  return (
    <>
      <canvas id="bg" ref={canvasRef} aria-hidden="true" />

      {/* Main Navigation */}
      <nav className={user.role === "student" ? "student-nav" : "staff-nav"}>
        <div className="w">
          <span className="logo">
            CAMPUS<em>PULSE</em>
          </span>
          <a href="#live">Live</a>
          <a href="#explore">Events</a>
          <a href="#week">7 Days</a>
          <a href="#committees">Committees</a>
          <a href="#register">Register</a>
          {user.role === "admin" && <a href="#event-admin">Manage</a>}
          {user.role !== "student" && <a href="#committee-dashboard">Committee roster</a>}
          {user.role === "student" && <a href="#certificates">Certificates</a>}
          <a href="#feedback">Feedback</a>

          <span className="m portal-badge">{user.role === "committee" ? "COMMITTEE ADMIN" : user.role.toUpperCase()} · {user.username}</span>
          {user.role === "admin" && <label className="nav-scope">
            Committee
            <select
              className="in"
              aria-label="Choose committee scope"
              value={managedCommitteeId}
              onChange={(event) => {
                localStorage.setItem("cp_managed_committee", event.target.value);
                setAllFeedback([]);
                setAdminRegistrations([]);
                setCertificateEventId("");
                setManagedCommitteeId(event.target.value);
              }}
            >
              {orgs.map((committee) => <option key={committee.committee_id} value={committee.committee_id}>{committee.name}</option>)}
            </select>
          </label>}
          {user.role === "student" && <button className="btn g" onClick={() => setDrawerOpen(true)}>
            Alerts <span id="ac">{alerts.size + follows.size}</span>
          </button>}
          <button className="btn g s" onClick={() => void signOut()}>Sign out</button>
        </div>
      </nav>

      {syncError && <div className="w"><p className="auth-error" role="alert">{syncError}</p>
        <button className="btn g s" onClick={() => refresh()}>Retry data sync</button></div>}
      {dataLoading && <div className="w"><p className="note" role="status">Loading the latest CampusPulse data…</p></div>}

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
              Live events, event registrations, attendance, feedback and certificates for every committee.
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
            <b>{user.role === "student" ? regs.length : adminRegistrations.length}</b>
            <span>{user.role === "student" ? "your registrations" : "committee registrations"}</span>
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
                    <span className={"b " + (registrationDisplayState(e) === "Open" || registrationDisplayState(e) === "Registered" ? "ok" : "no")}>{registrationDisplayState(e)}</span>
                    {user.role === "student" && <button
                      className="nb"
                      aria-pressed={alerts.has(e.event_id)}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        toggleAlert(e.event_id, e.name);
                      }}
                      title="Alert me for this event"
                    >
                      🔔
                    </button>}
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
                  <span className="m">
                    {e.registered || 0} registered
                    {e.capacity != null && ` · ${e.remaining ?? 0} seats left`}
                  </span>
                  <span className={"b " + (registrationDisplayState(e) === "Open" || registrationDisplayState(e) === "Registered" ? "ok" : "no")}>{registrationDisplayState(e)}</span>
                  {user.role === "student" && e.status !== "done" && (
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
            {shown.length === 0 && <p className="em">{dataLoading ? "Loading events…" : "No events match these filters."}</p>}
          </div>
        </section>

        {/* Section 3: Next Seven Days */}
        <section id="week">
          <div className="sh">
            <div>
              <h2>{weekOffset === 0 ? "This week" : weekOffset > 0 ? "Upcoming week" : "Previous week"}</h2>
              <p>Browse dated events across every committee.</p>
            </div>
            <div className="ctl">
              <button className="btn g s" onClick={() => setWeekOffset((offset) => offset - 1)}>Previous week</button>
              <button className="btn g s" onClick={() => setWeekOffset(0)}>This week</button>
              <button className="btn g s" onClick={() => setWeekOffset((offset) => offset + 1)}>Next week</button>
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

        {/* Section 5: Event Registration */}
        <section id="register">
          <div className="sh">
            <div>
              <h2>Event registration</h2>
              <p>Choose an eligible event, review your details, and submit your registration.</p>
            </div>
            <span className="m mu">
              {me
                ? `${me.first_name} ${me.last_name} · ${me.student_id} · ${me.department_verified ? `Verified ${me.dept_id}` : `Self-reported ${me.dept_id} · verification pending`}`
                : "Student applications"}
            </span>
          </div>

          <div className="panel pad">
            {user.role === "student" && me ? (
              <form onSubmit={handleRegister}>
                <div className="ctl">
                  <span className={"b " + (registrationStep === 1 ? "ok" : "")}>1 · Select</span>
                  <span className={"b " + (registrationStep === 2 ? "ok" : "")}>2 · Review &amp; submit</span>
                  <span className="m mu">{regs.filter((r) => r.registration_status !== "Cancelled").length} event registrations</span>
                </div>
                {openEvents.length === 0 ? (
                  <p className="em">
                    No eligible registrations are open right now. All matching committees may be full, closed, completed, or already registered.
                  </p>
                ) : (
                  <>
                    {registrationStep === 1 ? (
                      <div className="fg">
                  <label>
                    Committee / event
                    <select
                      className="in"
                      value={regEventId || openEvents[0].event_id}
                      onChange={(e) => {
                        setRegEventId(+e.target.value);
                        setRegistrationStep(1);
                        setApplicationAnswer("");
                      }}
                    >
                      {openEvents.map((x) => (
                        <option key={x.event_id} value={x.event_id}>
                          {orgName(x.committee_id)} · {x.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Venue
                    <div className="in" style={{ background: "var(--card2)" }}>
                      {currentRegEvent?.venue || "To be announced"}
                    </div>
                  </label>
                  <label>
                    Capacity
                    <div className="in" style={{ background: "var(--card2)" }}>
                      {currentRegEvent?.capacity == null
                        ? `${currentRegEvent?.registered || 0} registered · unlimited`
                        : `${currentRegEvent.registered || 0} / ${currentRegEvent.capacity} registered · ${currentRegEvent.remaining} seats left`}
                    </div>
                  </label>
                  <label>
                    Eligibility
                    <div className="in" style={{ background: "var(--card2)" }}>
                      {currentRegEvent?.eligible_dept_id || "All verified departments"}
                    </div>
                  </label>
                  <label>
                    Fee
                    <div className="in" style={{ background: "var(--card2)" }}>
                      {currentRegEvent ? feeText(currentRegEvent) : "Free"}
                    </div>
                  </label>
                  {currentRegEvent?.registration_question && <label className="wide-field">
                    {currentRegEvent.registration_question}
                    <textarea className="in" name="application_answer" rows={3} maxLength={2000} value={applicationAnswer}
                      onChange={(event) => setApplicationAnswer(event.target.value)} required />
                  </label>}
                        </div>
                    ) : (
                        <div className="registration-review">
                          <span className="m mu">APPLICATION REVIEW</span>
                          <h3>{orgName(currentRegEvent.committee_id)}</h3>
                          <p>{currentRegEvent.name}</p>
                          <p className="mu">{currentRegEvent.description || "Committee application"}</p>
                          <dl className="kv">
                            <div><dt>Student</dt><dd>{me.first_name} {me.last_name} · {me.student_id}</dd></div>
                            <div><dt>Department</dt><dd>{me.dept_id} · {me.department_verified ? "Verified" : "Pending verification"}</dd></div>
                            <div><dt>Venue</dt><dd>{currentRegEvent.venue || "To be announced"}</dd></div>
                            <div><dt>Registration availability</dt><dd>{currentRegEvent.remaining == null ? "Open" : `${currentRegEvent.remaining} seats remaining`}</dd></div>
                          </dl>
                          {currentRegEvent.registration_question && <label>
                            {currentRegEvent.registration_question}
                            <textarea className="in" name="application_answer" rows={3} maxLength={2000} value={applicationAnswer}
                              onChange={(event) => setApplicationAnswer(event.target.value)} required />
                          </label>}
                          <label className="consent">
                            <input type="checkbox" required />
                            I confirm my student details and agree to submit this registration.
                          </label>
                        </div>
                    )}
                    <div className="ctl" style={{ margin: 0 }}>
                        {registrationStep === 2 && <button type="button" className="btn g" onClick={() => setRegistrationStep(1)}>Back</button>}
                        <button className="btn" disabled={dataLoading || (registrationStep === 1 && !currentRegEvent)}>
                          {registrationStep === 1 ? "Review application" : "Confirm registration"}
                        </button>
                    </div>
                    <p className="note" style={{ marginTop: 12 }}>
                        Availability and eligibility are checked again by the server during submission.
                    </p>
                  </>
                )}
              </form>
            ) : (
              <p className="em">
                Committee applications are available to signed-in students. Your verified department is read from the student record.
              </p>
            )}
          </div>

          {/* Registrations List */}
          {user.role === "student" && <div className="panel ow" style={{ marginTop: 16 }}>
            <h4 style={{ padding: "18px 0 10px", fontSize: 24 }}>My Registrations</h4>
            <table className="tb">
              <thead>
                <tr>
                  <th>Reg ID</th>
                  <th>Event</th>
                  <th>Registered on</th>
                  <th>Status</th>
                  <th>Attendance</th>
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
                        <span className={"b " + (r.registration_status === "Cancelled" ? "no" : "ok")}>{r.registration_status || "Confirmed"}</span>
                        <small className="sub-status">{r.event_status}</small>
                      </td>
                      <td>
                        {r.check_in ? <span className="b ok">Attended</span> : <span className="b wait">Not marked</span>}
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
          </div>}
        </section>

        {user.role !== "student" && <section id="committee-dashboard">
          <div className="sh">
            <div>
              <h2>{user.role === "committee" ? `${orgName(staffCommitteeId)} roster` : "Committee registrations"}</h2>
              <p>Review event registrations and mark attendance after the selected event has ended. Cancelled registrations stay in the database for history.</p>
            </div>
            {user.role === "committee" && <span className="b ok">{orgName(staffCommitteeId)}</span>}
          </div>
          {!staffCommitteeId ? (
            <p className="em">Select a committee to view its applications.</p>
          ) : (
            <>
            <div className="ctl">
              <label>Completed event
                <select className="in" value={certificateEventId} onChange={(event) => setCertificateEventId(event.target.value)}
                  disabled={!completedCommitteeEvents.length}>
                  <option value="">Choose an event</option>
                  {completedCommitteeEvents.map((event) => <option key={event.event_id} value={event.event_id}>{event.name}</option>)}
                </select>
              </label>
              <button className="btn g s" disabled={!certificateEventId || dataLoading} onClick={() => void run(async () => {
                const result = await api<{ issued: number; skipped: number }>("/admin/issue-certificates", {
                  method: "POST",
                  body: { committee_id: staffCommitteeId, event_id: Number(certificateEventId) }
                });
                say(`${result.issued} certificate${result.issued === 1 ? "" : "s"} issued; ${result.skipped} registration${result.skipped === 1 ? "" : "s"} not eligible.`);
              })}>Issue event certificates</button>
              {!completedCommitteeEvents.length && <span className="mu">No completed events in this committee.</span>}
            </div>
            <div className="panel ow">
              <table className="tb">
                <thead><tr><th>Student</th><th>Branch / contact</th><th>Event</th><th>Registered</th><th>Application</th><th>Attendance</th><th>Certificate</th><th>Actions</th></tr></thead>
                <tbody>{adminRegistrations.map((registration) => (
                  <tr key={registration.reg_id}>
                    <td>{registration.first_name} {registration.last_name}<small className="sub-status">{registration.student_id}</small></td>
                    <td>{registration.dept_id || "—"} · {registration.department_verified ? "Verified" : "Pending"}
                      <small className="sub-status">{registration.email || "No email"}{registration.phone ? ` · ${registration.phone}` : ""}</small>
                    </td>
                    <td>{registration.name}</td>
                    <td>{registration.registered_on}<small className="sub-status">{registration.registration_status}</small></td>
                    <td>{registration.application_answer || "—"}</td>
                    <td>{registration.check_in ? "Attended" : registration.event_status === "done" ? "Not marked" : "Event not ended"}</td>
                    <td>{registration.cert_id ? <span className="b ok">CERT{1000 + registration.cert_id}</span> : "Not yet eligible"}</td>
                    <td>
                      {registration.registration_status === "Confirmed" && <>
                        {registration.event_status === "done" && <button className="btn g s" onClick={() => run(
                          () => api(`/admin/events/${registration.event_id}/attendance`, {
                            method: "PUT",
                            body: { reg_id: registration.reg_id, attended: !registration.check_in, committee_id: staffCommitteeId }
                          }),
                          registration.check_in ? "Attendance removed" : "Student marked attended"
                        )}>{registration.check_in ? "Undo attendance" : "Mark attended"}</button>}
                        <button className="btn g s" onClick={() => {
                          if (window.confirm(`Cancel ${registration.first_name} ${registration.last_name}'s registration for ${registration.name}? Their student account and history will be preserved.`)) {
                            void run(
                              () => api(`/admin/registrations/${registration.reg_id}?committee_id=${encodeURIComponent(staffCommitteeId)}`, { method: "DELETE" }),
                              "Committee registration cancelled; history preserved"
                            );
                          }
                        }}>Cancel registration</button>
                      </>}
                    </td>
                  </tr>
                ))}
                {adminRegistrations.length === 0 && <tr><td colSpan={8} className="mu">No applications for {orgName(staffCommitteeId)} yet.</td></tr>}</tbody>
              </table>
            </div>
            </>
          )}
        </section>}

        <section id="event-admin" hidden={user.role !== "admin"}>
          <div className="sh">
            <div>
              <h2>Event &amp; committee setup</h2>
              <p>Manage live catalog data, venues, registration windows, eligibility and seat limits.</p>
            </div>
          </div>
          <div className="panel pad">
            <h3>Committee account requests</h3>
            <p className="note">Approve or reject self-registered committee accounts before they can sign in.</p>
            {pendingAccounts.length ? pendingAccounts.map((account) => (
              <div className="ctl" key={account.account_id}>
                <span>{account.first_name} {account.last_name} · {account.email} · {account.committee_name}</span>
                <button className="btn s" onClick={() => void run(
                  () => api(`/admin/accounts/${account.account_id}/approval`, { method: "PATCH", body: { decision: "Approved" } }),
                  "Committee account approved"
                )}>Approve</button>
                <button className="btn g s" onClick={() => {
                  if (window.confirm(`Reject the admin request from ${account.first_name} ${account.last_name}?`)) {
                    void run(
                      () => api(`/admin/accounts/${account.account_id}/approval`, { method: "PATCH", body: { decision: "Rejected" } }),
                      "Committee account rejected"
                    );
                  }
                }}>Reject</button>
              </div>
            )) : <p className="mu">No pending committee account requests.</p>}
          </div>
          <form key={editingEvent?.event_id || "new-event"} className="panel pad" onSubmit={saveEvent}>
            <h3>{editingEvent ? `Edit: ${editingEvent.name}` : "Create an event"}</h3>
            <div className="fg">
              <label>Event name<input className="in" name="name" defaultValue={editingEvent?.name} maxLength={150} required /></label>
              <label>Committee<select className="in" name="committee_id" defaultValue={editingEvent?.committee_id || orgs[0]?.committee_id} required>
                {orgs.map((committee) => <option key={committee.committee_id} value={committee.committee_id}>{committee.name}</option>)}
              </select></label>
              <label>Venue<select className="in" name="venue_id" defaultValue={editingEvent?.venue_id || ""}>
                <option value="">To be announced / online</option>
                {venues.map((venue) => <option key={venue.venue_id} value={venue.venue_id}>{venue.name}</option>)}
              </select></label>
              <label>Capacity (leave blank for unlimited)<input className="in" name="capacity" type="number" min={1} step={1} defaultValue={editingEvent?.capacity ?? ""} /></label>
              <label>Registration closes<input className="in" name="registration_closes_at" type="datetime-local" defaultValue={editingEvent?.registration_closes_at?.replace(" ", "T").slice(0, 16) || ""} /></label>
              <label>Eligible department (optional)<select className="in" name="eligible_dept_id" defaultValue={editingEvent?.eligible_dept_id || ""}>
                <option value="">All verified departments</option>
                {depts.map((department) => <option key={department.dept_id} value={department.dept_id}>{department.dept_id} · {department.name}</option>)}
              </select></label>
              <label>Starts<input className="in" name="start_ts" type="datetime-local" defaultValue={editingEvent?.start_ts?.replace(" ", "T").slice(0, 16) || ""} /></label>
              <label>Ends<input className="in" name="end_ts" type="datetime-local" defaultValue={editingEvent?.end_ts?.replace(" ", "T").slice(0, 16) || ""} /></label>
              <label>Fee<input className="in" name="fee" type="number" min={0} step="0.01" defaultValue={editingEvent?.fee ?? ""} /></label>
              <label>Fee note<input className="in" name="fee_note" defaultValue={editingEvent?.fee_note || ""} maxLength={80} /></label>
              <label>Audience / eligibility notes<input className="in" name="audience" defaultValue={editingEvent?.audience || ""} maxLength={60} /></label>
              <label>Required application question (optional)<input className="in" name="registration_question" defaultValue={editingEvent?.registration_question || ""} maxLength={500} /></label>
              <label>Prize<input className="in" name="prize" defaultValue={editingEvent?.prize || ""} maxLength={40} /></label>
              <label className="wide-field">Description<textarea className="in" name="description" rows={3} defaultValue={editingEvent?.description || ""} /></label>
              <label className="consent"><input type="checkbox" name="registration_open" defaultChecked={editingEvent ? Boolean(editingEvent.registration_open) : true} /> Registration is open</label>
            </div>
            {editingEvent?.capacity != null && <p className="note">Currently {editingEvent.registered || 0} confirmed · {editingEvent.remaining ?? 0} seats remaining. Capacity cannot be reduced below confirmed registrations.</p>}
            <button className="btn">{editingEvent ? "Save event settings" : "Create event"}</button>
            {editingEvent && <button type="button" className="btn g" onClick={() => setEditingEvent(null)}>Cancel edit</button>}
          </form>
          <div className="panel ow">
            <table className="tb">
              <thead><tr><th>Event</th><th>Committee</th><th>Venue</th><th>Registered / capacity</th><th>Registration</th><th>Action</th></tr></thead>
              <tbody>{events.map((event) => (
                <tr key={event.event_id}>
                  <td>{event.name}</td><td>{orgName(event.committee_id)}</td><td>{event.venue || "—"}</td>
                  <td>{event.registered || 0} / {event.capacity ?? "Unlimited"}{event.remaining != null && ` · ${event.remaining} left`}</td>
                  <td><span className={"b " + (registrationState(event) === "Open" ? "ok" : "no")}>{registrationState(event)}</span></td>
                  <td><button className="btn g s" onClick={() => setEditingEvent(event)}>Edit</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="two">
            <form key={editingCommittee?.committee_id || "new-committee"} className="panel pad" onSubmit={addCommittee}>
              <h3>{editingCommittee ? `Edit ${editingCommittee.name}` : "Add committee"}</h3>
              <div className="fg">
                <label>Committee ID<input className="in" name="committee_id" maxLength={15} defaultValue={editingCommittee?.committee_id} readOnly={Boolean(editingCommittee)} required /></label>
                <label>Name<input className="in" name="name" maxLength={80} defaultValue={editingCommittee?.name} required /></label>
                <label>Tagline<input className="in" name="tagline" maxLength={120} defaultValue={editingCommittee?.tagline || ""} /></label>
                <label>Instagram handle<input className="in" name="instagram_handle" maxLength={60} defaultValue={editingCommittee?.instagram_handle || ""} /></label>
              </div>
              <button className="btn">{editingCommittee ? "Save committee" : "Add committee"}</button>
              {editingCommittee && <button type="button" className="btn g" onClick={() => setEditingCommittee(null)}>Cancel edit</button>}
            </form>
            <form className="panel pad" onSubmit={addVenue}>
              <h3>Add venue</h3>
              <div className="fg">
                <label>Venue ID<input className="in" name="venue_id" maxLength={15} required /></label>
                <label>Venue name<input className="in" name="name" maxLength={100} required /></label>
              </div>
              <button className="btn">Add venue</button>
            </form>
          </div>
          <div className="panel ow">
            <table className="tb">
              <thead><tr><th>Committee</th><th>ID</th><th>Tagline</th><th>Action</th></tr></thead>
              <tbody>{orgs.map((committee) => <tr key={committee.committee_id}>
                <td>{committee.name}</td><td>{committee.committee_id}</td><td>{committee.tagline || "—"}</td>
                <td><button className="btn g s" onClick={() => setEditingCommittee(committee)}>Edit</button></td>
              </tr>)}</tbody>
            </table>
          </div>
          <form className="panel pad" onSubmit={addCommitteeAccount}>
            <h3>Grant committee feedback access</h3>
            <p className="note">Committee accounts can only read feedback for their assigned committee.</p>
            <div className="fg">
              <label>Login username<input className="in" name="username" maxLength={120} autoComplete="off" required /></label>
              <label>Student ID<input className="in" name="student_id" maxLength={20} required /></label>
              <label>Committee<select className="in" name="committee_id" required>
                {orgs.map((committee) => <option key={committee.committee_id} value={committee.committee_id}>{committee.name}</option>)}
              </select></label>
              <label>Temporary password (12+ characters)<input className="in" name="password" type="password" minLength={12} autoComplete="new-password" required /></label>
            </div>
            <button className="btn">Create committee account</button>
          </form>
        </section>

        {/* Section 8: Certificates */}
        <section id="certificates" hidden={user.role !== "student"}>
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
              <p>Share feedback about a committee, optionally tied to one of its events.</p>
            </div>
          </div>

          <div className="panel pad">
            {user.role === "student" ? (
              <form onSubmit={handleFeedback}>
                <div className="fg">
                  <label>
                    Committee
                    <select className="in" name="committee_id" value={feedbackCommitteeId || orgs[0]?.committee_id || ""}
                      onChange={(event) => {
                        setFeedbackCommitteeId(event.target.value);
                        setFeedbackEventId("");
                      }} required>
                      {orgs.map((committee) => <option key={committee.committee_id} value={committee.committee_id}>{committee.name}</option>)}
                    </select>
                  </label>
                  <label>
                    Event (optional)
                    <select className="in" name="event_id" value={feedbackEventId}
                      onChange={(event) => setFeedbackEventId(event.target.value)}>
                      <option value="">General committee feedback</option>
                      {events.filter((event) => event.committee_id === (feedbackCommitteeId || orgs[0]?.committee_id))
                        .map((event) => <option key={event.event_id} value={event.event_id}>{event.name}</option>)}
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
                    <textarea className="in" name="comments" rows={3} maxLength={4000} placeholder="Share your experience..." required />
                  </label>
                </div>
                <button className="btn">Submit feedback</button>
              </form>
            ) : (
              <p className="em">Student feedback submission is available only in the student portal. This view shows feedback for {orgName(staffCommitteeId)} only.</p>
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
                      <td>{fb.event_name || fb.committee_name}</td>
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
