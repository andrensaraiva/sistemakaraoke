import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSummaryCsv, mergeReportRequests, requestsForNights, summarizeRequests } from '../src/reports.ts'

const request = (id, createdAt, song, artist, status, nightId = 'noite-a', table = '') => ({
  id, nightId, ownerUid: 'cantor-1', name: 'Ana', table, song, artist,
  suggestedUrl: '', selectedUrl: '', status, misses: 0, onMyWay: false, createdAt,
})

test('histórico mantém dois pedidos da mesma pessoa e não conta duplicata arquivada', () => {
  const first = request('noite-a_cantor-1', 1_800_000_000_000, 'Evidências', 'Chitãozinho & Xororó', 'completed')
  const second = request('noite-a_cantor-1', 1_800_000_001_000, 'Tempo Perdido', 'Legião Urbana', 'queued')
  const merged = mergeReportRequests([second], [first, { ...second, status: 'cancelled' }])
  assert.equal(merged.length, 2)
  assert.equal(merged[1].status, 'cancelled')
  assert.equal(summarizeRequests(merged).total, 2)
})

test('rankings juntam acentos e maiúsculas e separam apresentações de pedidos', () => {
  const records = [
    request('1', 1_800_000_000_000, 'Evidências', 'Chitãozinho & Xororó', 'completed', 'noite-a', '04'),
    request('2', 1_800_000_001_000, 'evidencias', 'CHITÃOZINHO & XORORÓ', 'cancelled', 'noite-a'),
    request('3', 1_800_000_002_000, 'Tempo Perdido', 'Legião Urbana', 'rejected', 'noite-b'),
  ]
  const summary = summarizeRequests(records)
  assert.equal(summary.total, 3)
  assert.equal(summary.completed, 1)
  assert.equal(summary.cancelled, 1)
  assert.equal(summary.rejected, 1)
  assert.equal(summary.uniqueSongs, 2)
  assert.equal(summary.topSongs[0].count, 2)
  assert.equal(summary.topSongs[0].performed, 1)
  assert.equal(summary.topTables.length, 1)
  assert.equal(requestsForNights({ nights: [], requests: records }, ['noite-b']).length, 1)
})

test('CSV contém apenas resumo e neutraliza fórmulas em títulos enviados', () => {
  const night = { id: 'noite-a', startedAt: 1_800_000_000_000, endedAt: null }
  const record = request('1', night.startedAt, '=HYPERLINK("site")', 'Cantor', 'completed')
  record.name = 'Nome privado'
  const csv = buildSummaryCsv({ nights: [night], requests: [record] }, [night])
  assert.match(csv, /'=HYPERLINK/)
  assert.doesNotMatch(csv, /Nome privado/)
  assert.match(csv, /Apresentações/)
})
