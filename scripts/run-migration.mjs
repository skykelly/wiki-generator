/**
 * run-migration.mjs
 * migrations/001_initial.sql 을 Neon에 실행한다.
 * 실행: node --env-file=.env scripts/run-migration.mjs
 */
import { Pool, neonConfig } from '@neondatabase/serverless'
import { readFileSync } from 'fs'

// Node.js 21+ 네이티브 WebSocket 사용
if (typeof globalThis.WebSocket !== 'undefined') {
  neonConfig.webSocketConstructor = globalThis.WebSocket
} else {
  console.error('❌ WebSocket을 사용할 수 없습니다. Node.js 21+ 가 필요합니다.')
  process.exit(1)
}

const connectionString = process.env.DATABASE_URL_UNPOOLED
if (!connectionString) {
  console.error('❌ DATABASE_URL_UNPOOLED 가 설정되지 않았습니다.')
  process.exit(1)
}

const pool = new Pool({ connectionString })
const files = process.argv[2]
  ? [process.argv[2]]
  : ['001_initial.sql', '002_add_image_columns.sql', '003_multi_tenant.sql', '004_wiki_rag_filter.sql']

const sql = files.map(f => readFileSync(`./migrations/${f}`, 'utf-8')).join('\n')

/**
 * $$ 달러 인용 블록을 인식하는 구문 분리기.
 */
function splitStatements(content) {
  const statements = []
  let current = ''
  let inDollarBlock = false
  let dollarTag = ''
  let i = 0

  while (i < content.length) {
    if (!inDollarBlock) {
      const m = content.slice(i).match(/^\$[^$]*\$/)
      if (m) {
        dollarTag = m[0]
        inDollarBlock = true
        current += dollarTag
        i += dollarTag.length
        continue
      }
      if (content[i] === ';') {
        const stmt = (current + ';').trim()
        if (stmt.length > 1) statements.push(stmt)
        current = ''
        i++
        continue
      }
    } else {
      if (content.slice(i).startsWith(dollarTag)) {
        current += dollarTag
        i += dollarTag.length
        inDollarBlock = false
        dollarTag = ''
        continue
      }
    }
    current += content[i]
    i++
  }

  const tail = current.trim()
  if (tail.length > 1) statements.push(tail)
  return statements
}

const statements = splitStatements(sql).filter(s =>
  s.replace(/^--.*$/gm, '').trim().length > 0
)

console.log(`\n📋 파일: ${files.join(', ')}`)
console.log(`📋 ${statements.length}개 구문 실행\n`)

const client = await pool.connect()
try {
  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i]
    const preview = stmt.replace(/\s+/g, ' ').slice(0, 80)
    try {
      await client.query(stmt)
      console.log(`✅ [${i + 1}/${statements.length}] ${preview}`)
    } catch (e) {
      const msg = e.message ?? ''
      if (msg.includes('already exists')) {
        console.log(`⚠️  [${i + 1}/${statements.length}] already exists — skip`)
      } else {
        console.error(`\n❌ [${i + 1}/${statements.length}] 실패: ${msg}`)
        throw e
      }
    }
  }
  console.log('\n✅ 마이그레이션 완료!')
} finally {
  client.release()
  await pool.end()
}
