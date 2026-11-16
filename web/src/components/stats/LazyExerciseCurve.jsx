// Lazy wrapper that keeps Recharts out of the eager bundle.
import { lazy, Suspense } from 'react'

const ExerciseCurve = lazy(() => import('./ExerciseCurve.jsx'))

export default function LazyExerciseCurve(props) {
  return (
    <Suspense fallback={<div className="h-40 w-full" />}>
      <ExerciseCurve {...props} />
    </Suspense>
  )
}
