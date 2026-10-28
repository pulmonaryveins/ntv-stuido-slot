import { useMemo } from 'react'
import { Voxels } from './voxel'
import { buildWorld } from './world'

/** The static blocky office (floor, walls, studios, server racks, plants), built once. */
export function World({ buildings }: { buildings: number }) {
  const world = useMemo(() => buildWorld(buildings), [buildings])
  return <Voxels world={world} />
}
