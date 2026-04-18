import { useState, useRef, useCallback, useEffect } from "react";
import Editor, { DiffEditor } from "@monaco-editor/react";
import { analyzeCode } from "./api";

const DEFAULT_CODE = `import java.util.Date;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.text.SimpleDateFormat;

public class EmployeeManager {

    private Date joiningDate = new Date();
    private ArrayList employees = new ArrayList();

    public String getEmployeeName(String name) {
        if (name != null) {
            return name.toUpperCase();
        } else {
            return "UNKNOWN";
        }
    }

    public void printAllEmployees(List<String> empList) {
        for (int i = 0; i < empList.size(); i++) {
            System.out.println("Employee: " + empList.get(i));
        }
    }

    public String getDepartmentCode(String dept) {
        String code;
        switch (dept) {
            case "Engineering": code = "ENG"; break;
            case "Marketing":   code = "MKT"; break;
            default:            code = "UNK";
        }
        return code;
    }

    public String formatDate(Date date) {
        SimpleDateFormat sdf = new SimpleDateFormat("yyyy-MM-dd");
        return sdf.format(date);
    }

    public void processObject(Object obj) {
        if (obj instanceof String) {
            String s = (String) obj;
            System.out.println("String length: " + s.length());
        } else if (obj instanceof Integer) {
            Integer i = (Integer) obj;
            System.out.println("Integer value: " + i);
        }
    }
}`;

const AGENT_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5 4.75"></path>
    <path d="M12 2a10 10 0 0 0-5 2.12"></path>
    <path d="M12 2a10 10 0 0 1 5 2.12"></path>
    <circle cx="12" cy="12" r="3"></circle>
    <path d="M12 15a3 3 0 0 1-3-3"></path>
    <path d="m15 12-3 3"></path>
  </svg>
);

export default function App() {
  const [code, setCode] = useState(DEFAULT_CODE);
  const [prevCode, setPrevCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [fileName, setFileName] = useState("EmployeeManager.java");
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [modernScore, setModernScore] = useState(null);
  const [aiChat, setAiChat] = useState([]);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState("editor"); 
  const [targetVersion, setTargetVersion] = useState("21");
  
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const fileInputRef = useRef(null);
  const scanIntervalRef = useRef(null);

  function handleEditorDidMount(editor, monaco) {
    editorRef.current = editor;
    monacoRef.current = monaco;
  }

  function loadFile(file) {
    if (!file) return;
    if (!file.name.endsWith(".java")) {
      setError("Only .java files are supported.");
      return;
    }
    setFileName(file.name);
    setError("");
    setAnalysis(null);
    setSelectedIssue(null);
    setModernScore(null);
    setPrevCode("");
    setViewMode("editor");
    const reader = new FileReader();
    reader.onload = (e) => setCode(e.target.result);
    reader.readAsText(file);
  }

  function startScanAnimation() {
    setScanProgress(0);
    let p = 0;
    scanIntervalRef.current = setInterval(() => {
      p += Math.random() * 8;
      if (p >= 90) { clearInterval(scanIntervalRef.current); p = 90; }
      setScanProgress(Math.min(p, 90));
    }, 200);
  }

  function finishScanAnimation() {
    clearInterval(scanIntervalRef.current);
    setScanProgress(100);
    setTimeout(() => setScanProgress(0), 800);
  }

  async function handleAnalyze() {
    if (!code?.trim()) return;
    setLoading(true);
    setError("");
    setAnalysis(null);
    setSelectedIssue(null);
    setModernScore(null);
    setAiChat([{ role: "system", text: `Analyzing for Java ${targetVersion} optimization...` }]);
    startScanAnimation();

    const originalCode = code;

    try {
      const response = await analyzeCode(code, "java", targetVersion, fileName);
      finishScanAnimation();

      if (response?.data) {
        const issues = response.data.issues || [];
        setAnalysis(response.data);
        setPrevCode(originalCode);
        setViewMode("split");

        const lineCount = code.split("\n").length;
        const issueLines = issues.reduce((acc, i) => acc + (i.lineEnd - i.lineStart + 1), 0);
        const score = Math.max(0, Math.round(100 - (issueLines / lineCount) * 100));
        setModernScore(score);

        setAiChat([
          { role: "system", text: issues.length === 0
            ? `✅ Code clean! Meets Java ${targetVersion} standards.`
            : `🔍 Review complete. Found ${issues.length} opportunities for ${targetVersion} modernization.`
          }
        ]);
      }
    } catch (err) {
      finishScanAnimation();
      setError(err.message);
      setAiChat([{ role: "error", text: `Error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  function handleAutoUpdateAll() {
    if (analysis?.refactoredCode) {
      setCode(analysis.refactoredCode);
      setAnalysis(null);
      setViewMode("editor");
      setModernScore(100);
      setAiChat([{ role: "system", text: "✨ Modernization applied successfully." }]);
    }
  }

  function handleDownload() {
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setCode(DEFAULT_CODE);
    setPrevCode("");
    setFileName("EmployeeManager.java");
    setAnalysis(null);
    setSelectedIssue(null);
    setModernScore(null);
    setViewMode("editor");
    setError("");
    setAiChat([]);
  };

  const lineCount = code.split("\n").length;

  return (
    <div style={s.root}>
      {scanProgress > 0 && <div style={{ ...s.scanBar, width: `${scanProgress}%` }} />}

      <nav style={s.topNav}>
        <div style={s.navLeft}>
          <span style={s.logo}>{AGENT_ICON} <span style={s.logoText}>CODE REVIEW AGENT</span></span>
          <span style={s.navBreadcrumb}>
            <span style={s.breadcrumbSeg}>agent</span>
            <span style={s.breadcrumbSlash}>/</span>
            <span style={s.breadcrumbFile}>{fileName}</span>
          </span>
        </div>
        <div style={s.navRight}>
          <div style={s.versionSelectorBox}>
            <span style={s.versionLabel}>TARGET JDK:</span>
            <select 
              value={targetVersion} 
              onChange={(e) => setTargetVersion(e.target.value)}
              style={s.versionSelect}
            >
              <option value="8">Java 8</option>
              <option value="11">Java 11</option>
              <option value="17">Java 17</option>
              <option value="21">Java 21</option>
            </select>
          </div>

          {modernScore !== null && (
            <div style={s.scoreWidget}>
              <span style={s.scoreLabel}>HEALTH</span>
              <span style={{ ...s.scoreBadge, color: modernScore >= 80 ? "#10b981" : "#f59e0b" }}>{modernScore}%</span>
            </div>
          )}
          <button onClick={handleCopy} style={s.navBtn}>{copied ? "✅" : "📋 Copy"}</button>
          <button onClick={handleDownload} style={{ ...s.navBtn, ...s.navBtnGreen }}>⬇ Download</button>
          <button onClick={handleAnalyze} disabled={loading} style={{ ...s.navBtn, ...s.navBtnPrimary, ...(loading ? s.disabled : {}) }}>
            {loading ? <><span style={s.dot} />Analyzing...</> : "⚡ Start Review"}
          </button>
        </div>
      </nav>

      <div style={s.body}>
        <aside style={s.sidebar}>
          <div style={s.sidebarContent}>
            <div style={s.sidebarHeader}>
              <span style={s.sidebarTitle}>ACTIVE FILE</span>
              <button style={s.iconBtn} onClick={() => fileInputRef.current?.click()}>＋</button>
            </div>
            <div style={s.fileItemActive}>📄 {fileName}</div>
            <input ref={fileInputRef} type="file" accept=".java" onChange={e => { loadFile(e.target.files[0]); e.target.value = ""; }} style={{ display: "none" }} />
            
            <div style={s.divider} />
            <div style={s.sidebarHeader}><span style={s.sidebarTitle}>ANOMALIES</span></div>
            <div style={s.issueScroll}>
              {analysis?.issues?.map((issue, idx) => (
                <div key={idx} style={s.issueItem} onClick={() => { setViewMode("split"); setSelectedIssue(issue); }}>
                  <div style={s.issueItemTop}>
                    <span style={s.issueLineTag}>Anomaly @ L{issue.lineStart}</span>
                  </div>
                  <p style={s.issueItemReason}>{issue.reason}</p>
                </div>
              ))}
              {!analysis && !loading && <div style={s.emptyMsg}>Scan to detect issues...</div>}
            </div>
          </div>
          <button onClick={handleReset} style={s.resetBtn}>↺ RESET AGENT</button>
        </aside>

        <main style={s.center}>
          <div style={s.tabBar}>
            <button style={{ ...s.tab, ...(viewMode === "editor" ? s.tabActive : {}) }} onClick={() => setViewMode("editor")}>
              EDITOR
            </button>
            <button disabled={!prevCode} style={{ ...s.tab, ...(viewMode === "split" ? s.tabActive : {}), ...(!prevCode ? s.tabDisabled : {}) }} onClick={() => setViewMode("split")}>
              DIFF VIEW
            </button>
            <div style={{ flex: 1 }} />
            {viewMode === "split" && analysis && (
              <button onClick={handleAutoUpdateAll} style={s.applyAllTop}>ACCEPT ALL FIXES</button>
            )}
          </div>

          <div style={s.editorWrap}>
            {viewMode === "editor" ? (
              <Editor
                height="100%"
                defaultLanguage="java"
                theme="vs-dark"
                value={code}
                onChange={(val) => setCode(val || "")}
                onMount={handleEditorDidMount}
                options={{
                  fontSize: 14,
                  minimap: { enabled: true },
                  scrollBeyondLastLine: false,
                  lineNumbers: "on",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontLigatures: true,
                  padding: { top: 12 }
                }}
              />
            ) : (
              <DiffEditor
                height="100%"
                original={prevCode || code}
                modified={analysis?.refactoredCode || code}
                language="java"
                theme="vs-dark"
                options={{
                  fontSize: 13,
                  renderSideBySide: true,
                  readOnly: true,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontLigatures: true,
                  scrollBeyondLastLine: false,
                }}
              />
            )}
          </div>
        </main>

        <aside style={s.aiPanel}>
          <div style={s.aiHeader}><span style={s.aiTitle}>🤖 INSIGHTS</span></div>
          <div style={s.aiBody}>
            {aiChat.map((msg, idx) => (
              <div key={idx} style={msg.role === "error" ? s.aiError : s.aiMsg}>
                <p style={{ ...s.aiMsgText, color: msg.role === "system" ? "#10b981" : "#e2e8f0" }}>{msg.text}</p>
              </div>
            ))}
            {analysis?.error && <div style={s.aiError}>{analysis.error}</div>}
            
            {selectedIssue && (
              <div style={s.selectedIssueBox}>
                <span style={s.boxLabel}>ANOMALY</span>
                <p style={s.boxText}>{selectedIssue.reason}</p>
                <span style={{ ...s.boxLabel, marginTop: "0.8rem", display: "block" }}>SUGGESTED REFACTOR</span>
                <pre style={s.boxFix}>{selectedIssue.suggestedFix}</pre>
              </div>
            )}
          </div>
          <div style={s.aiFooter}>
            <div style={s.footerStat}>
              <span style={s.footerNum}>LIVE</span>
              <span style={s.footerLbl}>SESSION</span>
            </div>
            <div style={s.footerStat}>
              <span style={{ ...s.footerNum, color: "#10b981" }}>{lineCount}</span>
              <span style={s.footerLbl}>LINES</span>
            </div>
          </div>
        </aside>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono&family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #0a0a0f; color: #e2e8f0; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

const s = {
  root: { height: "100vh", display: "flex", flexDirection: "column", background: "#0a0a0f" },
  scanBar: { height: "3px", background: "#10b981", position: "absolute", top: 0, left: 0, zIndex: 999, transition: "width 0.3s" },
  topNav: { height: "52px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 1.25rem", borderBottom: "1px solid #1e2030", background: "#0e0e16" },
  navLeft: { display: "flex", alignItems: "center", gap: "1.25rem" },
  logo: { display: "flex", alignItems: "center", gap: "0.6rem", fontWeight: 800, fontSize: "0.95rem", color: "#10b981" },
  logoText: { letterSpacing: "1px", color: "#fff" },
  navBreadcrumb: { fontSize: "0.75rem", display: "flex", gap: "0.4rem", color: "#4b5563" },
  breadcrumbSeg: { color: "#4b5563" },
  breadcrumbSlash: { color: "#1e2030" },
  breadcrumbFile: { color: "#9ca3af", fontWeight: 600 },
  navRight: { display: "flex", alignItems: "center", gap: "0.6rem" },
  versionSelectorBox: { display: "flex", alignItems: "center", gap: "0.5rem", marginRight: "1rem", background: "rgba(255,255,255,0.03)", padding: "0.25rem 0.6rem", borderRadius: 6, border: "1px solid #1e2030" },
  versionLabel: { fontSize: "0.6rem", color: "#4b5563", fontWeight: 800, letterSpacing: "0.5px" },
  versionSelect: { background: "none", border: "none", color: "#10b981", fontSize: "0.75rem", fontWeight: 800, cursor: "pointer", outline: "none" },
  navBtn: { padding: "0.41rem 0.95rem", borderRadius: 6, border: "1px solid #1e2030", background: "transparent", color: "#9ca3af", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer" },
  navBtnGreen: { borderColor: "#064e3b", color: "#10b981" },
  navBtnPrimary: { background: "#10b981", border: "none", color: "#000", fontWeight: 800 },
  scoreWidget: { display: "flex", gap: "0.5rem", marginRight: "1rem", alignItems: "center" },
  scoreLabel: { fontSize: "0.6rem", color: "#4b5563", fontWeight: 800 },
  scoreBadge: { fontWeight: 800, fontSize: "0.9rem" },
  dot: { display: "inline-block", width: 8, height: 8, borderRadius: "50%", border: "2px solid rgba(0,0,0,0.3)", borderTop: "2px solid #000", animation: "spin 0.6s linear infinite", marginRight: "6px" },
  disabled: { opacity: 0.5, cursor: "not-allowed" },

  body: { flex: 1, display: "flex", overflow: "hidden" },
  sidebar: { width: "260px", borderRight: "1px solid #1e2030", display: "flex", flexDirection: "column", background: "#0e0e16" },
  sidebarContent: { flex: 1, overflowY: "auto" },
  sidebarHeader: { padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" },
  sidebarTitle: { fontSize: "0.65rem", color: "#4b5563", fontWeight: 800, letterSpacing: "1px" },
  fileItemActive: { padding: "0.8rem 1rem", fontSize: "0.8rem", color: "#10b981", background: "rgba(16,185,129,0.05)", fontWeight: 600 },
  iconBtn: { background: "none", border: "none", color: "#6b7280", fontSize: "1.2rem", cursor: "pointer" },
  divider: { height: "1px", background: "#1e2030" },
  issueScroll: { padding: "0.5rem" },
  issueItem: { padding: "0.8rem", background: "#13131f", border: "1px solid #1e2030", borderRadius: 8, marginBottom: "0.5rem", cursor: "pointer" },
  issueItemTop: { marginBottom: "0.4rem" },
  issueLineTag: { fontSize: "0.65rem", color: "#f59e0b", fontWeight: 800 },
  issueItemReason: { fontSize: "0.75rem", color: "#9ca3af", lineHeight: 1.5 },
  emptyMsg: { padding: "3rem 1rem", textAlign: "center", fontSize: "0.7rem", color: "#374151", fontWeight: 600 },
  resetBtn: { padding: "1rem", border: "none", borderTop: "1px solid #1e2030", background: "none", color: "#ef4444", fontSize: "0.7rem", fontWeight: 800, cursor: "pointer", letterSpacing: "1px" },

  center: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
  tabBar: { height: "42px", display: "flex", alignItems: "center", background: "#0e0e16", borderBottom: "1px solid #1e2030", padding: "0 1rem" },
  tab: { padding: "0 1.25rem", height: "100%", background: "none", border: "none", color: "#4b5563", fontSize: "0.7rem", fontWeight: 800, cursor: "pointer", borderBottom: "2px solid transparent" },
  tabActive: { color: "#10b981", borderBottomColor: "#10b981" },
  tabDisabled: { opacity: 0.3, cursor: "not-allowed" },
  applyAllTop: { padding: "0.3rem 0.8rem", background: "#10b981", border: "none", borderRadius: 4, color: "#000", fontSize: "0.65rem", fontWeight: 900, cursor: "pointer" },
  editorWrap: { flex: 1, background: "#0a0a0f" },

  aiPanel: { width: "260px", borderLeft: "1px solid #1e2030", display: "flex", flexDirection: "column", background: "#0e0e16" },
  aiHeader: { padding: "1rem", borderBottom: "1px solid #1e2030" },
  aiTitle: { fontSize: "0.7rem", color: "#4b5563", fontWeight: 800 },
  aiBody: { flex: 1, overflowY: "auto", padding: "1rem" },
  aiMsg: { marginBottom: "1.25rem" },
  aiMsgText: { fontSize: "0.8rem", lineHeight: 1.7 },
  aiError: { color: "#ef4444", fontSize: "0.75rem", padding: "0.75rem", background: "rgba(239,68,68,0.05)", borderRadius: 8, marginBottom: "1rem" },
  selectedIssueBox: { background: "#0a0a0f", border: "1px solid #064e3b", borderRadius: 10, padding: "1rem", marginTop: "1rem" },
  boxLabel: { fontSize: "0.6rem", color: "#10b981", fontWeight: 900 },
  boxText: { fontSize: "0.8rem", marginTop: "0.5rem", lineHeight: 1.6, color: "#e2e8f0" },
  boxFix: { background: "#000", padding: "0.75rem", borderRadius: 6, fontSize: "0.7rem", color: "#10b981", marginTop: "0.75rem", overflowX: "auto", fontFamily: "'JetBrains Mono', monospace" },
  aiFooter: { display: "flex", justifyContent: "space-around", padding: "1rem", borderTop: "1px solid #1e2030" },
  footerStat: { textAlign: "center" },
  footerNum: { display: "block", fontSize: "1rem", fontWeight: 800 },
  footerLbl: { display: "block", fontSize: "0.6rem", color: "#4b5563", fontWeight: 800 }
};
