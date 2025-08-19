import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

export default function Home(){
  const [file, setFile] = useState(null)
  const [password, setPassword] = useState('')
  const [totalQuestions, setTotalQuestions] = useState(10)
  const [mcq, setMcq] = useState(8)
  const [tf, setTf] = useState(1)
  const [fill, setFill] = useState(1)
  const [timePerQ, setTimePerQ] = useState(20)
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  async function createRoom(e){
    e.preventDefault()
    if (!file) return alert('upload file')
    const form = new FormData()
    form.append('file', file)
    form.append('password', password)
    form.append('totalQuestions', totalQuestions)
    form.append('mcq', mcq)
    form.append('tf', tf)
    form.append('fill', fill)
    form.append('timePerQ', timePerQ)
    setCreating(true)
    try {
      const resp = await axios.post('http://localhost:4000/api/create-room', form, { headers: {'Content-Type':'multipart/form-data'} })
      const { roomId, password: pw } = resp.data
      alert('Room created: ' + roomId + '\nPassword: ' + pw)
      navigate(`/room/${roomId}`, { state: { password: pw } })
    } catch (err) {
      alert('create error: ' + err?.response?.data?.error || err.message)
    } finally { setCreating(false) }
  }

  return (
    <div className="container">
      <h1>AI Quiz From Notes — Create Room</h1>
      <form onSubmit={createRoom}>
        <label>Upload note image / single page PDF</label>
        <input type="file" accept="image/*,.pdf" onChange={e=>setFile(e.target.files[0])} />
        <label>Room password (optional, will be auto-generated if blank)</label>
        <input value={password} onChange={e=>setPassword(e.target.value)} />
        <label>Total questions</label>
        <input type="number" value={totalQuestions} onChange={e=>setTotalQuestions(e.target.value)} />
        <label>MCQ count</label>
        <input type="number" value={mcq} onChange={e=>setMcq(e.target.value)} />
        <label>True/False count</label>
        <input type="number" value={tf} onChange={e=>setTf(e.target.value)} />
        <label>Fill-in count</label>
        <input type="number" value={fill} onChange={e=>setFill(e.target.value)} />
        <label>Time per question (sec)</label>
        <input type="number" value={timePerQ} onChange={e=>setTimePerQ(e.target.value)} />
        <button type="submit" disabled={creating}>{creating ? 'Creating...' : 'Create Room'}</button>
      </form>
    </div>
  )
}
