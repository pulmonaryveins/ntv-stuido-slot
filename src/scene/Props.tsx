import { B, C, GEO, GLOW, PAL, mat } from './kit'
import { CART } from './layout'

export function Bench({ p, r = 0 }: { p: [number, number]; r?: number }) {
  return (
    <group position={[p[0], 0, p[1]]} rotation={[0, r, 0]}>
      <B p={[0, 0.42, 0]} s={[1.6, 0.1, 0.5]} c={PAL.wood} cast />
      <B p={[0, 0.75, -0.22]} s={[1.6, 0.4, 0.08]} c={PAL.wood} cast />
      <B p={[-0.65, 0.2, 0]} s={[0.1, 0.4, 0.45]} c={PAL.metalDark} />
      <B p={[0.65, 0.2, 0]} s={[0.1, 0.4, 0.45]} c={PAL.metalDark} />
    </group>
  )
}

export function LampPost({ p }: { p: [number, number] }) {
  return (
    <group position={[p[0], 0, p[1]]}>
      <C p={[0, 0.1, 0]} rad={0.22} h={0.2} c={PAL.ink} />
      <C p={[0, 1.4, 0]} rad={0.06} h={2.6} c={PAL.ink} cast />
      <mesh geometry={GEO.ico} material={GLOW.lamp} position={[0, 2.8, 0]} scale={0.38} />
      <mesh geometry={GEO.cone} material={mat(PAL.ink)} position={[0, 3.05, 0]} scale={[0.5, 0.25, 0.5]} />
    </group>
  )
}

export function CoffeeCart() {
  return (
    <group position={[CART[0], 0, CART[1]]} rotation={[0, -0.5, 0]}>
      <B p={[0, 0.7, 0]} s={[1.8, 0.9, 1]} c={PAL.teal} cast />
      <B p={[0, 1.2, 0]} s={[1.9, 0.1, 1.1]} c={PAL.woodDark} />
      <C p={[-0.6, 0.25, 0.55]} rad={0.25} h={0.08} c={PAL.ink} rotation={[Math.PI / 2, 0, 0]} />
      <C p={[0.6, 0.25, 0.55]} rad={0.25} h={0.08} c={PAL.ink} rotation={[Math.PI / 2, 0, 0]} />
      <C p={[-0.5, 1.45, 0]} rad={0.18} h={0.4} c={PAL.metal} />
      <C p={[0.1, 1.35, 0.2]} rad={0.08} h={0.2} c={PAL.cream} />
      <C p={[0.35, 1.35, 0.2]} rad={0.08} h={0.2} c={PAL.amber} />
      <C p={[0, 1.6, -0.45]} rad={0.04} h={1.6} c={PAL.woodDark} />
      {/* striped canopy */}
      {[0, 1, 2, 3].map((i) => (
        <B key={i} p={[-0.75 + i * 0.5, 2.45, 0]} s={[0.5, 0.08, 1.4]} c={i % 2 ? PAL.cream : PAL.brick} r={0} cast />
      ))}
      <mesh geometry={GEO.ico} material={GLOW.bulb} position={[0, 2.25, 0.3]} scale={0.16} />
    </group>
  )
}

export function QueueLine({ length = 6 }: { length?: number }) {
  return (
    <group>
      {Array.from({ length: length + 1 }, (_, i) => (
        <group key={i}>
          {[3.05, 4.15].map((z) => (
            <group key={z} position={[-1.5 - i * 1.0, 0, z]}>
              <C p={[0, 0.05, 0]} rad={0.14} h={0.1} c={PAL.ink} />
              <C p={[0, 0.45, 0]} rad={0.04} h={0.8} c={PAL.amber} />
            </group>
          ))}
        </group>
      ))}
      {[3.05, 4.15].map((z) => (
        <B key={z} p={[-1.5 - length / 2, 0.78, z]} s={[length, 0.05, 0.05]} c={PAL.brick} />
      ))}
      <B p={[-1.1, 1.2, 3.6]} s={[0.05, 0.6, 0.9]} c={PAL.cream} />
    </group>
  )
}

export function SolarRows() {
  return (
    <group position={[9.2, 0, 6.2]} rotation={[0, -0.25, 0]}>
      {[0, 1, 2].map((row) =>
        [0, 1, 2].map((col) => (
          <group key={`${row}-${col}`} position={[col * 1.35 - 1.3, 0, row * 1.5 - 1.5]}>
            <C p={[0, 0.35, 0]} rad={0.05} h={0.7} c={PAL.metalDark} />
            <mesh geometry={GEO.box} material={mat(PAL.solar)} position={[0, 0.75, 0]} rotation={[-0.55, 0, 0]} scale={[1.2, 0.06, 0.9]} castShadow />
            <mesh geometry={GEO.box} material={mat('#8fb3e6')} position={[0, 0.79, 0.02]} rotation={[-0.55, 0, 0]} scale={[1.1, 0.02, 0.06]} />
          </group>
        )),
      )}
    </group>
  )
}

function Container({ p, c, r = 0, y = 0 }: { p: [number, number]; c: string; r?: number; y?: number }) {
  return (
    <group position={[p[0], y, p[1]]} rotation={[0, r, 0]}>
      <B p={[0, 0.6, 0]} s={[2.6, 1.2, 1.1]} c={c} cast />
      {[-1, -0.6, -0.2, 0.2, 0.6, 1].map((x) => (
        <B key={x} p={[x, 0.6, 0.56]} s={[0.08, 1.1, 0.04]} c={PAL.ink} />
      ))}
    </group>
  )
}

export function Containers() {
  return (
    <group>
      <Container p={[-9.4, 6.6]} c={PAL.teal} r={0.35} />
      <Container p={[-9.2, 6.7]} c={PAL.amber} r={0.25} y={1.2} />
      <Container p={[-10.6, 4.2]} c={PAL.brick} r={1.4} />
      <B p={[-7.6, 0.35, 8.4]} s={[0.7, 0.7, 0.7]} c={PAL.woodDark} cast r={0.3} />
      <B p={[-7.0, 0.25, 8.9]} s={[0.5, 0.5, 0.5]} c={PAL.wood} cast r={0.8} />
    </group>
  )
}

export function Plaza() {
  return (
    <group>
      <CoffeeCart />
      <QueueLine />
      <Bench p={[2.6, 8.4]} r={-0.4} />
      <Bench p={[-2.8, 8.6]} r={0.4} />
      <Bench p={[8.2, 3.4]} r={-1.4} />
      <LampPost p={[2.6, 1.6]} />
      <LampPost p={[-2.8, 1.6]} />
      <LampPost p={[5, 9.2]} />
      <LampPost p={[-5.4, 9.0]} />
    </group>
  )
}
