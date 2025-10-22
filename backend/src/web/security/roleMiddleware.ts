import { Request, Response, NextFunction } from 'express'

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as { id:number; role:string } | undefined
    if (!user) return res.status(401).json({ error: 'Unauthorized' })
    if (!roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' })
    next()
  }
}
