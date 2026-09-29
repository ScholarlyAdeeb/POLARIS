import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type LessonPack, type QuizQuestion } from '../lib/api';
import { useT } from '../lib/i18n';
import { DataStatusBadge, ErrorNote, Page, PageHeader } from '../components/ui';

function Quiz({ quiz, onNew }: { quiz: QuizQuestion[]; onNew: () => void }) {
  const { t } = useT();
  const [i, setI] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  useEffect(() => {
    setI(0);
    setChoice(null);
    setChecked(false);
    setScore(0);
  }, [quiz]);

  if (!quiz.length) return <p className="text-sm sci-muted">Not enough records to build a quiz yet.</p>;
  const done = i >= quiz.length;
  const q = quiz[Math.min(i, quiz.length - 1)];

  return (
    <section className="sci-card p-5 flex flex-col gap-4" data-testid="quiz">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{t('learn.quiz')}</h2>
        <span className="text-xs sci-muted sci-mono">
          {t('learn.score')} {score}/{quiz.length}
        </span>
      </div>
      {done ? (
        <div className="flex flex-col gap-3 items-start">
          <p className="text-lg font-semibold">
            {t('learn.score')}: {score} / {quiz.length}
          </p>
          <button className="sci-btn" onClick={onNew}>
            {t('learn.newQuiz')}
          </button>
        </div>
      ) : (
        <>
          <p className="text-xs sci-muted">
            {i + 1} / {quiz.length}
          </p>
          <p className="font-semibold">{q.question}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup">
            {q.options.map((o) => {
              const right = checked && o === q.answer;
              const wrong = checked && o === choice && o !== q.answer;
              return (
                <button
                  key={o}
                  role="radio"
                  aria-checked={choice === o}
                  disabled={checked}
                  onClick={() => setChoice(o)}
                  className={`text-left text-sm p-3 rounded-lg border-2 transition-colors ${
                    right ? 'border-emerald-500 bg-emerald-50' : wrong ? 'border-rose-500 bg-rose-50' : choice === o ? 'border-[#00b4d8] bg-[#eff9fc]' : 'sci-border bg-white'
                  }`}
                >
                  {right && '✓ '}
                  {wrong && '✗ '}
                  {o}
                </button>
              );
            })}
          </div>
          {checked && <p className="text-sm sci-well p-3">{q.explain}</p>}
          <div>
            {!checked ? (
              <button
                className="sci-btn"
                disabled={!choice}
                onClick={() => {
                  setChecked(true);
                  if (choice === q.answer) setScore((s) => s + 1);
                }}
              >
                {t('learn.check')}
              </button>
            ) : (
              <button
                className="sci-btn"
                onClick={() => {
                  setI(i + 1);
                  setChoice(null);
                  setChecked(false);
                }}
              >
                {t('learn.next')}
              </button>
            )}
          </div>
          <p className="text-[11px] sci-muted">Questions and answers are generated from station and expedition records in the database, not written by an AI.</p>
        </>
      )}
    </section>
  );
}

export function LearnPage({ onOpenRecord }: { onOpenRecord: (id: string) => void }) {
  const { t } = useT();
  const [data, setData] = useState<{ packs: LessonPack[]; quiz: QuizQuestion[]; seed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [region, setRegion] = useState(0);
  const load = (seed?: number) => api.learn(seed).then(setData).catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);

  const pack = data?.packs[region];
  return (
    <Page>
      <PageHeader title={t('learn.title')} text={t('learn.text')} />
      <ErrorNote error={error} />
      {!data && !error && <p className="sci-muted text-sm">{t('common.loading')}</p>}
      {data && (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
          <section className="xl:col-span-7 flex flex-col gap-4">
            <div className="flex flex-wrap gap-1.5 text-xs" role="tablist">
              {data.packs.map((p, n) => (
                <button key={p.region} role="tab" aria-selected={region === n} onClick={() => setRegion(n)} className={`px-3 py-1.5 rounded-full border ${region === n ? 'bg-[#00677d] text-white border-transparent' : 'bg-white sci-border'}`}>
                  {p.region}
                </button>
              ))}
            </div>
            {pack && (
              <div className="sci-card p-5 flex flex-col gap-4" data-testid="lesson-pack">
                <h2 className="font-['Space_Grotesk'] text-xl font-bold">{pack.region}</h2>
                {pack.stations.map((s) => (
                  <div key={s.id} className="sci-well p-3">
                    <p className="font-semibold text-sm">
                      <Link to={`/stations/${s.id}`} className="underline">
                        {s.name}
                      </Link>{' '}
                      <span className="sci-muted font-normal">· {s.locationName}</span>
                    </p>
                    <p className="text-sm mt-1">{s.description}</p>
                  </div>
                ))}
                <h3 className="text-sm font-semibold">From the archive</h3>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pack.records.map((r) => (
                    <li key={r.id}>
                      <button onClick={() => onOpenRecord(r.id)} className="w-full text-left sci-well p-2 flex gap-2 hover:shadow">
                        {r.thumbnailUrl && <img src={r.thumbnailUrl} alt="" className="w-14 h-14 rounded object-cover" loading="lazy" />}
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold line-clamp-2">{r.title}</span>
                          <span className="text-[11px] sci-muted">
                            {t(`type.${r.type}`)} · {r.year ?? ''}
                          </span>{' '}
                          <DataStatusBadge status={r.dataStatus} />
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button className="sci-btn-ghost w-fit text-sm" onClick={() => window.print()}>
                  Print this lesson pack
                </button>
              </div>
            )}
          </section>
          <div className="xl:col-span-5">
            <Quiz quiz={data.quiz} onNew={() => load(Math.floor(Math.random() * 1e6))} />
          </div>
        </div>
      )}
    </Page>
  );
}
