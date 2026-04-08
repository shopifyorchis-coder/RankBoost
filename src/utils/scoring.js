const POWER_WORDS = [
  'best',
  'premium',
  'new',
  'top',
  'sale',
  'free',
  'official',
  'original',
]

function normalizeWords(value) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((word) => word.trim())
    .filter(Boolean)
}

function calculateLengthScore(title) {
  const length = title.trim().length

  if (length >= 40 && length <= 70) {
    return 25
  }

  if (length === 0) {
    return 0
  }

  if (length < 40) {
    const penalty = 40 - length
    return Math.max(0, 25 - penalty)
  }

  const penalty = Math.ceil((length - 70) / 2)
  return Math.max(0, 25 - penalty)
}

function calculateKeywordScore(title, tags) {
  const titleWords = new Set(normalizeWords(title))
  const tagWords = Array.from(new Set(normalizeWords(tags)))

  if (tagWords.length === 0) {
    return 0
  }

  const matches = tagWords.filter((word) => titleWords.has(word)).length
  return Math.min(25, Math.round((matches / tagWords.length) * 25))
}

function calculatePowerWordScore(title) {
  const titleWords = new Set(normalizeWords(title))
  const matches = POWER_WORDS.filter((word) => titleWords.has(word)).length
  return Math.min(20, matches * 5)
}

function calculateNumberScore(title) {
  return /\d/.test(title) ? 15 : 0
}

function calculateDescriptionScore(description) {
  return description.trim().length >= 100 ? 15 : 0
}

export function calculateTitleScore(title = '', description = '', tags = '') {
  const breakdown = {
    length: calculateLengthScore(title),
    keywords: calculateKeywordScore(title, tags),
    powerWords: calculatePowerWordScore(title),
    numbers: calculateNumberScore(title),
    description: calculateDescriptionScore(description),
  }

  const totalScore = Object.values(breakdown).reduce(
    (sum, score) => sum + score,
    0,
  )

  return {
    totalScore: Math.min(100, totalScore),
    breakdown,
  }
}

export default calculateTitleScore
