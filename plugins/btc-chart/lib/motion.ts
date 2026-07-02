// BTC Chart — shared motion presets (Meridian stitch cockpit).

import type { Transition, Variants } from 'motion/react'

/** Stitch theme easing curves */
export const stitchEase = [0.22, 1, 0.36, 1] as [number, number, number, number]
export const stitchSpring = [0.34, 1.2, 0.64, 1] as [number, number, number, number]

export const transitionFast: Transition = { duration: 0.22, ease: stitchEase }
export const transitionSpring: Transition = { duration: 0.35, ease: stitchSpring }
export const transitionDrawer: Transition = { duration: 0.32, ease: stitchSpring }

/** Accordion body expand/collapse */
export const accordionBody: Variants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: 'auto', opacity: 1 },
}

/** Right tools drawer panel */
export const drawerPanel: Variants = {
  hidden: { x: '100%', opacity: 0 },
  visible: { x: 0, opacity: 1 },
}

/** Tools scrim fade */
export const drawerScrim: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
}

/** Toast enter/exit */
export const toastItem: Variants = {
  hidden: { opacity: 0, y: -10, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -6, scale: 0.96 },
}

/** Loading overlay fade */
export const loadingOverlay: Variants = {
  visible: { opacity: 1 },
  hidden: { opacity: 0 },
}
