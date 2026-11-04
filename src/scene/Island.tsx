import { useMemo } from 'react'
import { Voxels } from './voxel'
import { buildWorld } from './world'

/** The static blocky office (floor, walls, server racks), built once. */
export function World() {
  const world = useMemo(() => buildWorld(), [])
  return <Voxels world={world} />
}
