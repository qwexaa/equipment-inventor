import { Router } from 'express'
import { authMiddleware } from '../security/authMiddleware.js'
import { requireRole } from '../security/roleMiddleware.js'
import { listUsers, createUser, updateUser, resetPassword, deleteUser } from '../controllers/adminController.js'
import { seedDemo } from '../controllers/demoController.js'

const router = Router()

router.use(authMiddleware)
router.use(requireRole('ADMIN'))

router.get('/users', listUsers)
router.post('/users', createUser)
router.patch('/users/:id', updateUser)
router.post('/users/:id/reset-password', resetPassword)
router.delete('/users/:id', deleteUser)
router.post('/demo/seed', seedDemo)

export default router
