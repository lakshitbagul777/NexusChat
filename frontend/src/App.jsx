import { useState } from 'react'
import './App.css'
import VideoChat from './components/VideoChat.jsx'
import CallButton from './components/CallButton.jsx'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <VideoChat />
    </>
  )
}

export default App
