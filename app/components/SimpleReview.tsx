import styles from "./SimpleReview.module.css";

type Turn = { turn_id: string; speaker: string; text: string };
type Session = { session_id: string; session_number: number; turns: Turn[] };

export default function SimpleReview({
  samples, sampleIndex, onSelectSample, doctorName, onSelectDoctor,
  sessions, currentSession, onSelectSession, evaluations, editedTurns,
  onEvaluate, lockedMessage, loading, saving, busyMessage, onSave, saveMessage,
}: {
  samples: { sampleIndex: number; saved: boolean; busy: boolean }[];
  sampleIndex: number;
  onSelectSample: (index: number) => void;
  doctorName: string;
  onSelectDoctor: () => void;
  sessions: Session[];
  currentSession: Session | null;
  onSelectSession: (session: Session) => void;
  evaluations: Record<string, "v" | "x">;
  editedTurns: Record<string, string>;
  onEvaluate: (id: string, value: "v" | "x") => void;
  lockedMessage: string;
  loading: boolean;
  saving: boolean;
  busyMessage: string;
  onSave: () => void;
  saveMessage: { text: string; isError: boolean } | null;
}) {
  const turns = sessions.flatMap(session => session.turns);
  const completed = turns.filter(turn => evaluations[turn.turn_id]).length;
  const canSave = turns.length > 0 && completed === turns.length && !lockedMessage && !saving && !loading;

  return (
    <div className={styles.review}>
      {busyMessage && <div className={styles.busy} role="status"><span>{busyMessage}</span></div>}
      <header className={styles.header}>
        <label className={styles.person}>
          <span>Chọn người</span>
          <select aria-label="Chọn người" title={`Chọn mẫu bệnh nhân (1 - ${samples.length})`}
            value={sampleIndex} disabled={saving} onChange={event => onSelectSample(Number(event.target.value))}>
            {samples.map(sample => (
              <option key={sample.sampleIndex} value={sample.sampleIndex}>
                Người {sample.sampleIndex} / {samples.length}{sample.saved ? " · Đã lưu" : sample.busy ? " · Đang được duyệt" : ""}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={styles.doctor} onClick={onSelectDoctor} disabled={saving}>
          {doctorName || "Nhập tên bác sĩ"}
        </button>
      </header>

      <main id="clinical-chat-area" className={styles.content}>
        {loading ? <p role="status">Đang tải dữ liệu…</p> : !currentSession ? <p>Chưa có hội thoại.</p> : <>
          <nav className={styles.tabs} aria-label="Các lần hỏi">
            {sessions.map(session => (
              <button key={session.session_id} type="button" data-testid="session-tab"
                disabled={saving}
                aria-pressed={session.session_id === currentSession.session_id}
                onClick={() => onSelectSession(session)}>
                Lần hỏi {session.session_number}
              </button>
            ))}
          </nav>
          <div className={styles.intro}>
            <h1 data-testid="session-heading">Lần hỏi {currentSession.session_number} · {currentSession.turns.length / 2} cặp hỏi–đáp</h1>
            <p>Đọc từng câu rồi chọn Accept hoặc Reject.</p>
          </div>
          {lockedMessage && <p className={styles.notice} role="status">{lockedMessage}</p>}
          <div className={styles.turns}>
            {currentSession.turns.map(turn => {
              const value = evaluations[turn.turn_id];
              const isAnswer = /doctor|assistant/i.test(turn.speaker);
              return (
                <article key={turn.turn_id} data-testid="review-turn" data-turn-id={turn.turn_id}
                  className={`${styles.turn} ${isAnswer ? styles.answer : ""}`}>
                  <span className={styles.speaker}>{isAnswer ? "Trả lời" : "Người hỏi"}</span>
                  <p data-testid="turn-text">{editedTurns[turn.turn_id] ?? turn.text}</p>
                  <div className={styles.actions}>
                    <button type="button" aria-pressed={value === "v"} disabled={Boolean(lockedMessage) || saving}
                      className={styles.accept} onClick={() => onEvaluate(turn.turn_id, "v")}>
                      <span aria-hidden="true">✓</span> Accept
                    </button>
                    <button type="button" aria-pressed={value === "x"} disabled={Boolean(lockedMessage) || saving}
                      className={styles.reject} onClick={() => onEvaluate(turn.turn_id, "x")}>
                      <span aria-hidden="true">×</span> Reject
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </>}
      </main>

      <footer className={styles.footer}>
        <div>
          <span data-testid="review-progress">Đã duyệt {completed}/{turns.length} câu</span>
          {saveMessage && <p role={saveMessage.isError ? "alert" : "status"}
            className={saveMessage.isError ? styles.error : styles.success}>{saveMessage.text}</p>}
        </div>
        <button type="button" className={styles.save} disabled={!canSave} onClick={onSave}>
          {saving ? "Đang lưu…" : lockedMessage ? "Chỉ xem" : "Lưu và tiếp"}
        </button>
      </footer>
    </div>
  );
}
