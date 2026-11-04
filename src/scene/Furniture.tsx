import { B, C, PAL } from './kit'

/**
 * Shared office furniture. Every piece is built facing +z with its backrest toward -z and its
 * origin on the floor under the seat, so callers only rotate and place it. Seat tops sit at
 * y ~0.55 (chairs) and ~0.82 (stools), matching the seatY values in layout.ts.
 */

const STAR = [0, 1, 2, 3, 4]

/** Five-star swivel base with casters and a gas-lift column; shared by the task chairs. */
function SwivelBase({ r = 0.2 }: { r?: number }) {
  return (
    <group>
      {STAR.map((i) => {
        const a = (i / 5) * Math.PI * 2
        return (
          <group key={i}>
            <B p={[Math.sin(a) * r * 0.5, 0.08, Math.cos(a) * r * 0.5]} s={[0.07, 0.04, r]} r={a} c={PAL.ink} />
            <B p={[Math.sin(a) * r, 0.04, Math.cos(a) * r]} s={[0.08, 0.08, 0.08]} c="#4a505a" />
          </group>
        )
      })}
      <C p={[0, 0.1, 0]} rad={0.07} h={0.08} c={PAL.metalDark} />
      <C p={[0, 0.32, 0]} rad={0.035} h={0.4} c={PAL.metal} />
    </group>
  )
}

/** Task chair: swivel base, cushioned seat, mesh-style back with lumbar pad, armrests and optional headrest. */
export function TaskChair({ c = '#2d3138', trim = '#4a505a', arms = true, head = false }: { c?: string; trim?: string; arms?: boolean; head?: boolean }) {
  return (
    <group>
      <SwivelBase />
      {/* seat: cushion with a darker pan underneath and a rolled front edge */}
      <B p={[0, 0.5, 0]} s={[0.52, 0.06, 0.5]} c={trim} />
      <B p={[0, 0.55, 0]} s={[0.5, 0.06, 0.48]} c={c} cast />
      <B p={[0, 0.54, 0.25]} s={[0.46, 0.08, 0.05]} c={c} />
      {/* back: frame, inset pad, lumbar support */}
      <B p={[0, 0.9, -0.23]} s={[0.5, 0.58, 0.05]} c={trim} cast />
      <B p={[0, 0.92, -0.2]} s={[0.4, 0.46, 0.04]} c={c} />
      <B p={[0, 0.72, -0.19]} s={[0.34, 0.1, 0.05]} c={trim} />
      <B p={[0, 0.62, -0.17]} s={[0.07, 0.14, 0.07]} c={PAL.metalDark} />
      {head && <B p={[0, 1.27, -0.23]} s={[0.3, 0.14, 0.06]} c={c} />}
      {arms &&
        [-0.28, 0.28].map((x) => (
          <group key={x}>
            <B p={[x, 0.66, -0.05]} s={[0.04, 0.16, 0.04]} c={PAL.metalDark} />
            <B p={[x, 0.75, 0]} s={[0.07, 0.04, 0.3]} c={PAL.ink} />
          </group>
        ))}
    </group>
  )
}

/** Fixed four-leg dining chair: steel legs with foot caps, padded seat, back with a top rail. */
export function DiningChair({ c }: { c: string }) {
  return (
    <group>
      {[-0.19, 0.19].flatMap((x) =>
        [-0.19, 0.19].map((z) => (
          <group key={`${x}${z}`}>
            <B p={[x, 0.24, z]} s={[0.04, 0.48, 0.04]} c={PAL.metal} />
            <B p={[x, 0.01, z]} s={[0.06, 0.02, 0.06]} c={PAL.ink} />
          </group>
        )),
      )}
      <B p={[0, 0.3, 0]} s={[0.38, 0.03, 0.03]} c={PAL.metalDark} />
      <B p={[0, 0.49, 0]} s={[0.46, 0.04, 0.44]} c={PAL.metalDark} />
      <B p={[0, 0.54, 0]} s={[0.44, 0.07, 0.42]} c={c} cast />
      {/* back posts, padded panel and top rail */}
      {[-0.19, 0.19].map((x) => (
        <B key={x} p={[x, 0.78, -0.19]} s={[0.04, 0.58, 0.04]} c={PAL.metal} />
      ))}
      <B p={[0, 0.78, -0.2]} s={[0.34, 0.26, 0.05]} c={c} cast />
      <B p={[0, 1.07, -0.19]} s={[0.42, 0.05, 0.05]} c={PAL.metalDark} />
    </group>
  )
}

/** Stool: weighted disc base, steel column with a footrest ring, round padded seat. */
export function Stool({ c, h = 0.72 }: { c: string; h?: number }) {
  return (
    <group>
      <C p={[0, 0.02, 0]} rad={0.24} h={0.04} c={PAL.metalDark} />
      <C p={[0, h / 2, 0]} rad={0.035} h={h} c={PAL.metal} />
      {/* footrest ring */}
      <B p={[0, h * 0.35, 0.16]} s={[0.3, 0.03, 0.03]} c={PAL.metal} />
      <B p={[0, h * 0.35, -0.16]} s={[0.3, 0.03, 0.03]} c={PAL.metal} />
      <B p={[0.16, h * 0.35, 0]} s={[0.03, 0.03, 0.3]} c={PAL.metal} />
      <B p={[-0.16, h * 0.35, 0]} s={[0.03, 0.03, 0.3]} c={PAL.metal} />
      <C p={[0, h + 0.02, 0]} rad={0.24} h={0.04} c={PAL.metalDark} />
      <C p={[0, h + 0.07, 0]} rad={0.23} h={0.08} c={c} cast />
    </group>
  )
}

/**
 * Rectangular table: laminate top with a contrasting edge band, two trestle legs with feet and a
 * stretcher, and a cable grommet. `top` is the surface height.
 */
export function Table({ w, d, top = 0.74, c = '#e4e7eb', edge = '#8f969f', grommet = true }: { w: number; d: number; top?: number; c?: string; edge?: string; grommet?: boolean }) {
  const legX = w / 2 - 0.25
  return (
    <group>
      <B p={[0, top - 0.03, 0]} s={[w, 0.06, d]} c={c} cast />
      <B p={[0, top - 0.065, 0]} s={[w + 0.02, 0.03, d + 0.02]} c={edge} />
      <B p={[0, top - 0.09, 0]} s={[w - 0.3, 0.04, d - 0.3]} c={PAL.metalDark} />
      {[-legX, legX].map((x) => (
        <group key={x}>
          <B p={[x, (top - 0.1) / 2, 0]} s={[0.07, top - 0.1, d - 0.25]} c={PAL.metal} />
          <B p={[x, 0.03, 0]} s={[0.16, 0.06, d - 0.05]} c={PAL.metalDark} />
        </group>
      ))}
      <B p={[0, top - 0.2, 0]} s={[legX * 2, 0.05, 0.05]} c={PAL.metalDark} />
      {grommet && <C p={[w * 0.2, top + 0.002, 0]} rad={0.05} h={0.01} c={PAL.ink} />}
    </group>
  )
}

/** Round high-top table with a pedestal, a flared base and a thin edge ring. */
export function HighTable({ rad = 0.52, top = 1.1 }: { rad?: number; top?: number }) {
  return (
    <group>
      <C p={[0, 0.03, 0]} rad={0.36} h={0.06} c={PAL.metalDark} />
      <C p={[0, 0.09, 0]} rad={0.2} h={0.06} c={PAL.metal} />
      <C p={[0, top / 2, 0]} rad={0.06} h={top} c={PAL.metal} />
      <C p={[0, top - 0.02, 0]} rad={rad + 0.02} h={0.03} c={PAL.metalDark} />
      <C p={[0, top + 0.01, 0]} rad={rad} h={0.05} c="#e4e7eb" cast />
    </group>
  )
}
