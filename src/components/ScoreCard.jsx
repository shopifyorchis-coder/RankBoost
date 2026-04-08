function ScoreCard({ scoreData }) {
  const totalScore = scoreData?.totalScore ?? 0
  const breakdown = scoreData?.breakdown ?? {}

  let progressColor = 'bg-red-500'
  let message = 'Needs Improvement'

  if (totalScore >= 40 && totalScore <= 70) {
    progressColor = 'bg-yellow-500'
    message = 'Good but can be better'
  }

  if (totalScore > 70) {
    progressColor = 'bg-green-500'
    message = 'Great SEO Title!'
  }

  const rows = [
    { label: 'Length', value: breakdown.length ?? 0 },
    { label: 'Keywords', value: breakdown.keywords ?? 0 },
    { label: 'Power Words', value: breakdown.powerWords ?? 0 },
    { label: 'Numbers', value: breakdown.numbers ?? 0 },
    { label: 'Description', value: breakdown.description ?? 0 },
  ]

  return (
    <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Score
        </p>
        <div className="mt-4 text-6xl font-bold tracking-tight text-slate-900">
          {totalScore}
          <span className="text-2xl font-medium text-slate-400">/100</span>
        </div>
      </div>

      <div className="mt-6 h-3 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-all ${progressColor}`}
          style={{ width: `${Math.min(totalScore, 100)}%` }}
        />
      </div>

      <p className="mt-4 text-center text-sm font-medium text-slate-600">
        {message}
      </p>

      <div className="mt-8 space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
          >
            <span className="text-sm font-medium text-slate-700">
              {row.label}
            </span>
            <span className="text-sm font-semibold text-slate-900">
              {row.value}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default ScoreCard
