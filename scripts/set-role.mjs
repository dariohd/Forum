import { neon } from '@neondatabase/serverless'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL manquant. Lance: vercel env pull .env.local')
  process.exit(1)
}

const [username, role] = process.argv.slice(2)
const VALID_ROLES = ['user', 'moderator', 'admin']

if (!username || !VALID_ROLES.includes(role)) {
  console.error('Usage: npm run role:set -- <username> <user|moderator|admin>')
  process.exit(1)
}

const sql = neon(url)
const rows = await sql`
  UPDATE users SET role = ${role} WHERE username = ${username.toLowerCase()}
  RETURNING id, username, display_name, role
`

if (rows.length === 0) {
  console.error(`Utilisateur "${username}" introuvable.`)
  process.exit(1)
}

console.log(`${rows[0].display_name} (@${rows[0].username}) est maintenant "${rows[0].role}".`)
