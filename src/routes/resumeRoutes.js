import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import { prisma } from '../lib/prisma.js';
import { PLAN_LIMITS } from '../config/plans.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
    try {
        if (req.user.id === 'master-admin') {
            return res.json({ success: true, profiles: [] });
        }

        const profiles = await prisma.resumeProfile.findMany({
            where: { userId: req.user.id },
            orderBy: { updatedAt: 'desc' }
        });

        res.json({ success: true, profiles });
    } catch (error) {
        console.error('Fetch profiles error:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch resume profiles.' });
    }
});

router.post('/', requireAuth, async (req, res) => {
    try {
        if (req.user.id === 'master-admin') {
            return res.status(400).json({ success: false, message: 'Admin cannot create profiles.' });
        }

        const { name, data } = req.body;
        if (!data) return res.status(400).json({ success: false, message: 'Resume data is required.' });

        const user = await prisma.user.findUnique({ 
            where: { id: req.user.id },
            include: { _count: { select: { resumeProfiles: true } } } 
        });

        if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

        const limit = PLAN_LIMITS[user.planType]?.resumeProfileLimit ?? 1;

        if (user._count.resumeProfiles >= limit) {
            return res.status(403).json({
                success: false,
                code: 'RESUME_PROFILE_LIMIT_REACHED',
                message: `You've reached the ${limit} resume profile limit included with your ${user.planType} plan.`
            });
        }

        const newProfile = await prisma.resumeProfile.create({
            data: {
                userId: user.id,
                name: name || 'My Resume',
                data: data
            }
        });

        res.json({ success: true, profile: newProfile });
    } catch (error) {
        console.error('Create profile error:', error);
        res.status(500).json({ success: false, message: error.message || 'Failed to create resume profile.' });
    }
});

router.put('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, data } = req.body;

        const profile = await prisma.resumeProfile.findFirst({
            where: { id, userId: req.user.id }
        });

        if (!profile) return res.status(404).json({ success: false, message: 'Profile not found.' });

        const updatedProfile = await prisma.resumeProfile.update({
            where: { id },
            data: {
                name: name !== undefined ? name : profile.name,
                data: data !== undefined ? data : profile.data
            }
        });

        res.json({ success: true, profile: updatedProfile });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to update resume profile.' });
    }
});

router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const profile = await prisma.resumeProfile.findFirst({
            where: { id, userId: req.user.id }
        });

        if (!profile) return res.status(404).json({ success: false, message: 'Profile not found.' });

        await prisma.resumeProfile.delete({ where: { id } });

        res.json({ success: true, message: 'Profile deleted successfully.' });
    } catch (error) {
        console.error('Delete profile error:', error);
        res.status(500).json({ success: false, message: 'Failed to delete resume profile.' });
    }
});

export default router;
