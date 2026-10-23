import { WorkspaceGlyph } from "./WorkspaceGlyph.tsx";

const questions = ["این پروژه چه کاری انجام می‌دهد؟", "برای انتشار چه چیزهایی لازم است؟", "قدم بعدی من چیست؟"];

export function ChatWelcome({ projectName, disabled, onPick }: {
  projectName: string | null; disabled: boolean; onPick: (question: string) => void;
}) {
  return <div className="chat-welcome">
    <h3>با هم روشنش کنیم.</h3>
    <p>{projectName ? "پروژه را بهتر بشناسید یا دربارهٔ قدم بعدی انتشار بپرسید." : "دربارهٔ انتشار بپرسید. با انتخاب پروژه، فایل‌هایش را هم بررسی می‌کنیم."}</p>
    <fieldset className="chat-starters"><legend className="sr-only">پیشنهاد برای شروع گفت‌وگو</legend>
      {questions.map(question => <button key={question} type="button" className="button-secondary chat-starter" disabled={disabled} onClick={() => onPick(question)}>
        <span>{question}</span><WorkspaceGlyph name="arrow" />
      </button>)}
    </fieldset>
  </div>;
}
