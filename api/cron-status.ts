import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!getApps().length) {
  try {
    const serviceAccount = JSON.parse(
      process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
    );
    
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const db = getFirestore();

/**
 * Cron Status Dashboard
 * Shows current status of all accounts and when they were last synced
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    // Get all organizations
    const orgsSnapshot = await db.collection('organizations').get();
    
    const status: any = {
      timestamp: new Date().toISOString(),
      totalOrganizations: orgsSnapshot.size,
      organizations: []
    };

    // Process each organization
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const orgData = orgDoc.data();
      
      const orgStatus: any = {
        orgId,
        orgName: orgData.name || 'Unknown',
        projects: []
      };

      // Get all projects
      const projectsSnapshot = await db
        .collection('organizations')
        .doc(orgId)
        .collection('projects')
        .get();

      for (const projectDoc of projectsSnapshot.docs) {
        const projectId = projectDoc.id;
        const projectData = projectDoc.data();
        
        const projectStatus: any = {
          projectId,
          projectName: projectData.name || 'Unknown',
          accounts: []
        };

        // Get all active accounts
        const accountsSnapshot = await db
          .collection('organizations')
          .doc(orgId)
          .collection('projects')
          .doc(projectId)
          .collection('trackedAccounts')
          .where('isActive', '==', true)
          .get();

        for (const accountDoc of accountsSnapshot.docs) {
          const accountData = accountDoc.data();
          
          projectStatus.accounts.push({
            accountId: accountDoc.id,
            username: accountData.username,
            platform: accountData.platform,
            totalVideos: accountData.totalVideos || 0,
            lastSynced: accountData.lastSynced?.toDate().toISOString() || 'Never',
            timeSinceSync: accountData.lastSynced 
              ? getTimeSince(accountData.lastSynced.toDate())
              : 'Never synced',
            isActive: accountData.isActive
          });
        }

        orgStatus.projects.push(projectStatus);
      }

      status.organizations.push(orgStatus);
    }

    // Return HTML dashboard
    const html = generateDashboard(status);
    
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(html);

  } catch (error: any) {
    return res.status(500).json({
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}

function getTimeSince(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function generateDashboard(status: any): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Cron Status Dashboard</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 { font-size: 32px; margin-bottom: 10px; }
    .header p { opacity: 0.9; font-size: 14px; }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      padding: 30px;
      background: #f8f9fa;
      border-bottom: 1px solid #e0e0e0;
    }
    .stat {
      background: white;
      padding: 20px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.05);
    }
    .stat-value {
      font-size: 36px;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 8px;
    }
    .stat-label {
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .content { padding: 30px; }
    .org {
      margin-bottom: 30px;
      border: 1px solid #e0e0e0;
      border-radius: 12px;
      overflow: hidden;
    }
    .org-header {
      background: #667eea;
      color: white;
      padding: 15px 20px;
      font-weight: 600;
      font-size: 18px;
    }
    .project {
      border-left: 3px solid #764ba2;
      margin: 15px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .project-header {
      background: #764ba2;
      color: white;
      padding: 12px 15px;
      font-weight: 500;
      font-size: 16px;
    }
    .accounts {
      padding: 15px;
    }
    .account {
      background: white;
      padding: 15px;
      margin-bottom: 10px;
      border-radius: 8px;
      display: grid;
      grid-template-columns: auto 100px 80px 120px 150px;
      gap: 15px;
      align-items: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.05);
    }
    .account:last-child { margin-bottom: 0; }
    .username {
      font-weight: 600;
      color: #333;
    }
    .platform {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .platform.instagram { background: #e1306c; color: white; }
    .platform.tiktok { background: #000; color: white; }
    .platform.youtube { background: #ff0000; color: white; }
    .videos {
      color: #666;
      font-size: 14px;
    }
    .synced {
      font-size: 13px;
      color: #666;
    }
    .time-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .time-badge.recent { background: #4caf50; color: white; }
    .time-badge.old { background: #ff9800; color: white; }
    .time-badge.never { background: #f44336; color: white; }
    .actions {
      margin-top: 30px;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 12px;
      text-align: center;
    }
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      margin: 0 10px;
      transition: transform 0.2s;
    }
    .btn:hover { transform: translateY(-2px); }
    .empty {
      text-align: center;
      padding: 60px 20px;
      color: #999;
    }
    .refresh-info {
      text-align: center;
      padding: 15px;
      background: #e3f2fd;
      border-radius: 8px;
      margin-bottom: 20px;
      color: #1976d2;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 Cron Status Dashboard</h1>
      <p>Real-time monitoring of automated video refreshes</p>
      <p style="margin-top: 10px; font-size: 12px;">Last updated: ${status.timestamp}</p>
    </div>
    
    <div class="stats">
      <div class="stat">
        <div class="stat-value">${status.totalOrganizations}</div>
        <div class="stat-label">Organizations</div>
      </div>
      <div class="stat">
        <div class="stat-value">${status.organizations.reduce((sum: number, org: any) => sum + org.projects.length, 0)}</div>
        <div class="stat-label">Projects</div>
      </div>
      <div class="stat">
        <div class="stat-value">${status.organizations.reduce((sum: number, org: any) => 
          sum + org.projects.reduce((pSum: number, proj: any) => pSum + proj.accounts.length, 0), 0)}</div>
        <div class="stat-label">Active Accounts</div>
      </div>
      <div class="stat">
        <div class="stat-value">${status.organizations.reduce((sum: number, org: any) => 
          sum + org.projects.reduce((pSum: number, proj: any) => 
            pSum + proj.accounts.reduce((aSum: number, acc: any) => aSum + acc.totalVideos, 0), 0), 0)}</div>
        <div class="stat-label">Total Videos</div>
      </div>
    </div>
    
    <div class="content">
      <div class="refresh-info">
        ⏰ Automatic refresh runs every 12 hours • Next sync: Check Vercel Crons tab
      </div>
      
      ${status.organizations.length === 0 ? '<div class="empty">No organizations found</div>' : 
        status.organizations.map((org: any) => `
          <div class="org">
            <div class="org-header">📁 ${org.orgName}</div>
            ${org.projects.map((project: any) => `
              <div class="project">
                <div class="project-header">📦 ${project.projectName}</div>
                <div class="accounts">
                  ${project.accounts.length === 0 ? '<div style="text-align: center; color: #999; padding: 20px;">No accounts tracked</div>' :
                    project.accounts.map((account: any) => `
                      <div class="account">
                        <div class="username">@${account.username}</div>
                        <div class="platform ${account.platform}">${account.platform}</div>
                        <div class="videos">${account.totalVideos} videos</div>
                        <div class="synced">${account.lastSynced === 'Never' ? 'Never synced' : new Date(account.lastSynced).toLocaleString()}</div>
                        <div class="time-badge ${getTimeBadgeClass(account.timeSinceSync)}">${account.timeSinceSync}</div>
                      </div>
                    `).join('')
                  }
                </div>
              </div>
            `).join('')}
          </div>
        `).join('')
      }
      
      <div class="actions">
        <a href="/api/cron-test" class="btn" onclick="return confirm('Trigger manual refresh now?')">🔄 Trigger Manual Refresh</a>
        <a href="/api/cron-status" class="btn">🔃 Refresh Dashboard</a>
      </div>
    </div>
  </div>
  
  <script>
    function getTimeBadgeClass(time) {
      if (time === 'Never synced') return 'never';
      if (time.includes('m') || time.includes('s')) return 'recent';
      if (time.includes('h') && parseInt(time) < 24) return 'recent';
      return 'old';
    }
  </script>
</body>
</html>
  `;
}

