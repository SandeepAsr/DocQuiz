// backend/db.js
const { Low } = require('lowdb')
const { JSONFile } = require('lowdb/node')
const path = require('path')

const file = path.join(__dirname, 'db.json')
const adapter = new JSONFile(file)
const db = new Low(adapter)

async function init() {
  await db.read()
  db.data = db.data || { rooms: {}, users: {} }
  await db.write()
}
init()

module.exports = db
