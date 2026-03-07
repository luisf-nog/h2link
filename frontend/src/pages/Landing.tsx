import { useState, useEffect } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  X,
  Upload,
  Mail,
  FileText,
  Search,
  Send,
  BarChart3,
  Shield,
  Zap,
  Clock,
  Eye,
  Radar,
  Users,
  MapPin,
  Building2,
  UserCheck,
  TrendingUp,
  Star,
  Layers,
  Database,
  Filter,
  Bell,
  Lock,
  Crown,
  Bot,
  Globe,
  CheckCircle2,
  Briefcase,
} from "lucide-react";

const tickerJobs = [
  { type: "H-2A", title: "Farmworker – Berries", location: "Salinas, CA", salary: "$16.00/h" },
  { type: "H-2B", title: "Concrete Finisher", location: "Morgantown, WV", salary: "$24.50/h" },
  { type: "H-2A", title: "Apple Harvester", location: "Yakima, WA", salary: "$17.20/h" },
  { type: "H-2B", title: "Landscape Laborer", location: "Austin, TX", salary: "$18.00/h" },
  { type: "H-2A", title: "Equipment Operator", location: "Des Moines, IA", salary: "$19.50/h" },
  { type: "H-2B", title: "Housekeeper", location: "Mackinaw City, MI", salary: "$15.50/h" },
  { type: "H-2A", title: "Tobacco Harvester", location: "Wilson, NC", salary: "$14.87/h" },
  { type: "H-2B", title: "Crab Picker", location: "Crisfield, MD", salary: "$16.54/h" },
];

const workerSteps = [
  {
    n: "01",
    icon: Upload,
    title: "Import your resume",
    desc: "Upload as PDF or Word. The system extracts your data and personalizes each application.",
  },
  {
    n: "02",
    icon: Mail,
    title: "Set up your SMTP email",
    desc: "Connect Gmail or Outlook. Emails are sent from your inbox, no middlemen.",
  },
  {
    n: "03",
    icon: FileText,
    title: "Customize templates",
    desc: "Use ready-made templates or create your own. Our AI generates unique text for each job.",
  },
  {
    n: "04",
    icon: Search,
    title: "Explore H-2A/H-2B jobs",
    desc: "Hundreds of jobs updated daily from DOL. Full salary, weekly hours, season start, and experience required.",
  },
  {
    n: "05",
    icon: Send,
    title: "Build your queue and send",
    desc: "Select jobs, add to queue and fire off bulk applications with one click.",
  },
  {
    n: "06",
    icon: BarChart3,
    title: "Wait for employer responses",
    desc: "Employers reply directly to your email — no middlemen. Track everything in your dashboard.",
  },
];

const employerSteps = [
  {
    n: "01",
    icon: UserCheck,
    title: "Create your employer account",
    desc: "Quick signup. Access to the dedicated employer portal in less than 2 minutes.",
  },
  {
    n: "02",
    icon: Briefcase,
    title: "Publish your H-2 jobs",
    desc: "Post your DOL-approved jobs on the platform. Workers actively searching for H-2 opportunities will find and apply to your positions.",
  },
  {
    n: "03",
    icon: Mail,
    title: "Receive applications directly",
    desc: "Workers apply through H2 Linker and their applications are organized in your employer dashboard — no more scattered emails or messaging apps.",
  },
  {
    n: "04",
    icon: Search,
    title: "Review structured profiles",
    desc: "Each applicant has a structured profile with their background and experience. Compare candidates quickly and identify the right fit.",
  },
  {
    n: "05",
    icon: FileText,
    title: "Manage DOL documentation",
    desc: "Keep records of applications, track recruitment activity and generate organized reports for Department of Labor requirements — all in one place.",
  },
];

const workerFeatures = [
  {
    icon: Database,
    title: "Job Radar",
    desc: "Set filters by sector, state and salary. New jobs enter your queue automatically, no manual search.",
    wide: true,
  },
  {
    icon: Zap,
    title: "AI Personalized per Job",
    desc: "Unique emails generated for each job, passing spam filters with natural language.",
    wide: false,
  },
  {
    icon: Shield,
    title: "Smart Warmup",
    desc: "Progressive sending limit that protects your domain reputation and prevents blocks.",
    wide: false,
  },
  {
    icon: Clock,
    title: "Anti-Spam Delay",
    desc: "Randomized intervals between sends simulating human behavior to protect your account.",
    wide: false,
  },
  {
    icon: Bot,
    title: "Advanced AI Preferences",
    desc: "Full control over email style: formality, greeting, closing, length and emphasis.",
    wide: true,
    badge: "Black",
  },
  {
    icon: Bell,
    title: "Auto-Send — Autopilot",
    desc: "Radar detects a matching job and sends the application automatically. You don't need to do anything.",
    wide: false,
  },
];

const employerFeatures = [
  {
    icon: Users,
    wide: true,
    title: "Find workers more efficiently",
    desc: [
      "Connect with workers ",
      <strong key="b1" style={{ color: "#020617" }}>
        actively looking for H-2 opportunities
      </strong>,
      " — instead of relying only on recruiters or informal networks. Build a pipeline of interested candidates faster.",
    ],
  },
  {
    icon: Layers,
    wide: false,
    title: "Receive organized applications",
    desc: [
      "Applications from email, messaging apps and recruiters all ",
      <strong key="b2" style={{ color: "#020617" }}>
        in one place
      </strong>,
      ". Review, organize by job, and compare profiles without switching between tools.",
    ],
  },
  {
    icon: Search,
    wide: false,
    title: "Review candidates quickly",
    desc: [
      "Structured worker profiles let you understand each candidate's background ",
      <strong key="b3" style={{ color: "#020617" }}>
        at a glance
      </strong>,
      " — reducing time spent reviewing and making comparison straightforward.",
    ],
  },
  {
    icon: Briefcase,
    wide: false,
    title: "Publish job opportunities",
    desc: [
      "Post H-2 jobs directly on the platform and receive applications from workers ",
      <strong key="b4" style={{ color: "#020617" }}>
        already looking for exactly that type of opportunity
      </strong>,
      ".",
    ],
  },
  {
    icon: TrendingUp,
    wide: true,
    title: "Reduce reliance on intermediaries",
    desc: [
      "H2 Linker provides a ",
      <strong key="b5" style={{ color: "#020617" }}>
        direct channel to workers
      </strong>,
      ", giving you more control over recruitment and reducing dependency on third-party recruiters.",
    ],
  },
  {
    icon: FileText,
    wide: false,
    title: "Simplify DOL reporting",
    desc: [
      "Keep records of applications and ",
      <strong key="b6" style={{ color: "#020617" }}>
        generate structured reports for DOL requirements
      </strong>,
      " — automatically organized, without manual collection.",
    ],
  },
];

export default function LandingPreview() {
  const [role, setRole] = useState(null);
  const [hovered, setHovered] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(true);
  }, []);

  const selectRole = (r) => {
    setRole(r);
    setOpenFaq(null);
    setTimeout(() => {
      document.getElementById("role-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const workerFaqs = [
    {
      q: "Does H2 Linker guarantee I'll get the job?",
      a: "No — and any platform that promises that is lying. H2 Linker is a facilitator: we put your resume in front of as many verified employers as possible, as quickly as possible. The H-2A/H-2B process is a game of timing and volume. Whoever applies first wins.",
    },
    {
      q: "What is 'Early Access' and why is it important?",
      a: "Early Access jobs just received the NOA from the DOL — approved but not yet publicized. The employer is still building the team, and your application arrives before the competition.",
    },
    {
      q: "How does the system access my email?",
      a: "We don't access your password. You generate an 'App Password' in Google or Outlook that only allows sending messages. You maintain full control.",
    },
    {
      q: "Are the jobs real?",
      a: "Yes, all data is extracted directly from official Department of Labor (DOL) files in the US.",
    },
  ];

  const employerFaqs = [
    {
      q: "How do workers find my job posting?",
      a: "Workers on H2 Linker configure a radar with their preferred sector, state and visa type. When your job matches those criteria, they are notified and can apply through the platform.",
    },
    {
      q: "Do I need a DOL-approved job to use H2 Linker?",
      a: "Yes. H2 Linker works exclusively with H-2A and H-2B jobs. Jobs outside this program are not supported.",
    },
    {
      q: "How does H2 Linker help with DOL reporting?",
      a: "The platform keeps records of all applications received, tracks your recruitment activity, and organizes worker information — so you can generate structured reports for DOL requirements without collecting data manually.",
    },
    {
      q: "Can I manage multiple jobs at once?",
      a: "Yes. The employer portal lets you organize applicants by job, compare profiles side by side, and track the status of each position separately.",
    },
    {
      q: "What's the cost for employers?",
      a: "Access our plans on the pricing page. We offer options per job posted and monthly plans for higher hiring volume.",
    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Space Grotesk', sans-serif; }

        @keyframes ticker {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.98); }
          to   { opacity: 1; transform: scale(1); }
        }

        .ticker-wrap { overflow: hidden; position: relative; background: #FAFAFA; border-bottom: 1px solid #E2E8F0; padding: 14px 0; }
        .ticker-track { display: flex; width: max-content; animation: ticker 38s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }
        .ticker-fade-l { position: absolute; left: 0; top: 0; bottom: 0; width: 80px; background: linear-gradient(to right, #FAFAFA, transparent); z-index: 2; pointer-events: none; }
        .ticker-fade-r { position: absolute; right: 0; top: 0; bottom: 0; width: 80px; background: linear-gradient(to left, #FAFAFA, transparent); z-index: 2; pointer-events: none; }

        .role-card {
          position: relative; cursor: pointer; overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1.5px solid #E2E8F0; border-radius: 14px; padding: 36px 32px;
          background: #fff;
        }
        .role-card:hover { transform: translateY(-3px); box-shadow: 0 20px 60px rgba(2,6,23,0.1); }
        .role-card.sel-w { border-color: #D4500A; background: #FFFAF7; box-shadow: 0 0 0 3px rgba(212,80,10,0.1), 0 16px 48px rgba(212,80,10,0.08); }
        .role-card.sel-e { border-color: #0ea5e9; background: #F0F9FF; box-shadow: 0 0 0 3px rgba(14,165,233,0.1), 0 16px 48px rgba(14,165,233,0.08); }

        .step-card { background: #fff; padding: 32px 28px; transition: border-color 0.15s; border: 1px solid transparent; cursor: default; }
        .step-card:hover .step-num { color: #020617; }
        .step-card:hover { border-color: #020617; }

        .feat-card { background: #fff; border: 1px solid #E2E8F0; border-radius: 10px; padding: 28px 24px; transition: background 0.15s; }
        .feat-card:hover { background: #f8fafc; }
        .feat-icon { transition: color 0.2s; }
        .feat-card:hover .feat-icon-w { color: #D4500A !important; }
        .feat-card:hover .feat-icon-e { color: #0ea5e9 !important; }

        .faq-btn { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; background: none; border: none; cursor: pointer; font-family: inherit; font-size: 15px; font-weight: 600; color: #020617; text-align: left; gap: 16px; }
        .faq-row-w:hover .faq-q { color: #D4500A; }
        .faq-row-e:hover .faq-q { color: #0ea5e9; }

        .tab-pill { padding: 8px 20px; border-radius: 999px; font-size: 13px; font-weight: 600; cursor: pointer; border: none; font-family: inherit; transition: all 0.2s; }
        .tab-active-w { background: #D4500A; color: #fff; }
        .tab-active-e { background: #0ea5e9; color: #fff; }
        .tab-inactive { background: transparent; color: #94A3B8; }
        .tab-inactive:hover { color: #020617; }

        .role-content { animation: scaleIn 0.4s cubic-bezier(0.4,0,0.2,1) forwards; }

        .btn-w { background: #D4500A; color: #fff; border: none; padding: 13px 24px; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 7px; transition: all 0.2s; }
        .btn-w:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-e { background: #0ea5e9; color: #fff; border: none; padding: 13px 24px; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 7px; transition: all 0.2s; }
        .btn-e:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn-ghost { background: transparent; color: #020617; border: 1.5px solid #E2E8F0; padding: 13px 20px; border-radius: 7px; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; display: inline-flex; align-items: center; gap: 7px; transition: all 0.2s; }
        .btn-ghost:hover { background: #020617; color: #fff; }

        @media (max-width: 768px) {
          .role-grid, .two-col { grid-template-columns: 1fr !important; }
          .steps-grid, .feat-grid { grid-template-columns: 1fr !important; }
          .feat-wide { grid-column: span 1 !important; }
        }
        @media (min-width: 769px) {
          .role-grid { grid-template-columns: repeat(2, 1fr); }
          .steps-grid { grid-template-columns: repeat(2, 1fr); }
          .feat-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (min-width: 1024px) {
          .steps-grid { grid-template-columns: repeat(3, 1fr); }
        }
      `}</style>

      <div
        style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Space Grotesk', sans-serif", color: "#020617" }}
      >
        {/* NAV */}
        <nav
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: "#fff",
            borderBottom: "1px solid #E2E8F0",
            height: 68,
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              maxWidth: 1200,
              margin: "0 auto",
              width: "100%",
              padding: "0 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 20, letterSpacing: "-0.03em", color: "#020617" }}>
              H2 <span style={{ color: "#D4500A" }}>Linker</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {role && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    borderRadius: 999,
                    padding: "4px 6px",
                  }}
                >
                  <button
                    className={`tab-pill ${role === "worker" ? "tab-active-w" : "tab-inactive"}`}
                    onClick={() => setRole("worker")}
                  >
                    Worker
                  </button>
                  <button
                    className={`tab-pill ${role === "employer" ? "tab-active-e" : "tab-inactive"}`}
                    onClick={() => setRole("employer")}
                  >
                    Employer
                  </button>
                </div>
              )}
              <button
                style={{
                  background: "#020617",
                  color: "#fff",
                  border: "none",
                  padding: "10px 22px",
                  borderRadius: 6,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Sign In
              </button>
            </div>
          </div>
        </nav>

        {/* ROLE SELECTOR */}
        <section style={{ padding: "80px 24px 72px", borderBottom: "1px solid #E2E8F0" }}>
          <div style={{ maxWidth: 960, margin: "0 auto" }}>
            <div
              style={{
                textAlign: "center",
                marginBottom: 52,
                opacity: visible ? 1 : 0,
                animation: visible ? "fadeUp 0.6s ease forwards" : "none",
              }}
            >
              <div style={{ display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 24 }}>
                <span
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#22C55E",
                    boxShadow: "0 0 0 3px rgba(34,197,94,0.18)",
                  }}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#64748B",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}
                >
                  DOL database updated today
                </span>
              </div>
              <h1
                style={{
                  fontSize: "clamp(32px, 5vw, 52px)",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  color: "#020617",
                  marginBottom: 16,
                }}
              >
                How do you use <span style={{ color: "#D4500A" }}>H2 Linker?</span>
              </h1>
              <p style={{ fontSize: 16, color: "#64748B", lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>
                Select your profile to see the tools and features made for you.
              </p>
            </div>

            <div
              className="role-grid"
              style={{
                display: "grid",
                gap: 20,
                opacity: visible ? 1 : 0,
                animation: visible ? "fadeUp 0.7s 0.12s ease both" : "none",
              }}
            >
              {/* Worker */}
              <div
                className={`role-card ${role === "worker" ? "sel-w" : ""}`}
                onClick={() => selectRole("worker")}
                onMouseEnter={() => setHovered("worker")}
                onMouseLeave={() => setHovered(null)}
              >
                {role === "worker" && (
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#D4500A",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={12} color="#fff" />
                  </div>
                )}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: role === "worker" || hovered === "worker" ? "rgba(212,80,10,0.08)" : "#F8FAFC",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                    transition: "background 0.2s",
                  }}
                >
                  <Users
                    size={24}
                    color={role === "worker" || hovered === "worker" ? "#D4500A" : "#94A3B8"}
                    style={{ transition: "color 0.2s" }}
                  />
                </div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#020617",
                    marginBottom: 10,
                    letterSpacing: "-0.01em",
                  }}
                >
                  I'm a Worker
                </h2>
                <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.65, marginBottom: 24 }}>
                  I want to find H-2A/H-2B jobs, send mass applications and increase my chances of getting employment in
                  the US.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
                  {["10,000+ DOL jobs", "Automated sending", "AI per job", "Job radar"].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 4,
                        background: "rgba(212,80,10,0.08)",
                        color: "#D4500A",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    color: role === "worker" ? "#D4500A" : "#94A3B8",
                    transition: "color 0.2s",
                  }}
                >
                  See features <ChevronRight size={15} />
                </div>
              </div>

              {/* Employer */}
              <div
                className={`role-card ${role === "employer" ? "sel-e" : ""}`}
                onClick={() => selectRole("employer")}
                onMouseEnter={() => setHovered("employer")}
                onMouseLeave={() => setHovered(null)}
              >
                {role === "employer" && (
                  <div
                    style={{
                      position: "absolute",
                      top: 16,
                      right: 16,
                      width: 22,
                      height: 22,
                      borderRadius: "50%",
                      background: "#0ea5e9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Check size={12} color="#fff" />
                  </div>
                )}
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: role === "employer" || hovered === "employer" ? "rgba(14,165,233,0.08)" : "#F8FAFC",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                    transition: "background 0.2s",
                  }}
                >
                  <Building2
                    size={24}
                    color={role === "employer" || hovered === "employer" ? "#0ea5e9" : "#94A3B8"}
                    style={{ transition: "color 0.2s" }}
                  />
                </div>
                <h2
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "#020617",
                    marginBottom: 10,
                    letterSpacing: "-0.01em",
                  }}
                >
                  I'm an Employer
                </h2>
                <p style={{ fontSize: 15, color: "#64748B", lineHeight: 1.65, marginBottom: 24 }}>
                  I want to find H-2 workers, organize applications in one place, and simplify my DOL recruitment
                  documentation.
                </p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
                  {["Find candidates", "Organized applications", "Less intermediaries", "DOL reporting"].map((tag) => (
                    <span
                      key={tag}
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        padding: "4px 10px",
                        borderRadius: 4,
                        background: "rgba(14,165,233,0.08)",
                        color: "#0284c7",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 14,
                    fontWeight: 600,
                    color: role === "employer" ? "#0ea5e9" : "#94A3B8",
                    transition: "color 0.2s",
                  }}
                >
                  See features <ChevronRight size={15} />
                </div>
              </div>
            </div>

            {!role && (
              <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "#CBD5E1" }}>
                Click a profile to continue ↓
              </p>
            )}
          </div>
        </section>

        {/* TICKER */}
        <div className="ticker-wrap">
          <div className="ticker-fade-l" />
          <div className="ticker-fade-r" />
          <div className="ticker-track">
            {[...tickerJobs, ...tickerJobs].map((job, i) => (
              <div
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 28px",
                  whiteSpace: "nowrap",
                  fontSize: 13,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    padding: "2px 7px",
                    borderRadius: 4,
                    background: job.type === "H-2A" ? "#DCFCE7" : "#DBEAFE",
                    color: job.type === "H-2A" ? "#15803D" : "#1D4ED8",
                  }}
                >
                  {job.type}
                </span>
                <span style={{ fontWeight: 600 }}>{job.title}</span>
                <span style={{ color: "#94A3B8", display: "inline-flex", alignItems: "center", gap: 3 }}>
                  <MapPin size={11} /> {job.location}
                </span>
                <span style={{ color: "#64748B", fontWeight: 500 }}>{job.salary}</span>
                <span style={{ color: "#E2E8F0", fontSize: 20 }}>·</span>
              </div>
            ))}
          </div>
        </div>

        {/* ROLE CONTENT */}
        {role && (
          <div id="role-content" className="role-content">
            {/* ── WORKER ── */}
            {role === "worker" && (
              <>
                {/* Worker Banner */}
                <section style={{ padding: "72px 24px", borderBottom: "1px solid #E2E8F0", background: "#FFFAF7" }}>
                  <div
                    style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 64, alignItems: "center" }}
                    className="two-col"
                    style={{ gridTemplateColumns: "1fr 1fr" }}
                  >
                    <div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "rgba(212,80,10,0.08)",
                          border: "1px solid rgba(212,80,10,0.2)",
                          padding: "4px 12px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.07em",
                          color: "#D4500A",
                          textTransform: "uppercase",
                          marginBottom: 24,
                        }}
                      >
                        <Users size={11} /> Worker Area
                      </div>
                      <h2
                        style={{
                          fontSize: "clamp(28px, 4vw, 44px)",
                          fontWeight: 700,
                          letterSpacing: "-0.025em",
                          lineHeight: 1.1,
                          color: "#020617",
                          marginBottom: 16,
                        }}
                      >
                        The tool that gets you
                        <br />
                        there first
                        <br />
                        <span style={{ color: "#D4500A" }}>for H-2A and H-2B jobs</span>
                      </h2>
                      <p style={{ fontSize: 16, color: "#64748B", lineHeight: 1.7, marginBottom: 32, maxWidth: 440 }}>
                        Automate applications, track opens in real time and apply to dozens of verified DOL employers —
                        all from your own email inbox.
                      </p>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                        <button className="btn-w">
                          Create free account <ArrowRight size={15} />
                        </button>
                        <button className="btn-ghost">
                          <Search size={15} /> View jobs
                        </button>
                      </div>
                    </div>
                    <div style={{ borderLeft: "1px solid #E2E8F0", paddingLeft: 48 }}>
                      {[
                        { val: "10,000+", label: "Jobs in database", sub: "Directly from the Department of Labor" },
                        { val: "Daily", label: "Update frequency", sub: "New jobs appear as soon as they're approved" },
                        { val: "100%", label: "Free to start", sub: "No credit card. No surprises." },
                      ].map((s, i, arr) => (
                        <div
                          key={s.label}
                          style={{ padding: "22px 0", borderBottom: i < arr.length - 1 ? "1px solid #E2E8F0" : "none" }}
                        >
                          <div
                            style={{
                              fontSize: 30,
                              fontWeight: 700,
                              color: "#020617",
                              letterSpacing: "-0.02em",
                              marginBottom: 4,
                            }}
                          >
                            {s.val}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#020617", marginBottom: 2 }}>
                            {s.label}
                          </div>
                          <div style={{ fontSize: 13, color: "#94A3B8" }}>{s.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Worker Steps */}
                <section style={{ padding: "88px 24px", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ maxWidth: 500, marginBottom: 52 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#D4500A",
                          marginBottom: 12,
                        }}
                      >
                        How it works
                      </p>
                      <h2
                        style={{
                          fontSize: "clamp(28px, 4vw, 36px)",
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.15,
                        }}
                      >
                        From zero to applications
                        <br />
                        in 6 simple steps
                      </h2>
                    </div>
                    <div className="steps-grid" style={{ display: "grid", gap: 1, background: "#E2E8F0" }}>
                      {workerSteps.map((step) => (
                        <div key={step.n} className="step-card">
                          <div
                            className="step-num"
                            style={{
                              fontSize: 48,
                              fontWeight: 700,
                              lineHeight: 1,
                              color: "#F1F5F9",
                              marginBottom: 18,
                              letterSpacing: "-0.03em",
                              transition: "color 0.2s",
                            }}
                          >
                            {step.n}
                          </div>
                          <step.icon size={20} color="#D4500A" style={{ marginBottom: 12 }} />
                          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>
                            {step.title}
                          </h3>
                          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>{step.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Worker Features */}
                <section style={{ padding: "88px 24px", background: "#FAFAFA", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ maxWidth: 500, marginBottom: 52 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#D4500A",
                          marginBottom: 12,
                        }}
                      >
                        Features
                      </p>
                      <h2
                        style={{
                          fontSize: "clamp(28px, 4vw, 36px)",
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.15,
                        }}
                      >
                        Tools that make
                        <br />
                        the difference
                      </h2>
                    </div>
                    <div className="feat-grid" style={{ display: "grid", gap: 12 }}>
                      {workerFeatures.map((f, i) => (
                        <div
                          key={f.title}
                          className="feat-card"
                          style={{ gridColumn: f.wide ? "span 2" : "span 1", position: "relative" }}
                        >
                          {f.badge && (
                            <div
                              style={{
                                position: "absolute",
                                top: 16,
                                right: 16,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                                background: "#020617",
                                color: "#fff",
                                padding: "3px 8px",
                                borderRadius: 4,
                                fontSize: 10,
                                fontWeight: 700,
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                              }}
                            >
                              <Crown size={9} /> {f.badge}
                            </div>
                          )}
                          <f.icon
                            className="feat-icon feat-icon-w"
                            size={22}
                            style={{ color: "#CBD5E1", marginBottom: 16 }}
                          />
                          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>
                            {f.title}
                          </h3>
                          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>{f.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Worker FAQ */}
                <section style={{ padding: "88px 24px", background: "#FAFAFA", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 680, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: 52 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#D4500A",
                          marginBottom: 12,
                        }}
                      >
                        FAQ
                      </p>
                      <h2 style={{ fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 700, letterSpacing: "-0.02em" }}>
                        Frequently asked questions
                      </h2>
                    </div>
                    <div
                      style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", background: "#fff" }}
                    >
                      {workerFaqs.map((item, i) => (
                        <div
                          key={i}
                          className="faq-row-w"
                          style={{ borderBottom: i < workerFaqs.length - 1 ? "1px solid #E2E8F0" : "none" }}
                        >
                          <button className="faq-btn" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                            <span className="faq-q" style={{ transition: "color 0.15s" }}>
                              {item.q}
                            </span>
                            <ChevronDown
                              size={18}
                              style={{
                                color: "#94A3B8",
                                flexShrink: 0,
                                transform: openFaq === i ? "rotate(180deg)" : "none",
                                transition: "transform 0.22s",
                              }}
                            />
                          </button>
                          {openFaq === i && (
                            <div style={{ padding: "0 24px 20px", fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>
                              {item.a}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Worker CTA */}
                <section style={{ padding: "88px 24px" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div
                      style={{
                        background: "#020617",
                        borderRadius: 16,
                        padding: "72px 48px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 40,
                        flexWrap: "wrap",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: -60,
                          right: -60,
                          width: 260,
                          height: 260,
                          borderRadius: "50%",
                          background: "rgba(212,80,10,0.07)",
                          pointerEvents: "none",
                        }}
                      />
                      <div style={{ position: "relative" }}>
                        <p
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "#D4500A",
                            marginBottom: 14,
                          }}
                        >
                          Start now — it's free
                        </p>
                        <h2
                          style={{
                            fontSize: "clamp(28px, 4vw, 42px)",
                            fontWeight: 700,
                            letterSpacing: "-0.025em",
                            lineHeight: 1.1,
                            color: "#fff",
                            marginBottom: 12,
                          }}
                        >
                          Ready to find
                          <br />
                          your job in the US?
                        </h2>
                        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, maxWidth: 400 }}>
                          Create your account in less than 2 minutes. No credit card required.
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 220 }}>
                        <button
                          className="btn-w"
                          style={{ padding: "14px 28px", fontSize: 15, justifyContent: "center" }}
                        >
                          Create free account <ArrowRight size={16} />
                        </button>
                        <button
                          style={{
                            background: "transparent",
                            color: "rgba(255,255,255,0.5)",
                            border: "none",
                            padding: "12px 28px",
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            borderRadius: 8,
                          }}
                        >
                          <Globe size={14} /> View available jobs
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* ── EMPLOYER ── */}
            {role === "employer" && (
              <>
                {/* Employer Banner */}
                <section style={{ padding: "72px 24px", borderBottom: "1px solid #E2E8F0", background: "#F0F9FF" }}>
                  <div
                    style={{
                      maxWidth: 1200,
                      margin: "0 auto",
                      display: "grid",
                      gap: 64,
                      alignItems: "center",
                      gridTemplateColumns: "1fr 1fr",
                    }}
                    className="two-col"
                  >
                    <div>
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          background: "rgba(14,165,233,0.08)",
                          border: "1px solid rgba(14,165,233,0.2)",
                          padding: "4px 12px",
                          borderRadius: 4,
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.07em",
                          color: "#0284c7",
                          textTransform: "uppercase",
                          marginBottom: 24,
                        }}
                      >
                        <Building2 size={11} /> Employer Area
                      </div>
                      <h2
                        style={{
                          fontSize: "clamp(28px, 4vw, 44px)",
                          fontWeight: 700,
                          letterSpacing: "-0.025em",
                          lineHeight: 1.1,
                          color: "#020617",
                          marginBottom: 16,
                        }}
                      >
                        Recruit H-2 workers
                        <br />
                        <span style={{ color: "#0ea5e9" }}>without the chaos</span>
                      </h2>
                      <p style={{ fontSize: 16, color: "#64748B", lineHeight: 1.7, marginBottom: 32, maxWidth: 440 }}>
                        H2 Linker simplifies H-2 recruitment by giving employers the tools to find candidates, organize
                        applications, and handle DOL documentation — all in one place.
                      </p>
                      <button className="btn-e">
                        Centralize my recruitment <ArrowRight size={15} />
                      </button>
                    </div>
                    <div style={{ borderLeft: "1px solid #BAE6FD", paddingLeft: 48 }}>
                      {[
                        {
                          val: "H-2A & H-2B",
                          label: "Both visa types",
                          sub: "Workers set up profiles by program type",
                        },
                        {
                          val: "1 place",
                          label: "For all your applications",
                          sub: "No more scattered emails and messaging apps",
                        },
                        {
                          val: "DOL-ready",
                          label: "Recruitment records",
                          sub: "Organized reporting without manual collection",
                        },
                      ].map((s, i, arr) => (
                        <div
                          key={s.label}
                          style={{ padding: "22px 0", borderBottom: i < arr.length - 1 ? "1px solid #BAE6FD" : "none" }}
                        >
                          <div
                            style={{
                              fontSize: 30,
                              fontWeight: 700,
                              color: "#020617",
                              letterSpacing: "-0.02em",
                              marginBottom: 4,
                            }}
                          >
                            {s.val}
                          </div>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#020617", marginBottom: 2 }}>
                            {s.label}
                          </div>
                          <div style={{ fontSize: 13, color: "#94A3B8" }}>{s.sub}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Employer Steps */}
                <section style={{ padding: "88px 24px", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ maxWidth: 500, marginBottom: 52 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#0ea5e9",
                          marginBottom: 12,
                        }}
                      >
                        How it works
                      </p>
                      <h2
                        style={{
                          fontSize: "clamp(28px, 4vw, 36px)",
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.15,
                        }}
                      >
                        From signup to candidates
                        <br />
                        in 5 simple steps
                      </h2>
                    </div>
                    <div className="steps-grid" style={{ display: "grid", gap: 1, background: "#E2E8F0" }}>
                      {employerSteps.map((step) => (
                        <div key={step.n} className="step-card">
                          <div
                            className="step-num"
                            style={{
                              fontSize: 48,
                              fontWeight: 700,
                              lineHeight: 1,
                              color: "#F1F5F9",
                              marginBottom: 18,
                              letterSpacing: "-0.03em",
                              transition: "color 0.2s",
                            }}
                          >
                            {step.n}
                          </div>
                          <step.icon size={20} color="#0ea5e9" style={{ marginBottom: 12 }} />
                          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>
                            {step.title}
                          </h3>
                          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>{step.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Employer Features */}
                <section style={{ padding: "88px 24px", background: "#FAFAFA", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div style={{ maxWidth: 500, marginBottom: 52 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#0ea5e9",
                          marginBottom: 12,
                        }}
                      >
                        Features
                      </p>
                      <h2
                        style={{
                          fontSize: "clamp(28px, 4vw, 36px)",
                          fontWeight: 700,
                          letterSpacing: "-0.02em",
                          lineHeight: 1.15,
                        }}
                      >
                        Tools that make
                        <br />
                        hiring efficient
                      </h2>
                    </div>
                    <div className="feat-grid" style={{ display: "grid", gap: 12 }}>
                      {employerFeatures.map((f, i) => (
                        <div key={i} className="feat-card" style={{ gridColumn: f.wide ? "span 2" : "span 1" }}>
                          <f.icon
                            className="feat-icon feat-icon-e"
                            size={22}
                            style={{ color: "#CBD5E1", marginBottom: 16 }}
                          />
                          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: "#020617" }}>
                            {f.title}
                          </h3>
                          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.65 }}>{f.desc}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Industry Social Proof Strip */}
                <section style={{ padding: "52px 24px", background: "#fff", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
                    <p
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#94A3B8",
                        marginBottom: 32,
                      }}
                    >
                      Connecting the leading sectors of the H-2 program
                    </p>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        gap: 0,
                        flexWrap: "wrap",
                      }}
                    >
                      {[
                        { icon: "🌾", label: "Agriculture" },
                        { icon: "🏗️", label: "Construction" },
                        { icon: "🌿", label: "Landscaping" },
                        { icon: "🏨", label: "Hospitality" },
                        { icon: "🐟", label: "Seafood" },
                        { icon: "🎿", label: "Ski Resorts" },
                        { icon: "🌲", label: "Forestry" },
                      ].map((sector, i, arr) => (
                        <div key={sector.label} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              gap: 10,
                              padding: "16px 28px",
                            }}
                          >
                            <span style={{ fontSize: 28 }}>{sector.icon}</span>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748B", letterSpacing: "0.02em" }}>
                              {sector.label}
                            </span>
                          </div>
                          {i < arr.length - 1 && (
                            <div style={{ width: 1, height: 36, background: "#E2E8F0", flexShrink: 0 }} />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Employer FAQ */}
                <section style={{ padding: "88px 24px", background: "#FAFAFA", borderBottom: "1px solid #E2E8F0" }}>
                  <div style={{ maxWidth: 680, margin: "0 auto" }}>
                    <div style={{ textAlign: "center", marginBottom: 52 }}>
                      <p
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: "0.1em",
                          textTransform: "uppercase",
                          color: "#0ea5e9",
                          marginBottom: 12,
                        }}
                      >
                        FAQ
                      </p>
                      <h2 style={{ fontSize: "clamp(26px, 4vw, 34px)", fontWeight: 700, letterSpacing: "-0.02em" }}>
                        Frequently asked questions
                      </h2>
                    </div>
                    <div
                      style={{ border: "1px solid #E2E8F0", borderRadius: 10, overflow: "hidden", background: "#fff" }}
                    >
                      {employerFaqs.map((item, i) => (
                        <div
                          key={i}
                          className="faq-row-e"
                          style={{ borderBottom: i < employerFaqs.length - 1 ? "1px solid #E2E8F0" : "none" }}
                        >
                          <button className="faq-btn" onClick={() => setOpenFaq(openFaq === 100 + i ? null : 100 + i)}>
                            <span className="faq-q" style={{ transition: "color 0.15s" }}>
                              {item.q}
                            </span>
                            <ChevronDown
                              size={18}
                              style={{
                                color: "#94A3B8",
                                flexShrink: 0,
                                transform: openFaq === 100 + i ? "rotate(180deg)" : "none",
                                transition: "transform 0.22s",
                              }}
                            />
                          </button>
                          {openFaq === 100 + i && (
                            <div style={{ padding: "0 24px 20px", fontSize: 14, color: "#64748B", lineHeight: 1.7 }}>
                              {item.a}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                {/* Employer CTA */}
                <section style={{ padding: "88px 24px" }}>
                  <div style={{ maxWidth: 1200, margin: "0 auto" }}>
                    <div
                      style={{
                        background: "#020617",
                        borderRadius: 16,
                        padding: "72px 48px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 40,
                        flexWrap: "wrap",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: -60,
                          right: -60,
                          width: 260,
                          height: 260,
                          borderRadius: "50%",
                          background: "rgba(14,165,233,0.06)",
                          pointerEvents: "none",
                        }}
                      />
                      <div style={{ position: "relative" }}>
                        <p
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: "0.1em",
                            textTransform: "uppercase",
                            color: "#38bdf8",
                            marginBottom: 14,
                          }}
                        >
                          Start now
                        </p>
                        <h2
                          style={{
                            fontSize: "clamp(28px, 4vw, 42px)",
                            fontWeight: 700,
                            letterSpacing: "-0.025em",
                            lineHeight: 1.1,
                            color: "#fff",
                            marginBottom: 12,
                          }}
                        >
                          Ready to simplify
                          <br />
                          H-2 recruitment?
                        </h2>
                        <p style={{ fontSize: 16, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, maxWidth: 400 }}>
                          Create your employer account and start finding workers, organizing applications, and managing
                          DOL documentation in one place.
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, minWidth: 220 }}>
                        <button
                          className="btn-e"
                          style={{ padding: "14px 28px", fontSize: 15, justifyContent: "center" }}
                        >
                          Start receiving candidates <ArrowRight size={16} />
                        </button>
                        <button
                          style={{
                            background: "transparent",
                            color: "rgba(255,255,255,0.5)",
                            border: "none",
                            padding: "12px 28px",
                            fontSize: 14,
                            fontWeight: 500,
                            cursor: "pointer",
                            fontFamily: "inherit",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 6,
                            borderRadius: 8,
                          }}
                        >
                          <Globe size={14} /> View available jobs
                        </button>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}
          </div>
        )}

        {/* FOOTER */}
        <footer style={{ borderTop: "1px solid #E2E8F0", padding: "28px 24px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 16,
                marginBottom: 16,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 18, letterSpacing: "-0.03em" }}>
                H2 <span style={{ color: "#D4500A" }}>Linker</span>
              </div>
              <p style={{ fontSize: 13, color: "#94A3B8", fontWeight: 500 }}>
                © {new Date().getFullYear()} H2 Linker — Connecting workers and employers
              </p>
            </div>
            <div style={{ borderTop: "1px solid #F1F5F9", paddingTop: 14 }}>
              <p style={{ fontSize: 11, color: "#CBD5E1", lineHeight: 1.6, maxWidth: 760 }}>
                H2 Linker is a recruitment technology platform and is not a law firm or a government agency. H2 Linker
                does not provide legal advice and is not affiliated with the U.S. Department of Labor (DOL) or U.S.
                Citizenship and Immigration Services (USCIS). All visa and compliance requirements are the sole
                responsibility of the employer and worker.
              </p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
