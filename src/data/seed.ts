import type { Company, Project, ProjectPhase, Task, TeamMember } from '../types';

export const DEFAULT_PHASES: ProjectPhase[] = [
  { id: 'ph1', name: 'Briefing'   },
  { id: 'ph2', name: 'Estratégia' },
  { id: 'ph3', name: 'Produção'   },
  { id: 'ph4', name: 'Revisão'    },
  { id: 'ph5', name: 'Lançamento' },
  { id: 'ph6', name: 'Análise'    },
];

export const seedTeamMembers: TeamMember[] = [
  { id: 'tm0', name: 'Paulo Maia',     role: 'Admin',          avatar: 'PM', color: '#FF5C35', email: 'paulogmaia@gmail.com',    permission: 'Admin'   },
  { id: 'tm1', name: 'Ana Souza',      role: 'Art Director',   avatar: 'AS', color: '#8B5CF6', email: 'ana@marketflow.com',      permission: 'Admin'   },
  { id: 'tm2', name: 'Pedro Lima',     role: 'Copywriter',     avatar: 'PL', color: '#3B82F6', email: 'pedro@marketflow.com',    permission: 'Gerente' },
  { id: 'tm3', name: 'Julia Ramos',    role: 'Strategist',     avatar: 'JR', color: '#10B981', email: 'julia@marketflow.com',    permission: 'Gerente' },
  { id: 'tm4', name: 'Carlos Neto',    role: 'Motion Designer',avatar: 'CN', color: '#F59E0B', email: 'carlos@marketflow.com',   permission: 'Membro'  },
  { id: 'tm5', name: 'Mariana Costa',  role: 'Media Buyer',    avatar: 'MC', color: '#EF4444', email: 'mariana@marketflow.com',  permission: 'Membro'  },
  { id: 'tm6', name: 'Rafael Dias',    role: 'SEO Specialist', avatar: 'RD', color: '#06B6D4', email: 'rafael@marketflow.com',   permission: 'Membro'  },
  { id: 'tm7', name: 'Beatriz Fontes', role: 'Social Media',   avatar: 'BF', color: '#EC4899', email: 'beatriz@marketflow.com',  permission: 'Membro'  },
  { id: 'tm8', name: 'Lucas Oliveira', role: 'Video Producer', avatar: 'LO', color: '#84CC16', email: 'lucas@marketflow.com',    permission: 'Visualizador' },
];

// Passwords never enter the store — kept in a static module-level map
export const MEMBER_PASSWORDS: Record<string, string> = {
  tm0: 'Daniel@2016',
  tm1: 'ana123',
  tm2: 'pedro123',
  tm3: 'julia123',
  tm4: 'carlos123',
  tm5: 'mariana123',
  tm6: 'rafael123',
  tm7: 'beatriz123',
  tm8: 'lucas123',
};

export const seedCompanies: Company[] = [
  { id: 'c1', name: 'Velour Studio', industry: 'Fashion & Lifestyle', color: '#FF5C35', logo: 'VS' },
  { id: 'c2', name: 'Stackly', industry: 'SaaS / Tech', color: '#6366F1', logo: 'SK' },
  { id: 'c3', name: 'Brasa Group', industry: 'Food & Restaurants', color: '#F59E0B', logo: 'BG' },
];

export const seedProjects: Project[] = [
  {
    id: 'p1', companyId: 'c1', name: 'SS25 Campaign', color: '#FF5C35',
    description: 'Spring/Summer 2025 brand campaign across all channels',
    startDate: '2026-01-15', endDate: '2026-04-30',
    teamMemberIds: ['tm1', 'tm2', 'tm3', 'tm4', 'tm5'],
    phases: DEFAULT_PHASES.map(p => ({ ...p, id: `p1-${p.id}` })),
  },
  {
    id: 'p2', companyId: 'c1', name: 'Influencer Program', color: '#FB923C',
    description: 'Quarterly influencer partnership program',
    startDate: '2026-02-01', endDate: '2026-05-31',
    teamMemberIds: ['tm1', 'tm7', 'tm2'],
    phases: DEFAULT_PHASES.map(p => ({ ...p, id: `p2-${p.id}` })),
  },
  {
    id: 'p3', companyId: 'c2', name: 'Product Launch — v3.0', color: '#6366F1',
    description: 'Full go-to-market for Stackly v3.0 feature release',
    startDate: '2026-02-10', endDate: '2026-04-15',
    teamMemberIds: ['tm2', 'tm3', 'tm5', 'tm6'],
    phases: DEFAULT_PHASES.map(p => ({ ...p, id: `p3-${p.id}` })),
  },
  {
    id: 'p4', companyId: 'c2', name: 'SEO & Content Buildout', color: '#8B5CF6',
    description: 'Organic growth initiative — 60 articles, technical SEO audit',
    startDate: '2026-01-01', endDate: '2026-06-30',
    teamMemberIds: ['tm3', 'tm6', 'tm2'],
    phases: DEFAULT_PHASES.map(p => ({ ...p, id: `p4-${p.id}` })),
  },
  {
    id: 'p5', companyId: 'c3', name: 'Grand Opening — Pinheiros', color: '#F59E0B',
    description: 'New location launch campaign for Pinheiros unit',
    startDate: '2026-02-20', endDate: '2026-04-01',
    teamMemberIds: ['tm1', 'tm4', 'tm7', 'tm8'],
    phases: DEFAULT_PHASES.map(p => ({ ...p, id: `p5-${p.id}` })),
  },
  {
    id: 'p6', companyId: 'c3', name: 'Summer Menu Push', color: '#FBBF24',
    description: 'Seasonal campaign promoting new summer menu items',
    phases: DEFAULT_PHASES.map(p => ({ ...p, id: `p6-${p.id}` })),
    startDate: '2026-03-01', endDate: '2026-05-15',
    teamMemberIds: ['tm2', 'tm7', 'tm5'],
  },
];

// today ref: ~2026-03-26
export const seedTasks: Task[] = [
  // P1: SS25 Campaign
  { id: 't1', projectId: 'p1', phase: 'Briefing', title: 'Client kickoff meeting', type: 'Meeting', status: 'Done', priority: 'High', assigneeId: 'tm3', dueDate: '2026-01-20', createdAt: '2026-01-15' },
  { id: 't2', projectId: 'p1', phase: 'Briefing', title: 'Brand guidelines review', type: 'Design', status: 'Done', priority: 'Medium', assigneeId: 'tm1', dueDate: '2026-01-25', createdAt: '2026-01-15' },
  { id: 't3', projectId: 'p1', phase: 'Strategy', title: 'Channel strategy document', type: 'Copy', status: 'Done', priority: 'High', assigneeId: 'tm3', dueDate: '2026-02-05', createdAt: '2026-01-16' },
  { id: 't4', projectId: 'p1', phase: 'Strategy', title: 'Paid media plan', type: 'Ads', status: 'Done', priority: 'High', assigneeId: 'tm5', dueDate: '2026-02-10', createdAt: '2026-01-16' },
  { id: 't5', projectId: 'p1', phase: 'Production', title: 'Hero campaign visuals (12 assets)', type: 'Design', status: 'In Progress', priority: 'Urgent', assigneeId: 'tm1', dueDate: '2026-03-20', createdAt: '2026-02-10', description: 'Full set of hero images for Instagram, TikTok, and editorial placements.' },
  { id: 't6', projectId: 'p1', phase: 'Production', title: 'Campaign film — 60s cut', type: 'Video', status: 'In Progress', priority: 'Urgent', assigneeId: 'tm4', dueDate: '2026-03-28', createdAt: '2026-02-10' },
  { id: 't7', projectId: 'p1', phase: 'Production', title: 'Ad copy variants (A/B)', type: 'Copy', status: 'Review', priority: 'High', assigneeId: 'tm2', dueDate: '2026-03-15', createdAt: '2026-02-12' },
  { id: 't8', projectId: 'p1', phase: 'Production', title: 'Email sequence (5 emails)', type: 'Email', status: 'Blocked', priority: 'High', assigneeId: 'tm2', dueDate: '2026-03-18', createdAt: '2026-02-12', description: 'Waiting on final product photos from client.' },
  { id: 't9', projectId: 'p1', phase: 'Review', title: 'Client review — round 1', type: 'Meeting', status: 'Not Started', priority: 'High', assigneeId: 'tm3', dueDate: '2026-04-02', createdAt: '2026-02-15' },
  { id: 't10', projectId: 'p1', phase: 'Launch', title: 'Paid campaign go-live', type: 'Ads', status: 'Not Started', priority: 'Urgent', assigneeId: 'tm5', dueDate: '2026-04-15', createdAt: '2026-02-15' },
  { id: 't11', projectId: 'p1', phase: 'Launch', title: 'Social media rollout', type: 'Social', status: 'Not Started', priority: 'High', assigneeId: 'tm7', dueDate: '2026-04-15', createdAt: '2026-02-15' },
  { id: 't12', projectId: 'p1', phase: 'Analysis', title: 'Performance report — week 1', type: 'Analytics', status: 'Not Started', priority: 'Medium', assigneeId: 'tm5', dueDate: '2026-04-22', createdAt: '2026-02-15' },

  // P2: Influencer Program
  { id: 't13', projectId: 'p2', phase: 'Briefing', title: 'Influencer criteria doc', type: 'Copy', status: 'Done', priority: 'Medium', assigneeId: 'tm7', dueDate: '2026-02-10', createdAt: '2026-02-01' },
  { id: 't14', projectId: 'p2', phase: 'Strategy', title: 'Shortlist 15 micro-influencers', type: 'Social', status: 'Done', priority: 'High', assigneeId: 'tm7', dueDate: '2026-02-20', createdAt: '2026-02-01' },
  { id: 't15', projectId: 'p2', phase: 'Production', title: 'Brand kit for creators', type: 'Design', status: 'In Progress', priority: 'Medium', assigneeId: 'tm1', dueDate: '2026-03-30', createdAt: '2026-02-15' },
  { id: 't16', projectId: 'p2', phase: 'Production', title: 'Briefing scripts for each influencer', type: 'Copy', status: 'In Progress', priority: 'High', assigneeId: 'tm2', dueDate: '2026-03-25', createdAt: '2026-02-15' },
  { id: 't17', projectId: 'p2', phase: 'Review', title: 'Content approval round', type: 'Meeting', status: 'Not Started', priority: 'High', assigneeId: 'tm3', dueDate: '2026-04-10', createdAt: '2026-02-20' },
  { id: 't18', projectId: 'p2', phase: 'Launch', title: 'Publish coordinator schedule', type: 'Social', status: 'Not Started', priority: 'Medium', assigneeId: 'tm7', dueDate: '2026-04-20', createdAt: '2026-02-20' },

  // P3: Stackly v3.0 Launch
  { id: 't19', projectId: 'p3', phase: 'Briefing', title: 'GTM strategy session', type: 'Meeting', status: 'Done', priority: 'High', assigneeId: 'tm3', dueDate: '2026-02-15', createdAt: '2026-02-10' },
  { id: 't20', projectId: 'p3', phase: 'Briefing', title: 'Competitive analysis', type: 'Analytics', status: 'Done', priority: 'High', assigneeId: 'tm3', dueDate: '2026-02-20', createdAt: '2026-02-10' },
  { id: 't21', projectId: 'p3', phase: 'Strategy', title: 'Messaging framework', type: 'Copy', status: 'Done', priority: 'Urgent', assigneeId: 'tm2', dueDate: '2026-02-28', createdAt: '2026-02-12' },
  { id: 't22', projectId: 'p3', phase: 'Strategy', title: 'SEO keyword mapping', type: 'SEO', status: 'Done', priority: 'High', assigneeId: 'tm6', dueDate: '2026-03-05', createdAt: '2026-02-12' },
  { id: 't23', projectId: 'p3', phase: 'Production', title: 'Landing page copy', type: 'Copy', status: 'Review', priority: 'Urgent', assigneeId: 'tm2', dueDate: '2026-03-20', createdAt: '2026-02-20', description: 'Hero section, feature blocks, pricing section, and FAQ.' },
  { id: 't24', projectId: 'p3', phase: 'Production', title: 'Product demo video (3 min)', type: 'Video', status: 'In Progress', priority: 'Urgent', assigneeId: 'tm4', dueDate: '2026-03-28', createdAt: '2026-02-20' },
  { id: 't25', projectId: 'p3', phase: 'Production', title: 'Launch email sequence', type: 'Email', status: 'In Progress', priority: 'High', assigneeId: 'tm2', dueDate: '2026-03-25', createdAt: '2026-02-22' },
  { id: 't26', projectId: 'p3', phase: 'Production', title: 'Google Ads campaign setup', type: 'Ads', status: 'Not Started', priority: 'High', assigneeId: 'tm5', dueDate: '2026-04-01', createdAt: '2026-02-22' },
  { id: 't27', projectId: 'p3', phase: 'Review', title: 'Stakeholder review meeting', type: 'Meeting', status: 'Not Started', priority: 'High', assigneeId: 'tm3', dueDate: '2026-04-05', createdAt: '2026-03-01' },
  { id: 't28', projectId: 'p3', phase: 'Launch', title: 'Product Hunt launch', type: 'Social', status: 'Not Started', priority: 'Urgent', assigneeId: 'tm3', dueDate: '2026-04-10', createdAt: '2026-03-01' },
  { id: 't29', projectId: 'p3', phase: 'Launch', title: 'Press outreach (10 journalists)', type: 'Copy', status: 'Not Started', priority: 'High', assigneeId: 'tm2', dueDate: '2026-04-08', createdAt: '2026-03-01' },
  { id: 't30', projectId: 'p3', phase: 'Analysis', title: 'Launch week analytics report', type: 'Analytics', status: 'Not Started', priority: 'Medium', assigneeId: 'tm6', dueDate: '2026-04-18', createdAt: '2026-03-01' },

  // P4: SEO & Content
  { id: 't31', projectId: 'p4', phase: 'Briefing', title: 'Technical SEO audit', type: 'SEO', status: 'Done', priority: 'High', assigneeId: 'tm6', dueDate: '2026-01-20', createdAt: '2026-01-01' },
  { id: 't32', projectId: 'p4', phase: 'Strategy', title: 'Content calendar Q1', type: 'Copy', status: 'Done', priority: 'High', assigneeId: 'tm3', dueDate: '2026-01-30', createdAt: '2026-01-05' },
  { id: 't33', projectId: 'p4', phase: 'Production', title: 'Article batch #1 (10 posts)', type: 'Copy', status: 'Done', priority: 'High', assigneeId: 'tm2', dueDate: '2026-02-28', createdAt: '2026-01-15' },
  { id: 't34', projectId: 'p4', phase: 'Production', title: 'Article batch #2 (10 posts)', type: 'Copy', status: 'In Progress', priority: 'High', assigneeId: 'tm2', dueDate: '2026-03-31', createdAt: '2026-02-15' },
  { id: 't35', projectId: 'p4', phase: 'Production', title: 'Backlink outreach campaign', type: 'SEO', status: 'In Progress', priority: 'Medium', assigneeId: 'tm6', dueDate: '2026-04-15', createdAt: '2026-02-01' },
  { id: 't36', projectId: 'p4', phase: 'Analysis', title: 'Q1 SEO performance review', type: 'Analytics', status: 'Not Started', priority: 'Medium', assigneeId: 'tm6', dueDate: '2026-04-05', createdAt: '2026-03-01' },

  // P5: Grand Opening
  { id: 't37', projectId: 'p5', phase: 'Briefing', title: 'Location briefing & site visit', type: 'Meeting', status: 'Done', priority: 'High', assigneeId: 'tm3', dueDate: '2026-02-25', createdAt: '2026-02-20' },
  { id: 't38', projectId: 'p5', phase: 'Strategy', title: 'Launch event plan', type: 'Meeting', status: 'Done', priority: 'High', assigneeId: 'tm3', dueDate: '2026-03-05', createdAt: '2026-02-22' },
  { id: 't39', projectId: 'p5', phase: 'Production', title: 'Event photography/video brief', type: 'Video', status: 'Done', priority: 'Medium', assigneeId: 'tm8', dueDate: '2026-03-10', createdAt: '2026-02-25' },
  { id: 't40', projectId: 'p5', phase: 'Production', title: 'Social teaser content (6 posts)', type: 'Social', status: 'In Progress', priority: 'High', assigneeId: 'tm7', dueDate: '2026-03-28', createdAt: '2026-03-01' },
  { id: 't41', projectId: 'p5', phase: 'Production', title: 'Opening day flyer & menu design', type: 'Design', status: 'Review', priority: 'High', assigneeId: 'tm1', dueDate: '2026-03-22', createdAt: '2026-03-01' },
  { id: 't42', projectId: 'p5', phase: 'Production', title: 'Local press kit', type: 'Copy', status: 'Blocked', priority: 'Urgent', assigneeId: 'tm2', dueDate: '2026-03-15', createdAt: '2026-03-01', description: 'Waiting on final logo sign-off from client.' },
  { id: 't43', projectId: 'p5', phase: 'Launch', title: 'Grand opening event day', type: 'Meeting', status: 'Not Started', priority: 'Urgent', assigneeId: 'tm8', dueDate: '2026-04-01', createdAt: '2026-03-05' },
  { id: 't44', projectId: 'p5', phase: 'Analysis', title: 'Post-event reach report', type: 'Analytics', status: 'Not Started', priority: 'Medium', assigneeId: 'tm3', dueDate: '2026-04-08', createdAt: '2026-03-05' },

  // P6: Summer Menu Push
  { id: 't45', projectId: 'p6', phase: 'Briefing', title: 'Menu items photo shoot brief', type: 'Design', status: 'Done', priority: 'High', assigneeId: 'tm1', dueDate: '2026-03-10', createdAt: '2026-03-01' },
  { id: 't46', projectId: 'p6', phase: 'Strategy', title: 'Promo calendar planning', type: 'Meeting', status: 'Done', priority: 'Medium', assigneeId: 'tm3', dueDate: '2026-03-15', createdAt: '2026-03-02' },
  { id: 't47', projectId: 'p6', phase: 'Production', title: 'Food photography (12 dishes)', type: 'Design', status: 'In Progress', priority: 'High', assigneeId: 'tm1', dueDate: '2026-04-01', createdAt: '2026-03-10' },
  { id: 't48', projectId: 'p6', phase: 'Production', title: 'Instagram reels (4 videos)', type: 'Video', status: 'Not Started', priority: 'High', assigneeId: 'tm8', dueDate: '2026-04-10', createdAt: '2026-03-10' },
  { id: 't49', projectId: 'p6', phase: 'Production', title: 'Delivery app banner ads', type: 'Ads', status: 'Not Started', priority: 'Medium', assigneeId: 'tm5', dueDate: '2026-04-08', createdAt: '2026-03-12' },
  { id: 't50', projectId: 'p6', phase: 'Launch', title: 'Campaign launch week', type: 'Social', status: 'Not Started', priority: 'High', assigneeId: 'tm7', dueDate: '2026-04-20', createdAt: '2026-03-12' },
];
