"use client";

import { useEffect, useState } from "react";

export default function LeigoMaster({ context = "home" }) {
  const [txt, setTxt] = useState("");
  const [err, setErr] = useState("");
  const [state, setState] = useState("loading"); // loading | ok | err
  const [imgOk, setImgOk] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch(`/api/leigo-master?ctx=${context}`)
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!alive) return;
        if (ok && d.text) { setTxt(d.text); setState("ok"); }
        else { setErr(d?.error || "erro desconhecido"); setState("err"); }
      })
      .catch((e) => { if (alive) { setErr("falha de conexão"); setState("err"); } });
    return () => { alive = false; };
  }, [context]);

  return (
    <section className="card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--hover)] text-4xl sm:h-24 sm:w-24">
          {imgOk ? <img src="/leigo-master.png" alt="Leigo Master" className="h-full w-full object-cover object-top" onError={() => setImgOk(false)} /> : "🎤"}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold">Leigo Master</h2>
            <span className="pill bg-[var(--hover)] text-[var(--muted)]">comentário do dia</span>
          </div>
          {state === "loading" && <p className="mt-1 text-sm text-[var(--muted)]">Aquecendo a voz e revirando seus palpites… 🎙️</p>}
          {state === "ok" && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{txt}</p>}
          {state === "err" && <p className="mt-1 text-sm text-[var(--muted)]">O Leigo Master tirou uma folga. <span className="text-[var(--faint)]">(motivo: {err})</span></p>}
        </div>
      </div>
    </section>
  );
}
