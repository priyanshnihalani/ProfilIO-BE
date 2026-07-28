import { analyzeRoleAlignment } from './src/ats/analyzers/roleAlignmentAnalyzer.js';
const text = `
PRIYANSH NIHALANI
priyansh.nihalani@gmail.com | +91 7041958565 | Bantva, Gujarat
https://priyaansh-ai-portfolio.vercel.app/ | https://www.linkedin.com/in/priyansh-nihalani/ | https://github.com/priyanshnihalani
SUMMARY
Accomplished Full Stack Developer delivering 30% performance improvements in scalable applications for 10,000+ users, with expertise in React.js, Node.js, and PostgreSQL to design REST APIs and implement real-time communication, driving modern full-stack development excellence.
EXPERIENCE
Full Stack Developer | Tech Rover Solutions | Sep 2025 - Present
- Spearheaded development of a Parking Management System, designing vehicle entry/exit modules that enhanced operational efficiency by 30 percent.
- Engineered parking allocation workflows, reducing manual processing time by 25 percent.
- Architected responsive user interfaces using React.js, ensuring seamless user experience across 10+ devices and platforms.
- Designed backend APIs and database integrations using Node.js and PostgreSQL, driving data-driven decision making for 50+ stakeholders.
- Developed employee training modules for the Internal Training Department SaaS Platform, increasing employee engagement by 40 percent.
- Implemented role-based access functionality, ensuring secure and restricted access to sensitive information for 100+ users.
- Created real-time dashboards for tracking training progress, enabling data-driven decision making and reducing project timelines by 15 percent.
- Integrated frontend and backend workflows, streamlining development and reducing project timelines by 20 percent.
- Developed reconciliation workflows for the Reconciliation Management Platform, achieving a 95 percent accuracy rate in transaction matching.
- Optimized data management and reporting interfaces, providing actionable insights and driving business growth through a 25 percent reduction in operational costs.

Full Stack Developer Intern | Avadh Web | Feb 2025 - Apr 2025
- Developed a comprehensive blogging platform, designing and implementing a complete blog management application that increased user engagement by 50 percent.
- Automated CRUD operations for blog posts, ensuring seamless data management and retrieval for 1,000+ users.
- Built responsive user interfaces, providing an optimal user experience across various devices and platforms.
- Engineered backend APIs for content management, leveraging Node.js and PostgreSQL to drive data-driven decision making.
- Integrated database operations for storing and retrieving blog data, ensuring secure and efficient data management and reducing data retrieval time by 30 percent.
- Implemented authentication and user management functionality, ensuring secure and restricted access to sensitive informatioinating the need for intermediate server storage and reducing annual server storage costs by $15,000.
- Created and integrated QR code and OTP-based connection features, resulting in a 30% increase in secure user connections and a 25% reduction in connection errors.
- Engineered a real-time transfer progress tracking system, providing instant updates on file transfer status and achieving a 95% reduction in user complaints related to transfer issues.
- Enhanced end-to-end transfer security with WebRTC DataChannel optimization and backpressure handling, ensuring 100% data integrity.

Swapify - Skill Exchange Platform | Jun 2021
- Spearheaded the development of a comprehensive skill exchange platform using the MERN Stack, facilitating secure user authentication for over 50,000 registered users and achieving a 90% user retention rate.
- Designed and implemented robust user authentication and authorization features, reducing security incidents by 40% and ensuring secure access to platform functionality.
- Developed and deployed a scalable skill swapping system, resulting in a 25% increase in skill swaps and a 15% increase in user engagement.
- Created and integrated user profiles and feedback mechanisms, enabling users to rate and review experiences, and achieving a 4.5-star platform rating.
- Built and deployed a centralized admin dashboard, streamlining the management of over 10,000 user accounts, 5,000 skill swaps, and platform analytics, and reducing administrative tasks by 30%.
`;

const result = analyzeRoleAlignment(text, 'Full Stack Developer', '');
console.log('Inferred Seniority:', result.inferredSeniority);
