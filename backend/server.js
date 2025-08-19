// backend/server.js
require('dotenv').config()
const express = require('express')
const http = require('http')
const multer = require('multer')
const path = require('path')
const cors = require('cors')
const shortid = require('shortid')
const bcrypt = require('bcryptjs')
const { extractTextFromFile } = require('./ocr')
const { generateQuiz } = require('./llm')
const db = require('./db')

const app = express()
app.use(cors())
app.use(express.json())

const server = http.createServer(app)
const { Server } = require('socket.io')
const io = new Server(server, { cors: { origin: '*' } })

const upload = multer({ dest: path.join(__dirname, 'uploads/') })

// create room + upload + generate quiz
app.post('/api/create-room', upload.single('file'), async (req, res) => {
  try {
    const file = req.file
    const { totalQuestions = 10, mcq=8, tf=1, fill=1, timePerQ=20, difficultySplit } = req.body
    if (!file) return res.status(400).json({ error: 'file required' })
    const filePath = file.path
    // OCR
    const text = await extractTextFromFile(filePath)
    // Build params
    const types = { mcq: Number(mcq), tf: Number(tf), fill: Number(fill) }
    const params = { totalQuestions: Number(totalQuestions), types, difficultySplit: difficultySplit || {easy:50,medium:30,hard:20}, timePerQ: Number(timePerQ) }
    // LLM
    const quizJson = await generateQuiz(text, params)
    // Create room id + hashed password
    const roomId = shortid.generate()
    const pw = req.body.password || shortid.generate().slice(0,6)
    const hashed = await bcrypt.hash(pw, 10)
    // store
    await db.read()
    db.data.rooms[roomId] = {
      roomId,
      passwordHash: hashed,
      params,
      quiz: quizJson.quiz,
      summary: quizJson.summary,
      createdAt: new Date().toISOString()
    }
    await db.write()
    res.json({ roomId, password: pw })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: err.message })
  }
})

// fetch room metadata (no answers)
app.get('/api/room/:id', async (req, res) => {
  await db.read()
  const room = db.data.rooms[req.params.id]
  if (!room) return res.status(404).json({ error: 'room not found' })
  // send quiz but hide correct answers
  const quizPublic = room.quiz.map(q => {
    const copy = { ...q }
    delete copy.correct
    return copy
  })
  res.json({ roomId: room.roomId, params: room.params, quiz: quizPublic, summary: room.summary })
})

// socket.io logic: join, answer, leaderboard
const scoreboards = {} // in-memory: {roomId: { userId: score, ... } }
io.on('connection', (socket) => {
  console.log('socket connected', socket.id)
  socket.on('join_room', async ({ roomId, username, password }) => {
    await db.read()
    const room = db.data.rooms[roomId]
    if (!room) {
      socket.emit('join_error', 'Room not found')
      return
    }
    // check password
    const ok = await bcrypt.compare(password, room.passwordHash)
    if (!ok) {
      socket.emit('join_error', 'Invalid password')
      return
    }
    socket.join(roomId)
    socket.data.roomId = roomId
    socket.data.username = username || 'Anon'
    // initialize scoreboard
    scoreboards[roomId] = scoreboards[roomId] || {}
    scoreboards[roomId][socket.id] = { username: socket.data.username, score: 0 }
    io.to(roomId).emit('leaderboard_update', scoreboards[roomId])
    socket.emit('joined', { success: true })
  })

  socket.on('start_quiz', ({ roomId }) => {
    // only author should call; for simplicity allow any joiner to start
    db.read().then(() => {
      const room = db.data.rooms[roomId]
      if (!room) return socket.emit('error', 'room not found')
      io.to(roomId).emit('quiz_started', { totalQuestions: room.quiz.length })
      // send first question
      const q0 = room.quiz[0]
      io.to(roomId).emit('question', { index: 0, question: q0 })
    })
  })

  socket.on('submit_answer', async ({ roomId, qIndex, answer }) => {
    await db.read()
    const room = db.data.rooms[roomId]
    if (!room) return
    const q = room.quiz[qIndex]
    if (!q) return
    let correct = false
    if (q.type === 'MCQ') {
      correct = (Number(answer) === Number(q.correct))
    } else if (q.type === 'TF') {
      correct = (String(answer).toLowerCase() === String(q.correct).toLowerCase())
    } else if (q.type === 'Fill') {
      correct = String(answer).trim().toLowerCase() === String(q.correct).trim().toLowerCase()
    }
    if (correct) {
      scoreboards[roomId] = scoreboards[roomId] || {}
      const entry = scoreboards[roomId][socket.id] || { username: socket.data.username, score: 0 }
      entry.score += 10 // arbitrary points
      scoreboards[roomId][socket.id] = entry
    }
    io.to(roomId).emit('leaderboard_update', scoreboards[roomId])
    // optionally send correct/incorrect
    socket.emit('answer_result', { correct })
  })

  socket.on('disconnect', () => {
    const rid = socket.data.roomId
    if (rid && scoreboards[rid]) {
      delete scoreboards[rid][socket.id]
      io.to(rid).emit('leaderboard_update', scoreboards[rid])
    }
  })
})

const port = process.env.PORT || 4000
server.listen(port, () => console.log('Backend listening on', port))
