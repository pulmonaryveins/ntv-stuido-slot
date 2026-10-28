// Vercel function: every /api/* request is rewritten here (see vercel.json) and routed by the BFF.
import { handle } from '../server/router.js'

export const GET = handle
export const POST = handle
