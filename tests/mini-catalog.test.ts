// Giá trong Mini App phải trùng bảng giá các trang sản phẩm, và mã variation POScake phải là biến môi trường có thật.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { CATALOG, publicCatalog } from '../lib/mini/catalog'

const SOURCE: Record<string, [route: string, variant: string]> = {
  'sxc-set': ['set-xoi-com-order', 'set'],
  'sxx-500g': ['sot-xa-xiu-order', '500g'],
  'sxx-1kg': ['sot-xa-xiu-order', '1kg'],
  'stn-500g': ['sot-tron-nom-order', '500g'],
  'stn-1kg': ['sot-tron-nom-order', '1kg'],
  kdx: ['khan-do-xoi-order', 'lon'],
}

test('giá Mini App trùng giá trang sản phẩm (app/api/*-order)', () => {
  assert.deepEqual(CATALOG.map(c => c.sku).sort(), Object.keys(SOURCE).sort(), 'thêm món vào catalog thì thêm nguồn giá ở test này')
  for (const c of CATALOG) {
    const [route, variant] = SOURCE[c.sku]
    const src = readFileSync(`app/api/${route}/route.ts`, 'utf8')
    const m = src.match(new RegExp(`'?${variant}'?\\s*:\\s*\\{\\s*price:\\s*(\\d+)`))
    assert.ok(m, `không đọc được giá ${variant} trong ${route}`)
    assert.equal(c.price, Number(m[1]), `${c.sku} lệch giá với trang ${route}`)
  }
})

test('mỗi món dùng đúng biến môi trường variation mà lib/pancake.ts dùng', () => {
  const src = readFileSync('lib/pancake.ts', 'utf8')
  for (const c of CATALOG) assert.ok(src.includes(`process.env.${c.variationEnv}`), `${c.variationEnv} không có trong lib/pancake.ts`)
})

test('catalog công khai không lộ tên biến môi trường, sku không trùng', () => {
  assert.ok(publicCatalog().every(i => !('variationEnv' in i)))
  assert.equal(new Set(CATALOG.map(c => c.sku)).size, CATALOG.length)
})
