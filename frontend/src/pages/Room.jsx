import React, { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import io from 'socket.io-client'
import axios from 'axios'

const socket = io('http://localhost:4000')

export default function Room(){
  const { id } = useParams()
  const loc = useLocation()
  const [password, setPassword] = useState(loc.state?.password || '')
  const [username, setUsername] = useState('Guest')
  const [quiz, setQuiz] = useState([])
  const [joined, setJoined] = useState(false)
  const [leaderboard, setLeaderboard] = useState({})
  const [currentQuestion, setCurrentQuestion] = useState(null)
  const [index, setIndex] = useState(null)

  useEffect(()=>{
    axios.get(`http://localhost:4000/api/room/${id}`).then(r=>{
      setQuiz(r.data.quiz)
    }).catch(e=>console.error(e))
  },[id])

  useEffect(()=>{
    socket.on('leaderboard_update', (lb)=> setLeaderboard(lb))
    socket.on('joined', ()=> setJoined(true))
    socket.on('question', ({index, question})=>{
      setIndex(index)
      setCurrentQuestion(question)
    })
    socket.on('answer_result', ({correct}) => {
      alert(correct ? 'Correct!' : 'Incorrect')
    })
    return ()=> {
      socket.off('leaderboard_update')
      socket.off('joined')
      socket.off('question')
      socket.off('answer_result')
    }
  },[])

  function join(){
    socket.emit('join_room', { roomId: id, username, password })
  }
  function startQuiz(){ socket.emit('start_quiz', { roomId: id }) }
  function submitAnswer(ans){
    socket.emit('submit_answer', { roomId: id, qIndex: index, answer: ans })
  }

  return (
    <div className="container">
      <h2>Room: {id}</h2>
      {!joined ? (
        <div>
          <input placeholder="username" value={username} onChange={e=>setUsername(e.target.value)} />
          <input placeholder="room password" value={password} onChange={e=>setPassword(e.target.value)} />
          <button onClick={join}>Join Room</button>
        </div>
      ) : (
        <div>
          <button onClick={startQuiz}>Start Quiz</button>
          <div className="quiz-area">
            {currentQuestion ? (
              <div>
                <h3>Q{index+1}: {currentQuestion.question}</h3>
                {currentQuestion.type === 'MCQ' && currentQuestion.options.map((opt,i)=>(
                  <button key={i} onClick={()=>submitAnswer(i)}>{opt}</button>
                ))}
                {currentQuestion.type === 'TF' && (
                  <>
                    <button onClick={()=>submitAnswer(true)}>True</button>
                    <button onClick={()=>submitAnswer(false)}>False</button>
                  </>
                )}
                {currentQuestion.type === 'Fill' && (
                  <FillAnswer onSubmit={(val)=>submitAnswer(val)} />
                )}
              </div>
            ) : <div>No current question</div>}
          </div>
          <Leaderboard leaderboard={leaderboard} />
        </div>
      )}
    </div>
  )
}

function FillAnswer({onSubmit}) {
  const [v, setV] = useState('')
  return (
    <div>
      <input value={v} onChange={e=>setV(e.target.value)} />
      <button onClick={()=>onSubmit(v)}>Submit</button>
    </div>
  )
}

function Leaderboard({leaderboard}) {
  const entries = Object.entries(leaderboard || {})
  return (
    <div>
      <h4>Leaderboard</h4>
      <ul>
        {entries.map(([id,user])=>(
          <li key={id}>{user.username} — {user.score}</li>
        ))}
      </ul>
    </div>
  )
}
