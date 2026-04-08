import ProductInput from './components/ProductInput.jsx'
import ScoreCard from './components/ScoreCard.jsx'
import { calculateTitleScore } from './utils/scoring.js'

function App() {
  const scoreData = calculateTitleScore(
    'Best Premium Running Shoes 2026 Official Sale',
    'These lightweight running shoes are designed for daily training, road performance, and comfort with durable support for athletes and active lifestyles.',
    'shoes, running, sport, premium, official',
  )

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <ProductInput />
        <ScoreCard scoreData={scoreData} />
      </div>
    </main>
  )
}

export default App
