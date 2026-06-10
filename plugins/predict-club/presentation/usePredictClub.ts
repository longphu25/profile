import { useContext } from 'react'
import { PredictClubContext, type PredictClubContextValue } from './PredictClubContextCore'

export function usePredictClub(): PredictClubContextValue {
  const value = useContext(PredictClubContext)
  if (!value) throw new Error('usePredictClub must be inside PredictClubProvider')
  return value
}
