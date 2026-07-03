// BTC Chart — LazyMotion root for chart UI animations.

import type { ReactNode } from 'react'
import { LazyMotion, domAnimation } from '../lib/btc-motion'

export function BtcMotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      {children}
    </LazyMotion>
  )
}
