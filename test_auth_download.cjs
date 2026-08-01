const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function run() {
    try {
        const users = await prisma.user.findMany();
        if (users.length === 0) return console.log("No users found");
        
        // Find an admin user if possible, else just use the first one
        // Wait, since we don't have a role column, how is admin defined?
        // Let's just output the users to see what's going on.
        console.log("Users:", users.map(u => ({ id: u.id, email: u.email, planType: u.planType, role: u.role })));
        
    } catch (e) {
        console.error(e);
    } finally {
        await prisma.$disconnect();
    }
}
run();
